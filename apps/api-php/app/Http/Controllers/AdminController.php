<?php

namespace App\Http\Controllers;

use App\Constants\AdminAction;
use App\Constants\ApprovalStatus;
use App\Constants\BookingStatus;
use App\Constants\UserRole;
use App\Constants\WorkshopStatus;
use App\Models\User;
use App\Notifications\WorkshopApprovedNotification;
use App\Services\PusherService;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class AdminController extends Controller
{
    // GET /api/v1/admin/stats
    public function stats(): JsonResponse
    {
        $s = new \stdClass();

        $s->total_workshops     = (int)DB::selectOne("SELECT COUNT(*) as c FROM workshops WHERE status != ?", [WorkshopStatus::ARCHIVED])->c;
        $s->published_workshops = (int)DB::selectOne("SELECT COUNT(*) as c FROM workshops WHERE status = ?", [WorkshopStatus::PUBLISHED])->c;
        $s->draft_workshops     = (int)DB::selectOne("SELECT COUNT(*) as c FROM workshops WHERE status = ?", [WorkshopStatus::DRAFT])->c;
        $s->pending_review      = (int)DB::selectOne("SELECT COUNT(*) as c FROM workshops WHERE approval_status = ?", [ApprovalStatus::PENDING_REVIEW])->c;
        $s->changes_requested   = (int)DB::selectOne("SELECT COUNT(*) as c FROM workshops WHERE approval_status = ?", [ApprovalStatus::CHANGES_REQUESTED])->c;
        $s->total_instructors   = (int)DB::selectOne("SELECT COUNT(*) as c FROM users WHERE role IN (?, ?)", [UserRole::INSTRUCTOR, UserRole::BOTH])->c;
        $s->total_students      = (int)DB::selectOne("SELECT COUNT(*) as c FROM users WHERE role IN (?, ?)", [UserRole::STUDENT, UserRole::BOTH])->c;
        $s->total_bookings      = (int)DB::selectOne("SELECT COUNT(*) as c FROM bookings")->c;
        $s->confirmed_bookings  = (int)DB::selectOne("SELECT COUNT(*) as c FROM bookings WHERE status = ?", [BookingStatus::CONFIRMED])->c;
        $s->cancelled_bookings  = (int)DB::selectOne("SELECT COUNT(*) as c FROM bookings WHERE status = ?", [BookingStatus::CANCELLED])->c;
        $s->total_revenue       = (float)DB::selectOne("SELECT COALESCE(SUM(amount),0) as c FROM bookings WHERE status = ?", [BookingStatus::CONFIRMED])->c;
        $s->platform_commission = (float)DB::selectOne("SELECT COALESCE(SUM(commission),0) as c FROM bookings WHERE status = ?", [BookingStatus::CONFIRMED])->c;

        return response()->json(['data' => $s]);
    }

    // GET /api/v1/admin/workshops?status=...
    public function workshops(Request $request): JsonResponse
    {
        $filter = $request->query('status', '');

        $sql = "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                       w.type, w.modality, w.price, w.currency,
                       w.capacity, COALESCE(w.location,'') as location,
                       COALESCE(w.online_url,'') as online_url,
                       COALESCE(w.cover_image_url,'') as cover_image_url,
                       w.status, w.approval_status,
                       COALESCE(w.admin_observations,'') as admin_observations,
                       w.pending_changes,
                       COALESCE(w.reviewed_at::text,'') as reviewed_at,
                       COALESCE(w.created_at::text,'') as created_at,
                       COALESCE(c.id::text,'') as category_id,
                       COALESCE(c.name,'') as category_name,
                       w.instructor_id::text as instructor_id,
                       COALESCE(p.name,'') as instructor_name,
                       COALESCE(u.email,'') as instructor_email,
                       (SELECT COUNT(*) FROM bookings b
                        WHERE b.workshop_id = w.id AND b.status = ?) AS bookings_count
                FROM workshops w
                LEFT JOIN categories c ON c.id = w.category_id
                LEFT JOIN profiles p ON p.user_id = w.instructor_id
                LEFT JOIN users u ON u.id = w.instructor_id
                WHERE w.status != ?";

        $bindings = [BookingStatus::CONFIRMED, WorkshopStatus::ARCHIVED];

        if ($filter !== '') {
            $sql .= " AND w.approval_status = ?";
            $bindings[] = $filter;  // already a validated approval_status string from query param
        }
        $sql .= " ORDER BY w.created_at DESC";

        $rows = DB::select($sql, $bindings);
        foreach ($rows as $row) {
            $row->pending_changes = $row->pending_changes
                ? json_decode($row->pending_changes, true)
                : null;
            $row->bookings_count = (int)($row->bookings_count ?? 0);
        }

        return response()->json(['data' => $rows]);
    }

    // POST /api/v1/admin/workshops/:id/review
    public function review(Request $request, string $id): JsonResponse
    {
        $adminID = $this->userId($request);

        $this->validate($request, [
            'action'       => 'required|string|in:approve,send_observations',
            'observations' => 'sometimes|string',
        ]);

        $exists = DB::selectOne(
            "SELECT true as ok FROM workshops WHERE id = ? AND status != ?",
            [$id, WorkshopStatus::ARCHIVED]
        );
        if (!$exists) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $action = $request->input('action');

        if ($action === AdminAction::APPROVE) {
            // Fetch pending_changes before the update so we can apply proposed sensitive values
            $workshopBefore = DB::selectOne(
                "SELECT instructor_id::text as instructor_id, pending_changes FROM workshops WHERE id = ?",
                [$id]
            );
            $pending      = $workshopBefore->pending_changes ? json_decode($workshopBefore->pending_changes, true) : [];
            $propTitle    = $pending['title']       ?? null;
            $propDesc     = $pending['description'] ?? null;
            $propModality = $pending['modality']    ?? null;

            DB::update(
                "UPDATE workshops
                 SET approval_status = ?, status = ?,
                     admin_observations = NULL, pending_changes = NULL,
                     title       = COALESCE(?, title),
                     description = COALESCE(?, description),
                     modality    = COALESCE(?, modality),
                     reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
                 WHERE id = ?",
                [ApprovalStatus::APPROVED, WorkshopStatus::PUBLISHED, $propTitle, $propDesc, $propModality, $adminID, $id]
            );

            // Notify instructor + students with confirmed bookings
            try {
                $workshop = DB::selectOne(
                    "SELECT title, instructor_id::text as instructor_id FROM workshops WHERE id = ?",
                    [$id]
                );
                $instructor = DB::selectOne(
                    "SELECT COALESCE(p.name, u.email) as name
                     FROM users u LEFT JOIN profiles p ON p.user_id = u.id
                     WHERE u.id = ?",
                    [$workshop->instructor_id]
                );
                $instructorName = $instructor?->name ?? '';

                // Notify the instructor
                $notifiable = new User();
                $notifiable->id = $workshop->instructor_id;
                $instrNotif = new WorkshopApprovedNotification(
                    workshopId:      $id,
                    workshopTitle:   $workshop->title ?? '',
                    instructorName:  $instructorName,
                    recipientRole:   'instructor',
                );
                $instrPayload = $instrNotif->toDatabase($notifiable);
                Notification::send($notifiable, $instrNotif);
                app(PusherService::class)->notifyUser($workshop->instructor_id, $instrPayload);
                try {
                    app(WebPushService::class)->notifyUser($workshop->instructor_id, WebPushService::buildPayload($instrPayload));
                } catch (\Throwable $e) {
                    \Log::warning('WebPush (approve/instructor) failed: ' . $e->getMessage());
                }

                // Notify all students with confirmed bookings
                $students = DB::select(
                    "SELECT DISTINCT b.student_id::text as student_id
                     FROM bookings b
                     WHERE b.workshop_id = ? AND b.status = ?",
                    [$id, BookingStatus::CONFIRMED]
                );
                foreach ($students as $s) {
                    $studentNotifiable = new User();
                    $studentNotifiable->id = $s->student_id;
                    $studentNotif = new WorkshopApprovedNotification(
                        workshopId:      $id,
                        workshopTitle:   $workshop->title ?? '',
                        instructorName:  $instructorName,
                        recipientRole:   'student',
                    );
                    $studentPayload = $studentNotif->toDatabase($studentNotifiable);
                    Notification::send($studentNotifiable, $studentNotif);
                    app(PusherService::class)->notifyUser($s->student_id, $studentPayload);
                    try {
                        app(WebPushService::class)->notifyUser($s->student_id, WebPushService::buildPayload($studentPayload));
                    } catch (\Throwable $e) {
                        \Log::warning('WebPush (approve/student) failed: ' . $e->getMessage());
                    }
                }
            } catch (\Throwable $e) {
                \Log::warning('Failed to dispatch WorkshopApprovedNotification: ' . $e->getMessage());
            }

            return response()->json(['data' => ['id' => $id, 'approval_status' => ApprovalStatus::APPROVED, 'status' => WorkshopStatus::PUBLISHED]]);
        }

        // send_observations
        if (empty($request->input('observations'))) {
            return response()->json(['message' => 'Las observaciones no pueden estar vacías'], 400);
        }
        DB::update(
            "UPDATE workshops
             SET approval_status = ?, admin_observations = ?,
                 reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
             WHERE id = ?",
            [ApprovalStatus::CHANGES_REQUESTED, $request->input('observations'), $adminID, $id]
        );
        return response()->json(['data' => ['id' => $id, 'approval_status' => ApprovalStatus::CHANGES_REQUESTED]]);
    }

    // PUT /api/v1/admin/workshops/:id
    public function updateWorkshop(Request $request, string $id): JsonResponse
    {
        $this->validate($request, [
            'title'    => 'required|string',
            'modality' => 'required|string',
        ]);

        $currency = $request->input('currency', 'CLP') ?: 'CLP';
        $catID    = $request->input('category_id') ?: null;

        $affected = DB::update(
            "UPDATE workshops
             SET title=?, description=?, modality=?,
                 price=?, currency=?, capacity=?, location=?,
                 online_url=?, category_id=?, updated_at=NOW()
             WHERE id=? AND status != ?",
            [
                $request->input('title'),
                $request->input('description', ''),
                $request->input('modality'),
                (float)$request->input('price', 0),
                $currency,
                $request->input('capacity'),
                $request->input('location', ''),
                $request->input('online_url', ''),
                $catID,
                $id,
                WorkshopStatus::ARCHIVED,
            ]
        );

        if ($affected === 0) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        // Notify students with confirmed bookings
        try {
            $workshop  = DB::selectOne("SELECT title, status FROM workshops WHERE id = ?", [$id]);
            if (($workshop->status ?? '') === WorkshopStatus::PUBLISHED) {
                $students = DB::select(
                    "SELECT DISTINCT b.student_id::text as student_id
                     FROM bookings b WHERE b.workshop_id = ? AND b.status = ?",
                    [$id, BookingStatus::CONFIRMED]
                );
                foreach ($students as $s) {
                    $notifiable = new User();
                    $notifiable->id = $s->student_id;
                    $notif = new \App\Notifications\WorkshopUpdatedNotification(
                        workshopId:    $id,
                        workshopTitle: $workshop->title ?? '',
                        pendingReview: false,
                    );
                    \Illuminate\Support\Facades\Notification::send($notifiable, $notif);
                    $payload = $notif->toDatabase($notifiable);
                    app(PusherService::class)->notifyUser($s->student_id, $payload);
                    try {
                        app(WebPushService::class)->notifyUser($s->student_id, WebPushService::buildPayload($payload));
                    } catch (\Throwable $e) {
                        \Log::warning('WebPush (admin update) failed: ' . $e->getMessage());
                    }
                }
            }
        } catch (\Throwable $e) {
            \Log::warning('Failed to dispatch admin WorkshopUpdatedNotification: ' . $e->getMessage());
        }

        return response()->json(['data' => ['id' => $id]]);
    }
}
