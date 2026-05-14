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
        $userID = $this->userId($request);

        $workshops = DB::select(
            "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price, w.currency,
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
             LEFT JOIN profiles p ON p.user_id = w.instructor_id
             WHERE w.instructor_id = ?
             ORDER BY w.created_at DESC",
            [BookingStatus::CONFIRMED, $userID]
        );

        return response()->json(['data' => $workshops]);
    }

    // GET /api/v1/my-workshops/:id
    public function show(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $w = DB::selectOne(
            "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price, w.currency,
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
                    COALESCE(p.bio,'') as instructor_bio
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             LEFT JOIN profiles p ON p.user_id = w.instructor_id
             WHERE w.id = ? AND w.instructor_id = ?",
            [$id, $userID]
        );

        if (!$w) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

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
                (float)$request->input('price', 0),
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

        $newStatus   = $request->input('status', WorkshopStatus::DRAFT) ?: WorkshopStatus::DRAFT;
        $wasPublished = $workshop->status === WorkshopStatus::PUBLISHED;

        if (!$isAdmin
            && $newStatus === WorkshopStatus::PUBLISHED
            && !$wasPublished
            && $workshop->approval_status !== ApprovalStatus::APPROVED
        ) {
            return response()->json([
                'message' => 'El taller debe ser aprobado por un administrador antes de publicarse',
            ], 403);
        }

        $bc = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings WHERE workshop_id = ? AND status = ?",
            [$id, BookingStatus::CONFIRMED]
        );
        $confirmedBookings = (int)($bc->cnt ?? 0);

        $price    = $confirmedBookings > 0 ? $workshop->price    : (float)$request->input('price', 0);
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

        $sensitiveChanged = !$isAdmin && $wasPublished && (
            $newTitle    !== $workshop->title ||
            $newDesc     !== $workshop->description ||
            $newModality !== $workshop->modality
        );

        if ($sensitiveChanged) {
            $proposed = [];
            if ($newTitle    !== $workshop->title)       $proposed['title']       = $newTitle;
            if ($newDesc     !== $workshop->description) $proposed['description'] = $newDesc;
            if ($newModality !== $workshop->modality)    $proposed['modality']    = $newModality;

            $workshop->fill([
                'price'           => $price,
                'currency'        => $currency,
                'capacity'        => $capacity,
                'location'        => $request->input('location', ''),
                'address'         => $request->input('address', '') ?: null,
                'lat'             => $newLat,
                'lng'             => $newLng,
                'online_url'      => $request->input('online_url', ''),
                'notes'           => $request->input('notes', '') ?: null,
                'category_id'     => $catID,
                'pending_changes' => $proposed,
                'approval_status' => ApprovalStatus::PENDING_REVIEW,
            ]);
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
        }

        $workshop->notifyContext = [
            'action'            => 'update',
            'was_published'     => $wasPublished,
            'is_admin'          => $isAdmin,
            'sensitive_changed' => $sensitiveChanged,
        ];
        $workshop->save();

        if ($confirmedBookings === 0) {
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
        $userID = $this->userId($request);

        $exists = DB::selectOne(
            "SELECT true as ok FROM workshops WHERE id = ? AND instructor_id = ? AND status != ?",
            [$id, $userID, WorkshopStatus::ARCHIVED]
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
            "UPDATE workshops SET status = ?, updated_at = NOW()
             WHERE id = ? AND instructor_id = ? AND status != ?",
            [WorkshopStatus::ARCHIVED, $id, $userID, WorkshopStatus::ARCHIVED]
        );

        return response()->json(['data' => ['id' => $id, 'status' => WorkshopStatus::ARCHIVED]]);
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

        $workshop->fill([
            'approval_status'    => ApprovalStatus::PENDING_REVIEW,
            'admin_observations' => null,
            'pending_changes'    => $previousValues ?: null,
        ]);
        $workshop->notifyContext = [
            'action'           => 'submit_review',
            'instructor_name'  => $instructorName,
        ];
        $workshop->save();

        return response()->json(['data' => ['id' => $id, 'approval_status' => ApprovalStatus::PENDING_REVIEW]]);
    }
}
