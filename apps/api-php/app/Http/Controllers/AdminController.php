<?php

namespace App\Http\Controllers;

use App\Constants\AdminAction;
use App\Constants\ApprovalStatus;
use App\Constants\BookingStatus;
use App\Constants\UserRole;
use App\Constants\WorkshopStatus;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        $workshop = Workshop::where('id', $id)->where('status', '!=', WorkshopStatus::ARCHIVED)->first();
        if (!$workshop) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $action = $request->input('action');

        if ($action === AdminAction::APPROVE) {
            $pending      = $workshop->pending_changes ?? [];
            $propTitle    = $pending['title']       ?? null;
            $propDesc     = $pending['description'] ?? null;
            $propModality = $pending['modality']    ?? null;

            $workshop->fill([
                'approval_status'    => ApprovalStatus::APPROVED,
                'status'             => WorkshopStatus::PUBLISHED,
                'admin_observations' => null,
                'pending_changes'    => null,
                'title'              => $propTitle    ?? $workshop->title,
                'description'        => $propDesc     ?? $workshop->description,
                'modality'           => $propModality ?? $workshop->modality,
                'reviewed_by'        => $adminID,
                'reviewed_at'        => \Carbon\Carbon::now(),
            ]);
            $workshop->notifyContext = ['action' => 'approve'];
            $workshop->save();

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

        $lat = $request->input('lat') !== null ? (float)$request->input('lat') : null;
        $lng = $request->input('lng') !== null ? (float)$request->input('lng') : null;

        $workshop = Workshop::where('id', $id)->where('status', '!=', WorkshopStatus::ARCHIVED)->first();
        if (!$workshop) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $wasPublished = $workshop->status === WorkshopStatus::PUBLISHED;

        $workshop->fill([
            'title'       => $request->input('title'),
            'description' => $request->input('description', ''),
            'modality'    => $request->input('modality'),
            'price'       => (float)$request->input('price', 0),
            'currency'    => $currency,
            'capacity'    => $request->input('capacity'),
            'location'    => $request->input('location', ''),
            'lat'         => $lat,
            'lng'         => $lng,
            'online_url'  => $request->input('online_url', ''),
            'category_id' => $catID,
        ]);
        $workshop->notifyContext = ['action' => 'admin_update', 'was_published' => $wasPublished];
        $workshop->save();

        return response()->json(['data' => ['id' => $id]]);
    }

    // PATCH /api/v1/admin/workshops/:id/guest-contact
    public function setWorkshopGuestContact(Request $request, string $id): JsonResponse
    {
        $contactId       = $request->input('guest_contact_id');
        $useGuestContact = $request->input('use_guest_contact', true);

        DB::update(
            "UPDATE workshops SET guest_contact_id = ?, use_guest_contact = ?, updated_at = NOW() WHERE id = ?",
            [$contactId ?: null, (bool)$useGuestContact, $id]
        );

        return response()->json(['data' => ['id' => $id]]);
    }

    // PATCH /api/v1/admin/routes/:id/guest-contact
    public function setRouteGuestContact(Request $request, string $id): JsonResponse
    {
        $contactId       = $request->input('guest_contact_id');
        $useGuestContact = $request->input('use_guest_contact', true);

        DB::update(
            "UPDATE routes SET guest_contact_id = ?, use_guest_contact = ?, updated_at = NOW() WHERE id = ?",
            [$contactId ?: null, (bool)$useGuestContact, $id]
        );

        return response()->json(['data' => ['id' => $id]]);
    }
}
