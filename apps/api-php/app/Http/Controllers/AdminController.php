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
                       w.type, w.modality, w.price::int as price, w.currency,
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
                WHERE 1=1";

        $bindings = [BookingStatus::CONFIRMED];

        if ($filter === WorkshopStatus::ARCHIVED) {
            $sql .= " AND w.status = ?";
            $bindings[] = WorkshopStatus::ARCHIVED;
        } elseif ($filter !== '') {
            $sql .= " AND w.status != ? AND w.approval_status = ?";
            $bindings[] = WorkshopStatus::ARCHIVED;
            $bindings[] = $filter;
        } else {
            $sql .= " AND w.status != ?";
            $bindings[] = WorkshopStatus::ARCHIVED;
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

    // GET /api/v1/admin/workshops/:id
    public function getWorkshop(Request $request, string $id): JsonResponse
    {
        $w = DB::selectOne(
            "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price::int as price, w.currency,
                    w.capacity, COALESCE(w.location,'') as location,
                    COALESCE(w.address,'') as address,
                    w.lat, w.lng,
                    COALESCE(w.online_url,'') as online_url,
                    COALESCE(w.maps_url,'') as maps_url,
                    COALESCE(w.notes,'') as notes,
                    COALESCE(w.cover_image_url,'') as cover_image_url,
                    w.venue_id::text as venue_id,
                    w.status, w.approval_status,
                    COALESCE(w.admin_observations,'') as admin_observations,
                    w.pending_changes,
                    COALESCE(w.created_at::text,'') as created_at,
                    COALESCE(c.id::text,'') as category_id,
                    COALESCE(c.name,'') as category_name,
                    COALESCE(c.slug,'') as category_slug,
                    w.instructor_id::text as instructor_id,
                    COALESCE(p.name,'') as instructor_name,
                    COALESCE(u.email,'') as instructor_email,
                    COALESCE(p.bio,'') as instructor_bio
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             LEFT JOIN profiles p ON p.user_id = w.instructor_id
             LEFT JOIN users u ON u.id = w.instructor_id
             WHERE w.id = ?",
            [$id]
        );

        if (!$w) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $w->pending_changes = $w->pending_changes
            ? json_decode($w->pending_changes, true)
            : null;

        if ($w->type === \App\Constants\WorkshopType::CLASS_TYPE) {
            $rows = DB::select(
                "SELECT id, workshop_id,
                        array_to_string(days_of_week, ',') as days_of_week,
                        time_start::text as time_start, duration_min,
                        valid_from::text as valid_from, valid_until::text as valid_until,
                        created_at::text as created_at
                 FROM schedules
                 WHERE workshop_id = ?
                   AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
                 ORDER BY valid_from, time_start",
                [$w->id]
            );
            foreach ($rows as $r) {
                $r->days_of_week = array_map('intval', array_filter(explode(',', $r->days_of_week ?? ''), fn($v) => $v !== ''));
            }
            $w->schedules = $rows;
            $w->sessions  = [];
        } else {
            $w->schedules = [];
            $w->sessions  = DB::select(
                "SELECT id, starts_at::text as starts_at, ends_at::text as ends_at,
                        COALESCE(notes,'') as notes
                 FROM sessions WHERE workshop_id = ? AND schedule_id IS NULL ORDER BY starts_at",
                [$w->id]
            );
        }

        $bc = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings WHERE workshop_id = ? AND status = ?",
            [$w->id, \App\Constants\BookingStatus::CONFIRMED]
        );
        $w->bookings_count = (int)($bc->cnt ?? 0);

        return response()->json(['data' => $w]);
    }

    // POST /api/v1/admin/workshops/:id/review
    public function review(Request $request, string $id): JsonResponse
    {
        $adminID = $this->userId($request);

        $this->validate($request, [
            'action'       => 'required|string|in:approve,send_observations',
            'observations' => 'sometimes|string',
        ]);

        $workshop = Workshop::where('id', $id)->first();
        if (!$workshop) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $action = $request->input('action');

        if ($action === AdminAction::APPROVE) {
            $pending = $workshop->pending_changes ?? [];

            $fillData = [
                'approval_status'    => ApprovalStatus::APPROVED,
                'status'             => WorkshopStatus::PUBLISHED,
                'admin_observations' => null,
                'pending_changes'    => null,
                'reviewed_by'        => $adminID,
                'reviewed_at'        => \Carbon\Carbon::now(),
            ];

            // Apply all pending fields if present
            $scalarFields = ['title', 'description', 'modality', 'price', 'currency',
                             'capacity', 'location', 'address', 'lat', 'lng',
                             'online_url', 'notes', 'category_id', 'venue_id'];
            foreach ($scalarFields as $field) {
                if (array_key_exists($field, $pending)) {
                    $fillData[$field] = $pending[$field];
                }
            }

            $workshop->fill($fillData);
            $workshop->notifyContext = ['action' => 'approve'];
            $workshop->save();

            // Apply pending sessions if present
            if (array_key_exists('sessions', $pending) && is_array($pending['sessions'])) {
                $confirmedBookings = (int)(DB::selectOne(
                    "SELECT COUNT(*) as cnt FROM bookings WHERE workshop_id = ? AND status = ?",
                    [$id, \App\Constants\BookingStatus::CONFIRMED]
                )->cnt ?? 0);

                if ($confirmedBookings === 0) {
                    DB::delete("DELETE FROM sessions WHERE workshop_id = ? AND schedule_id IS NULL", [$id]);
                    foreach ($pending['sessions'] as $s) {
                        if (empty($s['starts_at']) || empty($s['ends_at'])) {
                            continue;
                        }
                        DB::insert(
                            "INSERT INTO sessions (workshop_id, starts_at, ends_at, notes) VALUES (?, ?, ?, ?)",
                            [$id, $s['starts_at'], $s['ends_at'], $s['notes'] ?? '']
                        );
                    }
                }
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

        $lat = $request->input('lat') !== null ? (float)$request->input('lat') : null;
        $lng = $request->input('lng') !== null ? (float)$request->input('lng') : null;

        $workshop = Workshop::where('id', $id)->first();
        if (!$workshop) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $wasPublished = $workshop->status === WorkshopStatus::PUBLISHED;

        $workshop->fill([
            'title'       => $request->input('title'),
            'description' => $request->input('description', ''),
            'modality'    => $request->input('modality'),
            'price'       => (int) round((float)$request->input('price', 0)),
            'currency'    => $currency,
            'capacity'    => $request->input('capacity'),
            'location'    => $request->input('location', ''),
            'lat'         => $lat,
            'lng'         => $lng,
            'online_url'  => $request->input('online_url', ''),
            'notes'       => $request->input('notes', '') ?: null,
            'category_id' => $catID,
            'venue_id'    => $request->input('venue_id') ?: null,
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

    // GET /api/v1/admin/users/search?q=...
    // Busca usuarios registrados por nombre o email (para asignar co-talleristas).
    public function searchUsers(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json(['data' => []]);
        }

        $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $q) . '%';

        $rows = DB::select(
            "SELECT u.id::text as id,
                    COALESCE(p.name, '') as name,
                    u.email,
                    u.role
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE (p.name ILIKE ? OR u.email ILIKE ?)
             ORDER BY (p.name IS NULL), p.name, u.email
             LIMIT 20",
            [$like, $like]
        );

        return response()->json(['data' => $rows]);
    }

    // DELETE /api/v1/admin/workshops/:id
    public function archiveWorkshop(string $id): JsonResponse
    {
        $exists = DB::selectOne(
            "SELECT id FROM workshops WHERE id = ? AND status != ?",
            [$id, WorkshopStatus::ARCHIVED]
        );
        if (!$exists) {
            return response()->json(['message' => 'Taller no encontrado o ya archivado'], 404);
        }

        if ($count = $this->activeBookingsCount($id)) {
            return response()->json([
                'message'         => "El taller tiene {$count} reserva(s) activa(s). No se puede archivar.",
                'active_bookings' => $count,
            ], 409);
        }

        DB::update(
            "UPDATE workshops SET status = ?, updated_at = NOW() WHERE id = ?",
            [WorkshopStatus::ARCHIVED, $id]
        );

        return response()->json(['data' => ['id' => $id, 'status' => WorkshopStatus::ARCHIVED]]);
    }

    // POST /api/v1/admin/workshops/:id/publish
    public function publishWorkshop(string $id): JsonResponse
    {
        $exists = DB::selectOne(
            "SELECT id FROM workshops WHERE id = ? AND status = ?",
            [$id, WorkshopStatus::DRAFT]
        );
        if (!$exists) {
            return response()->json(['message' => 'Taller no encontrado o no está en borrador'], 404);
        }

        DB::update(
            "UPDATE workshops SET status = ?, updated_at = NOW() WHERE id = ?",
            [WorkshopStatus::PUBLISHED, $id]
        );

        return response()->json(['data' => ['id' => $id, 'status' => WorkshopStatus::PUBLISHED]]);
    }

    // POST /api/v1/admin/workshops/:id/restore
    public function restoreWorkshop(string $id): JsonResponse
    {
        $exists = DB::selectOne(
            "SELECT id FROM workshops WHERE id = ? AND status = ?",
            [$id, WorkshopStatus::ARCHIVED]
        );
        if (!$exists) {
            return response()->json(['message' => 'Taller no encontrado o no está archivado'], 404);
        }

        DB::update(
            "UPDATE workshops SET status = ?, updated_at = NOW() WHERE id = ?",
            [WorkshopStatus::DRAFT, $id]
        );

        return response()->json(['data' => ['id' => $id, 'status' => WorkshopStatus::DRAFT]]);
    }

    // DELETE /api/v1/admin/workshops/:id/permanent
    public function permanentDeleteWorkshop(string $id): JsonResponse
    {
        $workshop = DB::selectOne(
            "SELECT id FROM workshops WHERE id = ? AND status = ?",
            [$id, WorkshopStatus::ARCHIVED]
        );
        if (!$workshop) {
            return response()->json(['message' => 'Solo se pueden eliminar talleres archivados'], 404);
        }

        DB::delete("DELETE FROM bookings WHERE workshop_id = ?", [$id]);
        DB::delete("DELETE FROM sessions WHERE workshop_id = ?", [$id]);
        DB::delete("DELETE FROM schedules WHERE workshop_id = ?", [$id]);
        DB::delete("DELETE FROM workshops WHERE id = ?", [$id]);

        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }
}
