<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\WorkshopSubmittedNotification;
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
                    COALESCE(w.online_url,'') as online_url,
                    COALESCE(w.cover_image_url,'') as cover_image_url,
                    w.status, w.approval_status,
                    COALESCE(w.admin_observations,'') as admin_observations,
                    COALESCE(w.created_at::text,'') as created_at,
                    COALESCE(c.id::text,'') as category_id,
                    COALESCE(c.name,'') as category_name,
                    COALESCE(c.slug,'') as category_slug,
                    COALESCE(p.name,'') as instructor_name,
                    (SELECT COUNT(*) FROM bookings b
                     WHERE b.workshop_id = w.id AND b.status = 'confirmed') AS bookings_count
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             LEFT JOIN profiles p ON p.user_id = w.instructor_id
             WHERE w.instructor_id = ?
             ORDER BY w.created_at DESC",
            [$userID]
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
                    COALESCE(w.online_url,'') as online_url,
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

        if ($w->type === 'class') {
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
            "SELECT COUNT(*) as cnt FROM bookings WHERE workshop_id = ? AND status = 'confirmed'",
            [$w->id]
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

        $row = DB::selectOne(
            "INSERT INTO workshops
                (instructor_id, category_id, title, slug, description, type, modality,
                 price, currency, capacity, location, online_url, status, approval_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'not_submitted')
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
                $request->input('online_url', ''),
            ]
        );

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
        $userID = $this->userId($request);

        $this->validate($request, [
            'title'    => 'required|string',
            'type'     => 'required|string',
            'modality' => 'required|string',
        ]);

        $current = DB::selectOne(
            "SELECT type, status, approval_status, price, capacity,
                    title, COALESCE(description,'') as description, modality
             FROM workshops WHERE id = ? AND instructor_id = ?",
            [$id, $userID]
        );
        if (!$current) {
            return response()->json(['message' => 'Taller no encontrado o sin permisos'], 404);
        }

        $newStatus = $request->input('status', 'draft') ?: 'draft';

        // Un taller ya publicado puede guardarse libremente.
        // Solo se bloquea intentar PUBLICAR un taller que aún no ha sido aprobado.
        if ($newStatus === 'published'
            && $current->status !== 'published'
            && $current->approval_status !== 'approved'
        ) {
            return response()->json([
                'message' => 'El taller debe ser aprobado por un administrador antes de publicarse',
            ], 403);
        }

        $bc = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings WHERE workshop_id = ? AND status = 'confirmed'",
            [$id]
        );
        $confirmedBookings = (int)($bc->cnt ?? 0);

        $price    = $confirmedBookings > 0 ? $current->price    : (float)$request->input('price', 0);
        $capacity = $confirmedBookings > 0 ? $current->capacity : $request->input('capacity');

        if ($newStatus === 'draft' && $current->status === 'published') {
            if ($this->activeBookingsCount($id) > 0) {
                $count = $this->activeBookingsCount($id);
                return response()->json([
                    'message'         => "El taller tiene {$count} reserva(s) activa(s). No se puede cambiar a borrador.",
                    'active_bookings' => $count,
                ], 409);
            }
        }

        if ($request->input('type') !== $current->type) {
            return response()->json(['message' => 'El tipo de taller no puede modificarse después de creado'], 400);
        }

        $catID    = $request->input('category_id') ?: null;
        $currency = $request->input('currency', 'CLP') ?: 'CLP';

        $newTitle    = $request->input('title');
        $newDesc     = $request->input('description', '');
        $newModality = $request->input('modality');

        // Si el taller ya está publicado y el instructor modifica campos sensibles,
        // los cambios NO se aplican de inmediato: se guardan en pending_changes para revisión.
        $isPublished = $current->status === 'published';
        $sensitiveChanged = $isPublished && (
            $newTitle    !== $current->title ||
            $newDesc     !== $current->description ||
            $newModality !== $current->modality
        );

        if ($sensitiveChanged) {
            // Acumular sólo los campos que realmente cambiaron
            $proposed = [];
            if ($newTitle    !== $current->title)       $proposed['title']       = $newTitle;
            if ($newDesc     !== $current->description) $proposed['description'] = $newDesc;
            if ($newModality !== $current->modality)    $proposed['modality']    = $newModality;

            $affected = DB::update(
                "UPDATE workshops
                 SET price=?, currency=?, capacity=?, location=?, online_url=?, category_id=?,
                     pending_changes=?::jsonb, approval_status='pending_review',
                     updated_at=NOW()
                 WHERE id=? AND instructor_id=?",
                [
                    $price,
                    $currency,
                    $capacity,
                    $request->input('location', ''),
                    $request->input('online_url', ''),
                    $catID,
                    json_encode($proposed),
                    $id,
                    $userID,
                ]
            );
        } else {
            $affected = DB::update(
                "UPDATE workshops
                 SET title=?, description=?, type=?, modality=?,
                     price=?, currency=?, capacity=?, location=?,
                     online_url=?, category_id=?, status=?, updated_at=NOW()
                 WHERE id=? AND instructor_id=?",
                [
                    $newTitle,
                    $newDesc,
                    $current->type,
                    $newModality,
                    $price,
                    $currency,
                    $capacity,
                    $request->input('location', ''),
                    $request->input('online_url', ''),
                    $catID,
                    $newStatus,
                    $id,
                    $userID,
                ]
            );
        }

        if ($affected === 0) {
            return response()->json(['message' => 'Taller no encontrado o sin permisos'], 404);
        }

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
            'approval_status' => $sensitiveChanged ? 'pending_review' : ($current->approval_status ?? 'not_submitted'),
        ]]);
    }

    // DELETE /api/v1/workshops/:id
    public function destroy(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $exists = DB::selectOne(
            "SELECT true as ok FROM workshops WHERE id = ? AND instructor_id = ? AND status != 'archived'",
            [$id, $userID]
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
            "UPDATE workshops SET status = 'archived', updated_at = NOW()
             WHERE id = ? AND instructor_id = ? AND status != 'archived'",
            [$id, $userID]
        );

        return response()->json(['data' => ['id' => $id, 'status' => 'archived']]);
    }

    // POST /api/v1/my-workshops/:id/submit-review
    public function submitForReview(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $current = DB::selectOne(
            "SELECT approval_status FROM workshops
             WHERE id = ? AND instructor_id = ? AND status != 'archived'",
            [$id, $userID]
        );
        if (!$current) {
            return response()->json(['message' => 'Taller no encontrado o sin permisos'], 404);
        }
        if ($current->approval_status === 'pending_review') {
            return response()->json(['message' => 'El taller ya está en revisión'], 409);
        }

        // Guardar snapshot de valores anteriores para que el admin vea qué cambió
        $previousValues = $request->input('previous_values');
        $pendingChanges = $previousValues ? json_encode($previousValues) : null;

        DB::update(
            "UPDATE workshops
             SET approval_status = 'pending_review', admin_observations = NULL,
                 pending_changes = ?::jsonb, updated_at = NOW()
             WHERE id = ? AND instructor_id = ?",
            [$pendingChanges, $id, $userID]
        );

        // Notify all admins
        try {
            $workshop = DB::selectOne("SELECT title FROM workshops WHERE id = ?", [$id]);
            $instructor = DB::selectOne(
                "SELECT COALESCE(p.name, u.email) as name
                 FROM users u LEFT JOIN profiles p ON p.user_id = u.id
                 WHERE u.id = ?",
                [$userID]
            );
            $admins = DB::select("SELECT id FROM users WHERE role = 'admin'");
            foreach ($admins as $admin) {
                $notifiable = new User();
                $notifiable->id = $admin->id;
                Notification::send($notifiable, new WorkshopSubmittedNotification(
                    workshopId:      $id,
                    workshopTitle:   $workshop?->title ?? '',
                    instructorName:  $instructor?->name ?? '',
                ));
            }
        } catch (\Throwable $e) {
            \Log::warning('Failed to dispatch WorkshopSubmittedNotification: ' . $e->getMessage());
        }

        return response()->json(['data' => ['id' => $id, 'approval_status' => 'pending_review']]);
    }
}
