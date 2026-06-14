<?php

namespace App\Http\Controllers;

use App\Constants\ApprovalStatus;
use App\Constants\BookingStatus;
use App\Constants\UserRole;
use App\Constants\WorkshopStatus;
use App\Constants\WorkshopType;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class WorkshopWriteController extends Controller
{
    // GET /api/v1/my-workshops
    public function index(Request $request): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === 'admin';

        $sql = "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price::int as price, w.currency,
                    w.capacity, COALESCE(w.location,'') as location,
                    COALESCE(w.address,'') as address,
                    w.lat, w.lng,
                    COALESCE(w.online_url,'') as online_url,
                    COALESCE(w.notes,'') as notes,
                    COALESCE(w.cover_image_url,'') as cover_image_url,
                    w.status, w.approval_status,
                    COALESCE(w.admin_observations,'') as admin_observations,
                    COALESCE(w.created_at::text,'') as created_at,
                    COALESCE(c.id::text,'') as category_id,
                    COALESCE(c.name,'') as category_name,
                    COALESCE(c.slug,'') as category_slug,
                    COALESCE(p.name,'') as instructor_name,
                    (SELECT COUNT(*) FROM bookings b
                     WHERE b.workshop_id = w.id AND b.status = ?) AS bookings_count
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             LEFT JOIN profiles p ON p.user_id = w.instructor_id";

        if ($isAdmin) {
            $workshops = DB::select($sql . " ORDER BY w.created_at DESC", [BookingStatus::CONFIRMED]);
        } else {
            $workshops = DB::select($sql . " WHERE w.instructor_id = ? ORDER BY w.created_at DESC", [BookingStatus::CONFIRMED, $userID]);
        }

        return response()->json(['data' => $workshops]);
    }

    // GET /api/v1/my-workshops/:id
    public function show(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === 'admin';

        $sql = "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price::int as price, w.currency,
                    w.capacity, COALESCE(w.location,'') as location,
                    COALESCE(w.address,'') as address,
                    w.lat, w.lng,
                    COALESCE(w.online_url,'') as online_url,
                    COALESCE(w.notes,'') as notes,
                    COALESCE(w.cover_image_url,'') as cover_image_url,
                    w.status, w.approval_status,
                    COALESCE(w.admin_observations,'') as admin_observations,
                    w.pending_changes,
                    COALESCE(w.created_at::text,'') as created_at,
                    COALESCE(c.id::text,'') as category_id,
                    COALESCE(c.name,'') as category_name,
                    COALESCE(c.slug,'') as category_slug,
                    COALESCE(p.name,'') as instructor_name,
                    COALESCE(p.bio,'') as instructor_bio
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             LEFT JOIN profiles p ON p.user_id = w.instructor_id
             WHERE w.id = ?";

        if ($isAdmin) {
            $w = DB::selectOne($sql, [$id]);
        } else {
            $w = DB::selectOne($sql . " AND w.instructor_id = ?", [$id, $userID]);
        }

        if (!$w) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $w->pending_changes = $w->pending_changes
            ? json_decode($w->pending_changes, true)
            : null;

        if ($w->type === WorkshopType::CLASS_TYPE) {
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
                $r->days_of_week = $this->parseIntCSV($r->days_of_week ?? '');
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
            [$w->id, BookingStatus::CONFIRMED]
        );
        $w->bookings_count = (int)($bc->cnt ?? 0);

        return response()->json(['data' => $w]);
    }

    // POST /api/v1/workshops
    public function store(Request $request): JsonResponse
    {
        $userID = $this->userId($request);

        $this->validate($request, [
            'title'    => 'required|string',
            'type'     => 'required|string',
            'modality' => 'required|string',
        ]);

        $currency = $request->input('currency', 'CLP') ?: 'CLP';
        $slug     = $this->slugify($request->input('title'));

        $catID = $request->input('category_id') ?: null;

        $isAdmin         = $this->userRole($request) === UserRole::ADMIN;
        $requestedStatus = $request->input('status', WorkshopStatus::DRAFT);
        $initialStatus   = $isAdmin ? $requestedStatus : WorkshopStatus::DRAFT;
        $initialApproval = ($isAdmin && $initialStatus === WorkshopStatus::PUBLISHED)
            ? ApprovalStatus::APPROVED
            : ApprovalStatus::NOT_SUBMITTED;

        $row = DB::selectOne(
            "INSERT INTO workshops
                (instructor_id, category_id, title, slug, description, type, modality,
                 price, currency, capacity, location, address, lat, lng, online_url, notes, status, approval_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id",
            [
                $userID,
                $catID,
                $request->input('title'),
                $slug,
                $request->input('description', ''),
                $request->input('type'),
                $request->input('modality'),
                (int) round((float)$request->input('price', 0)),
                $currency,
                $request->input('capacity'),
                $request->input('location', ''),
                $request->input('address', '') ?: null,
                $request->input('lat') !== null ? (float)$request->input('lat') : null,
                $request->input('lng') !== null ? (float)$request->input('lng') : null,
                $request->input('online_url', ''),
                $request->input('notes', '') ?: null,
                $initialStatus,
                $initialApproval,
            ]
        );

        if (!$row) {
            return response()->json(['message' => 'Error al crear el taller'], 500);
        }

        $workshopID = $row->id;

        foreach ((array)$request->input('sessions', []) as $s) {
            if (empty($s['starts_at']) || empty($s['ends_at'])) {
                continue;
            }
            DB::insert(
                "INSERT INTO sessions (workshop_id, starts_at, ends_at, notes) VALUES (?, ?, ?, ?)",
                [$workshopID, $s['starts_at'], $s['ends_at'], $s['notes'] ?? '']
            );
        }

        return response()->json(['data' => ['id' => $workshopID, 'slug' => $slug]], 201);
    }

    // PUT /api/v1/workshops/:id
    public function update(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === UserRole::ADMIN;

        $this->validate($request, [
            'title'    => 'required|string',
            'type'     => 'required|string',
            'modality' => 'required|string',
        ]);

        $query = Workshop::where('id', $id);
        if (!$isAdmin) {
            $query->where('instructor_id', $userID);
        }
        $workshop = $query->first();
        if (!$workshop) {
            return response()->json(['message' => 'Taller no encontrado o sin permisos'], 404);
        }

        $newStatus    = $request->input('status', WorkshopStatus::DRAFT) ?: WorkshopStatus::DRAFT;
        $wasPublished = $workshop->status === WorkshopStatus::PUBLISHED;
        $wasArchived  = $workshop->status === WorkshopStatus::ARCHIVED;

        $bc = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings WHERE workshop_id = ? AND status = ?",
            [$id, BookingStatus::CONFIRMED]
        );
        $confirmedBookings = (int)($bc->cnt ?? 0);

        // Archived workshops can be edited directly (not public) or restored to draft.
        // No review required in either case since the workshop is not visible publicly.
        if ($wasArchived && in_array($newStatus, [WorkshopStatus::DRAFT, WorkshopStatus::ARCHIVED])) {
            $catID = $request->input('category_id') ?: null;
            $workshop->fill([
                'title'       => $request->input('title'),
                'description' => $request->input('description', ''),
                'modality'    => $request->input('modality'),
                'price'       => (int) round((float)$request->input('price', 0)),
                'currency'    => $request->input('currency', 'CLP') ?: 'CLP',
                'capacity'    => $request->input('capacity'),
                'location'    => $request->input('location', ''),
                'address'     => $request->input('address', '') ?: null,
                'lat'         => $request->input('lat') !== null ? (float)$request->input('lat') : null,
                'lng'         => $request->input('lng') !== null ? (float)$request->input('lng') : null,
                'online_url'  => $request->input('online_url', ''),
                'notes'       => $request->input('notes', '') ?: null,
                'category_id' => $catID,
                'status'      => $newStatus,
            ]);
            $workshop->save();

            if ($newStatus === WorkshopStatus::DRAFT && $confirmedBookings === 0) {
                DB::delete("DELETE FROM sessions WHERE workshop_id = ? AND schedule_id IS NULL", [$id]);
                foreach ((array)$request->input('sessions', []) as $s) {
                    if (empty($s['starts_at']) || empty($s['ends_at'])) continue;
                    DB::insert(
                        "INSERT INTO sessions (workshop_id, starts_at, ends_at, notes) VALUES (?, ?, ?, ?)",
                        [$id, $s['starts_at'], $s['ends_at'], $s['notes'] ?? '']
                    );
                }
            }

            return response()->json(['data' => ['id' => $id, 'status' => $newStatus]]);
        }

        if (!$isAdmin
            && $newStatus === WorkshopStatus::PUBLISHED
            && !$wasPublished
            && $workshop->approval_status !== ApprovalStatus::APPROVED
        ) {
            return response()->json([
                'message' => 'El taller debe ser aprobado por un administrador antes de publicarse',
            ], 403);
        }

        $price    = $confirmedBookings > 0 ? $workshop->price    : (int) round((float)$request->input('price', 0));
        $capacity = $confirmedBookings > 0 ? $workshop->capacity : $request->input('capacity');

        if ($newStatus === WorkshopStatus::DRAFT && $wasPublished) {
            if ($this->activeBookingsCount($id) > 0) {
                $count = $this->activeBookingsCount($id);
                return response()->json([
                    'message'         => "El taller tiene {$count} reserva(s) activa(s). No se puede cambiar a borrador.",
                    'active_bookings' => $count,
                ], 409);
            }
        }

        if ($request->input('type') !== $workshop->type) {
            return response()->json(['message' => 'El tipo de taller no puede modificarse después de creado'], 400);
        }

        $catID       = $request->input('category_id') ?: null;
        $currency    = $request->input('currency', 'CLP') ?: 'CLP';
        $newTitle    = $request->input('title');
        $newDesc     = $request->input('description', '');
        $newModality = $request->input('modality');
        $newLat      = $request->input('lat') !== null ? (float)$request->input('lat') : null;
        $newLng      = $request->input('lng') !== null ? (float)$request->input('lng') : null;

        if (!$isAdmin) {
            // All instructor edits go to review without exception
            $proposed = [
                'title'       => $newTitle,
                'description' => $newDesc,
                'modality'    => $newModality,
                'price'       => $price,
                'currency'    => $currency,
                'capacity'    => $capacity,
                'location'    => $request->input('location', ''),
                'address'     => $request->input('address', '') ?: null,
                'lat'         => $newLat,
                'lng'         => $newLng,
                'online_url'  => $request->input('online_url', ''),
                'notes'       => $request->input('notes', '') ?: null,
                'category_id' => $catID,
                'sessions'    => $request->input('sessions', []),
            ];

            $workshop->fill([
                'pending_changes' => $proposed,
                'approval_status' => ApprovalStatus::PENDING_REVIEW,
            ]);
            $sensitiveChanged = true;
        } else {
            $workshop->fill([
                'title'       => $newTitle,
                'description' => $newDesc,
                'type'        => $workshop->type,
                'modality'    => $newModality,
                'price'       => $price,
                'currency'    => $currency,
                'capacity'    => $capacity,
                'location'    => $request->input('location', ''),
                'address'     => $request->input('address', '') ?: null,
                'lat'         => $newLat,
                'lng'         => $newLng,
                'online_url'  => $request->input('online_url', ''),
                'notes'       => $request->input('notes', '') ?: null,
                'category_id' => $catID,
                'status'      => $newStatus,
            ]);
            $sensitiveChanged = false;
        }

        if ($isAdmin && $newStatus === WorkshopStatus::PUBLISHED) {
            $workshop->approval_status = ApprovalStatus::APPROVED;
            $workshop->pending_changes = null;
            $workshop->admin_observations = null;
        }

        $workshop->notifyContext = [
            'action'            => 'update',
            'was_published'     => $wasPublished,
            'is_admin'          => $isAdmin,
            'sensitive_changed' => $sensitiveChanged,
        ];
        $workshop->save();

        if (!$isAdmin && $confirmedBookings === 0) {
            // sessions are stored in pending_changes; apply only on admin approval
        } elseif ($isAdmin && $confirmedBookings === 0) {
            DB::delete("DELETE FROM sessions WHERE workshop_id = ? AND schedule_id IS NULL", [$id]);
            foreach ((array)$request->input('sessions', []) as $s) {
                if (empty($s['starts_at']) || empty($s['ends_at'])) {
                    continue;
                }
                DB::insert(
                    "INSERT INTO sessions (workshop_id, starts_at, ends_at, notes) VALUES (?, ?, ?, ?)",
                    [$id, $s['starts_at'], $s['ends_at'], $s['notes'] ?? '']
                );
            }
        }

        return response()->json(['data' => [
            'id'              => $id,
            'approval_status' => $sensitiveChanged ? ApprovalStatus::PENDING_REVIEW : ($workshop->approval_status ?? ApprovalStatus::NOT_SUBMITTED),
        ]]);
    }

    // DELETE /api/v1/workshops/:id
    public function destroy(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === UserRole::ADMIN;

        if ($isAdmin) {
            $exists = DB::selectOne(
                "SELECT true as ok FROM workshops WHERE id = ? AND status != ?",
                [$id, WorkshopStatus::ARCHIVED]
            );
        } else {
            $exists = DB::selectOne(
                "SELECT true as ok FROM workshops WHERE id = ? AND instructor_id = ? AND status != ?",
                [$id, $userID, WorkshopStatus::ARCHIVED]
            );
        }
        if (!$exists) {
            return response()->json(['message' => 'Taller no encontrado o ya archivado'], 404);
        }

        if ($count = $this->activeBookingsCount($id)) {
            return response()->json([
                'message'         => "El taller tiene {$count} reserva(s) activa(s). No se puede archivar.",
                'active_bookings' => $count,
            ], 409);
        }

        if ($isAdmin) {
            DB::update(
                "UPDATE workshops SET status = ?, updated_at = NOW()
                 WHERE id = ? AND status != ?",
                [WorkshopStatus::ARCHIVED, $id, WorkshopStatus::ARCHIVED]
            );
        } else {
            DB::update(
                "UPDATE workshops SET status = ?, updated_at = NOW()
                 WHERE id = ? AND instructor_id = ? AND status != ?",
                [WorkshopStatus::ARCHIVED, $id, $userID, WorkshopStatus::ARCHIVED]
            );
        }

        return response()->json(['data' => ['id' => $id, 'status' => WorkshopStatus::ARCHIVED]]);
    }

    // DELETE /api/v1/workshops/:id/permanent
    public function permanentDelete(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $workshop = DB::selectOne(
            "SELECT id FROM workshops WHERE id = ? AND instructor_id = ? AND status = ?",
            [$id, $userID, WorkshopStatus::ARCHIVED]
        );
        if (!$workshop) {
            return response()->json(['message' => 'Solo se pueden eliminar talleres archivados'], 404);
        }

        DB::delete("DELETE FROM bookings WHERE workshop_id = ?", [$id]);
        DB::delete("DELETE FROM sessions WHERE workshop_id = ?", [$id]);
        DB::delete("DELETE FROM schedules WHERE workshop_id = ?", [$id]);
        DB::delete("DELETE FROM workshops WHERE id = ? AND instructor_id = ?", [$id, $userID]);

        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }

    // POST /api/v1/my-workshops/:id/submit-review
    public function submitForReview(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $workshop = Workshop::where('id', $id)
            ->where('instructor_id', $userID)
            ->where('status', '!=', WorkshopStatus::ARCHIVED)
            ->first();

        if (!$workshop) {
            return response()->json(['message' => 'Taller no encontrado o sin permisos'], 404);
        }
        if ($workshop->approval_status === ApprovalStatus::PENDING_REVIEW) {
            return response()->json(['message' => 'El taller ya está en revisión'], 409);
        }

        $previousValues = $request->input('previous_values');

        $instructor = DB::selectOne(
            "SELECT COALESCE(p.name, u.email) as name
             FROM users u LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = ?",
            [$userID]
        );
        $instructorName = $instructor?->name ?? '';

        $fillData = [
            'approval_status'    => ApprovalStatus::PENDING_REVIEW,
            'admin_observations' => null,
        ];
        // Solo pisar pending_changes si viene explícitamente en el body.
        // Si ya fue seteado por el PUT previo (flujo borrador), se conserva.
        if ($request->has('previous_values')) {
            $fillData['pending_changes'] = $previousValues ?: null;
        }
        $workshop->fill($fillData);
        $workshop->notifyContext = [
            'action'           => 'submit_review',
            'instructor_name'  => $instructorName,
        ];
        $workshop->save();

        return response()->json(['data' => ['id' => $id, 'approval_status' => ApprovalStatus::PENDING_REVIEW]]);
    }
}
