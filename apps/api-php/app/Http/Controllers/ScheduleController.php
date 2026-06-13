<?php

namespace App\Http\Controllers;

use App\Constants\BookingStatus;
use App\Constants\UserRole;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScheduleController extends Controller
{
    // POST /api/v1/workshops/:id/schedules
    public function store(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === UserRole::ADMIN;

        $owner = DB::selectOne(
            "SELECT instructor_id::text as instructor_id FROM workshops WHERE id = ?",
            [$id]
        );
        if (!$owner) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }
        if (!$isAdmin && $owner->instructor_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para modificar este taller'], 403);
        }

        $this->validate($request, [
            'days_of_week' => 'required|array|min:1',
            'time_start'   => 'required|string',
        ]);

        $days = $request->input('days_of_week');
        foreach ($days as $d) {
            if ($d < 0 || $d > 6) {
                return response()->json(['message' => 'days_of_week debe contener valores entre 0 (Dom) y 6 (Sáb)'], 400);
            }
        }

        if (strlen($request->input('time_start')) < 4) {
            return response()->json(['message' => 'time_start inválido, usa formato HH:MM'], 400);
        }

        $durationMin = (int)$request->input('duration_min', 60) ?: 60;
        $validFrom   = $request->input('valid_from') ?: \Carbon\Carbon::now()->format('Y-m-d');

        try {
            Carbon::createFromFormat('Y-m-d', $validFrom);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'valid_from inválido, usa YYYY-MM-DD'], 400);
        }

        $validUntil = $request->input('valid_until') ?: null;
        if ($validUntil) {
            try { Carbon::createFromFormat('Y-m-d', $validUntil); }
            catch (\Throwable $e) { $validUntil = null; }
        }

        $pgArray = '{' . implode(',', $days) . '}';

        $row = DB::selectOne(
            "INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from, valid_until)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING id",
            [$id, $pgArray, $request->input('time_start'), $durationMin, $validFrom, $validUntil]
        );

        return response()->json(['data' => ['id' => $row->id]], 201);
    }

    // GET /api/v1/workshops/:id/schedules
    public function index(string $id): JsonResponse
    {
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
            [$id]
        );

        foreach ($rows as $r) {
            $r->days_of_week = $this->parseIntCSV($r->days_of_week ?? '');
        }

        return response()->json(['data' => $rows]);
    }

    // DELETE /api/v1/schedules/:id  (soft-delete: set valid_until = today)
    public function destroy(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === UserRole::ADMIN;

        $owner = DB::selectOne(
            "SELECT w.instructor_id::text as instructor_id
             FROM schedules s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = ?",
            [$id]
        );
        if (!$owner) {
            return response()->json(['message' => 'Schedule no encontrado'], 404);
        }
        if (!$isAdmin && $owner->instructor_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para modificar este schedule'], 403);
        }

        $affected = DB::update(
            "UPDATE schedules SET valid_until = CURRENT_DATE - INTERVAL '1 day' WHERE id = ? AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)",
            [$id]
        );

        if ($affected === 0) {
            return response()->json(['data' => ['id' => $id, 'already_closed' => true]]);
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    // PUT /api/v1/schedules/:id  (immutable: closes old, creates new)
    public function update(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === UserRole::ADMIN;

        $ownership = DB::selectOne(
            "SELECT w.instructor_id::text as owner_id, s.workshop_id::text as workshop_id
             FROM schedules s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = ?",
            [$id]
        );
        if (!$ownership) {
            return response()->json(['message' => 'Schedule no encontrado'], 404);
        }
        if (!$isAdmin && $ownership->owner_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para modificar este schedule'], 403);
        }

        $this->validate($request, [
            'days_of_week' => 'required|array|min:1',
            'time_start'   => 'required|string',
            'change_date'  => 'required|string',
        ]);

        try {
            $changeDate = Carbon::createFromFormat('Y-m-d', $request->input('change_date'), 'UTC');
        } catch (\Throwable $e) {
            return response()->json(['message' => 'change_date inválido, usa YYYY-MM-DD'], 400);
        }

        $validUntilOld = $changeDate->copy()->subDay()->format('Y-m-d');
        $durationMin   = (int)$request->input('duration_min', 60) ?: 60;
        $pgArray       = '{' . implode(',', $request->input('days_of_week')) . '}';

        DB::beginTransaction();
        try {
            DB::update("UPDATE schedules SET valid_until = ? WHERE id = ?", [$validUntilOld, $id]);

            $validUntilNew = $request->input('valid_until') ?: null;
            if ($validUntilNew) {
                try { Carbon::createFromFormat('Y-m-d', $validUntilNew); }
                catch (\Throwable $e) { $validUntilNew = null; }
            }

            $row = DB::selectOne(
                "INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from, valid_until)
                 VALUES (?, ?, ?, ?, ?, ?)
                 RETURNING id",
                [
                    $ownership->workshop_id,
                    $pgArray,
                    $request->input('time_start'),
                    $durationMin,
                    $changeDate->format('Y-m-d'),
                    $validUntilNew,
                ]
            );

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al actualizar schedule: ' . $e->getMessage()], 500);
        }

        return response()->json(['data' => [
            'old_schedule_id' => $id,
            'new_schedule_id' => $row->id,
        ]]);
    }

    // GET /api/v1/schedules/:id/affected-bookings?change_date=YYYY-MM-DD
    public function affectedBookings(Request $request, string $id): JsonResponse
    {
        $userID        = $this->userId($request);
        $changeDateStr = $request->query('change_date', '');

        if (!$changeDateStr) {
            return response()->json(['message' => 'change_date requerido'], 400);
        }
        try {
            Carbon::createFromFormat('Y-m-d', $changeDateStr);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'change_date inválido, usa YYYY-MM-DD'], 400);
        }

        $isAdmin = $this->userRole($request) === UserRole::ADMIN;

        $owner = DB::selectOne(
            "SELECT w.instructor_id::text as instructor_id
             FROM schedules s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = ?",
            [$id]
        );
        if (!$owner) {
            return response()->json(['message' => 'Schedule no encontrado'], 404);
        }
        if (!$isAdmin && $owner->instructor_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso'], 403);
        }

        $rows = DB::select(
            "SELECT b.id as booking_id, COALESCE(p.name, u.email) as student_name,
                    s.starts_at::date::text as session_date,
                    s.starts_at::time::text as session_time,
                    b.amount
             FROM bookings b
             JOIN sessions s ON s.id = b.session_id
             JOIN users u ON u.id = b.student_id
             LEFT JOIN profiles p ON p.user_id = b.student_id
             WHERE s.schedule_id = ?
               AND s.starts_at >= ?::date
               AND b.status != ?
             ORDER BY s.starts_at",
            [$id, $changeDateStr, BookingStatus::CANCELLED]
        );

        foreach ($rows as $row) {
            try {
                $sd = Carbon::createFromFormat('Y-m-d', $row->session_date, 'UTC');
                $row->commission_zone = $this->commissionZone($sd);
            } catch (\Throwable $e) {
                $row->commission_zone = 'instructor';
            }
        }

        return response()->json(['data' => $rows]);
    }

    // POST /api/v1/schedules/:id/bulk-action
    public function bulkAction(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === UserRole::ADMIN;

        $this->validate($request, [
            'action'      => 'required|string|in:migrate_all,refund_all',
            'change_date' => 'required|string',
        ]);

        if ($request->input('action') === 'migrate_all' && !$request->input('new_schedule_id')) {
            return response()->json(['message' => 'new_schedule_id requerido para migrate_all'], 400);
        }

        try {
            Carbon::createFromFormat('Y-m-d', $request->input('change_date'));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'change_date inválido, usa YYYY-MM-DD'], 400);
        }

        $owner = DB::selectOne(
            "SELECT w.instructor_id::text as instructor_id
             FROM schedules s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = ?",
            [$id]
        );
        if (!$owner) {
            return response()->json(['message' => 'Schedule no encontrado'], 404);
        }
        if (!$isAdmin && $owner->instructor_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso'], 403);
        }

        $newSchedTimeStart   = '';
        $newSchedDurationMin = 0;

        if ($request->input('action') === 'migrate_all') {
            $newSched = DB::selectOne(
                "SELECT time_start::text as time_start, duration_min FROM schedules WHERE id = ?",
                [$request->input('new_schedule_id')]
            );
            if (!$newSched) {
                return response()->json(['message' => 'new_schedule_id no encontrado'], 404);
            }
            $newSchedTimeStart   = $newSched->time_start;
            $newSchedDurationMin = (int)$newSched->duration_min;
        }

        $affected = DB::select(
            "SELECT b.id as booking_id, b.session_id::text as session_id,
                    s.starts_at::date as session_date, b.workshop_id::text as workshop_id
             FROM bookings b
             JOIN sessions s ON s.id = b.session_id
             WHERE s.schedule_id = ?
               AND s.starts_at >= ?::date
               AND b.status != ?",
            [$id, $request->input('change_date'), BookingStatus::CANCELLED]
        );

        DB::beginTransaction();
        try {
            $migrated = 0;
            $refunded = 0;

            foreach ($affected as $r) {
                $sessionDate = Carbon::parse($r->session_date, 'UTC');

                if ($request->input('action') === 'refund_all') {
                    $zone = $this->commissionZone($sessionDate);
                    DB::update(
                        "UPDATE bookings
                         SET status = 'cancelled', payment_status = 'refunded',
                             cancelled_reason = 'schedule_change', commission_absorbed_by = ?
                         WHERE id = ?",
                        [$zone, $r->booking_id]
                    );
                    $refunded++;
                } else {
                    $targetDateStr = $sessionDate->format('Y-m-d');
                    $parts         = explode(':', $newSchedTimeStart);
                    $startsAt      = $targetDateStr . 'T' . sprintf('%02d:%02d:00', (int)($parts[0] ?? 0), (int)($parts[1] ?? 0)) . 'Z';
                    $startTime     = Carbon::parse($startsAt, 'UTC');
                    $endsAt        = $startTime->copy()->addMinutes($newSchedDurationMin)->format('Y-m-d\TH:i:s\Z');

                    $targetRow = DB::selectOne(
                        "INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at)
                         VALUES (?, ?, ?, ?)
                         ON CONFLICT (workshop_id, schedule_id, starts_at)
                         DO UPDATE SET workshop_id = EXCLUDED.workshop_id
                         RETURNING id",
                        [$r->workshop_id, $request->input('new_schedule_id'), $startsAt, $endsAt]
                    );

                    $cancelledCheck = DB::selectOne(
                        "SELECT cancelled FROM sessions WHERE id = ?",
                        [$targetRow->id]
                    );
                    if ($cancelledCheck && $cancelledCheck->cancelled) {
                        DB::rollBack();
                        return response()->json([
                            'message' => "La sesión destino está cancelada para la fecha {$targetDateStr}",
                        ], 409);
                    }

                    DB::update(
                        "UPDATE bookings
                         SET session_id = ?, migrated_from_session_id = ?, status = 'confirmed'
                         WHERE id = ?",
                        [$targetRow->id, $r->session_id, $r->booking_id]
                    );
                    $migrated++;
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error en operación bulk: ' . $e->getMessage()], 500);
        }

        return response()->json(['data' => ['migrated' => $migrated, 'refunded' => $refunded]]);
    }
}
