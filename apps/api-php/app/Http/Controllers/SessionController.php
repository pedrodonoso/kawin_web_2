<?php

namespace App\Http\Controllers;

use App\Constants\BookingStatus;
use App\Constants\CancelReason;
use App\Constants\CommissionZone;
use App\Constants\PaymentStatus;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SessionController extends Controller
{
    // POST /api/v1/sessions/materialize
    public function materialize(Request $request): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === 'admin';

        $this->validate($request, [
            'workshop_id' => 'required|string',
            'schedule_id' => 'required|string',
            'date'        => 'required|string',
        ]);

        try {
            $sessionDate = Carbon::createFromFormat('Y-m-d', $request->input('date'), 'UTC');
        } catch (\Throwable $e) {
            return response()->json(['message' => 'date inválido, usa YYYY-MM-DD'], 400);
        }

        $schedInfo = DB::selectOne(
            "SELECT w.instructor_id::text as owner_id, s.workshop_id::text as workshop_id,
                    s.time_start::text as time_start, s.duration_min
             FROM schedules s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = ? AND s.workshop_id = ?",
            [$request->input('schedule_id'), $request->input('workshop_id')]
        );
        if (!$schedInfo) {
            return response()->json(['message' => 'Schedule no encontrado o no pertenece al taller'], 404);
        }
        if (!$isAdmin && $schedInfo->owner_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para materializar sesiones de este taller'], 403);
        }

        $schedDetails = DB::selectOne(
            "SELECT array_to_string(days_of_week, ',') as days_str,
                    valid_from, valid_until::text as valid_until
             FROM schedules WHERE id = ?",
            [$request->input('schedule_id')]
        );

        $daySet = array_flip($this->parseIntCSV($schedDetails->days_str ?? ''));
        if (!isset($daySet[(int)$sessionDate->dayOfWeek])) {
            return response()->json(['message' => 'El schedule no aplica en el día indicado'], 400);
        }

        $validFrom = Carbon::parse($schedDetails->valid_from, 'UTC')->startOfDay();
        if ($sessionDate->lt($validFrom)) {
            return response()->json(['message' => 'La fecha es anterior al inicio del schedule'], 400);
        }

        if (!empty($schedDetails->valid_until)) {
            try {
                $validUntil = Carbon::createFromFormat('Y-m-d', substr($schedDetails->valid_until, 0, 10), 'UTC');
                if ($sessionDate->gt($validUntil)) {
                    return response()->json(['message' => 'La fecha es posterior al fin del schedule'], 400);
                }
            } catch (\Throwable $e) {}
        }

        // Build starts_at / ends_at
        $parts    = explode(':', $schedInfo->time_start);
        $startsAt = $request->input('date') . 'T' . sprintf('%02d:%02d:00', (int)($parts[0] ?? 0), (int)($parts[1] ?? 0)) . 'Z';
        $endsAt   = Carbon::parse($startsAt, 'UTC')
                        ->addMinutes((int)$schedInfo->duration_min)
                        ->format('Y-m-d\TH:i:s\Z');

        $onlineURL = $request->input('online_url', '') ?: null;

        // Upsert
        $existing = DB::selectOne(
            "INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at, online_url)
             VALUES (?, ?, ?, ?, NULLIF(?, ''))
             ON CONFLICT (workshop_id, schedule_id, starts_at) DO NOTHING
             RETURNING id, cancelled, COALESCE(online_url,'') as online_url",
            [
                $request->input('workshop_id'),
                $request->input('schedule_id'),
                $startsAt,
                $endsAt,
                $onlineURL,
            ]
        );

        $created = (bool)$existing;

        if (!$existing) {
            $existing = DB::selectOne(
                "SELECT id, cancelled, COALESCE(online_url,'') as online_url
                 FROM sessions
                 WHERE workshop_id = ? AND schedule_id = ? AND starts_at = ?",
                [$request->input('workshop_id'), $request->input('schedule_id'), $startsAt]
            );
            if (!$existing) {
                return response()->json(['message' => 'Error al materializar sesión'], 500);
            }
        }

        return response()->json([
            'data' => [
                'id'          => $existing->id,
                'workshop_id' => $request->input('workshop_id'),
                'schedule_id' => $request->input('schedule_id'),
                'starts_at'   => $startsAt,
                'ends_at'     => $endsAt,
                'cancelled'   => (bool)$existing->cancelled,
                'online_url'  => $existing->online_url,
                'created'     => $created,
            ],
        ], $created ? 201 : 200);
    }

    // PATCH /api/v1/sessions/:id/url
    public function updateUrl(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === 'admin';

        $owner = DB::selectOne(
            "SELECT w.instructor_id::text as instructor_id FROM sessions s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = ?",
            [$id]
        );
        if (!$owner) {
            return response()->json(['message' => 'Sesión no encontrada'], 404);
        }
        if (!$isAdmin && $owner->instructor_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para editar esta sesión'], 403);
        }

        $url = $request->input('online_url', '') ?: null;

        DB::update("UPDATE sessions SET online_url = NULLIF(?, '') WHERE id = ?", [$url, $id]);

        return response()->json(['online_url' => $url ?? '']);
    }

    // POST /api/v1/sessions/:id/reactivate
    public function reactivate(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === 'admin';

        $sessionInfo = DB::selectOne(
            "SELECT s.workshop_id::text as workshop_id, w.instructor_id::text as owner_id, s.cancelled
             FROM sessions s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = ?",
            [$id]
        );
        if (!$sessionInfo) {
            return response()->json(['message' => 'Sesión no encontrada'], 404);
        }
        if (!$isAdmin && $sessionInfo->owner_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para reactivar esta sesión'], 403);
        }
        if (!$sessionInfo->cancelled) {
            return response()->json(['message' => 'La sesión no está cancelada'], 409);
        }

        DB::update("UPDATE sessions SET cancelled = false WHERE id = ?", [$id]);

        return response()->json(['data' => ['session_id' => $id, 'cancelled' => false]]);
    }

    // POST /api/v1/sessions/cancel
    public function cancel(Request $request): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === 'admin';

        $this->validate($request, ['session_id' => 'required|string']);
        $sessionID = $request->input('session_id');

        $sessionInfo = DB::selectOne(
            "SELECT s.workshop_id::text as workshop_id, w.instructor_id::text as owner_id,
                    s.starts_at::date::text as starts_at_str, s.cancelled as already_cancelled
             FROM sessions s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = ?",
            [$sessionID]
        );
        if (!$sessionInfo) {
            return response()->json(['message' => 'Sesión no encontrada'], 404);
        }
        if (!$isAdmin && $sessionInfo->owner_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para cancelar sesiones de este taller'], 403);
        }
        if ($sessionInfo->already_cancelled) {
            return response()->json(['message' => 'Esta sesión ya fue cancelada'], 409);
        }

        $activeBookings = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings WHERE session_id = ? AND status != ?",
            [$sessionID, BookingStatus::CANCELLED]
        );
        if ((int)($activeBookings->cnt ?? 0) > 0) {
            $count = (int)$activeBookings->cnt;
            return response()->json([
                'message'         => "Esta sesión tiene {$count} reserva(s) activa(s) y no puede cancelarse.",
                'active_bookings' => $count,
            ], 409);
        }

        $sessionDate = Carbon::createFromFormat('Y-m-d', $sessionInfo->starts_at_str, 'UTC');

        DB::beginTransaction();
        try {
            DB::update("UPDATE sessions SET cancelled = true WHERE id = ?", [$sessionID]);

            $bookingIDs = DB::select(
                "SELECT id FROM bookings WHERE session_id = ? AND status != ?",
                [$sessionID, BookingStatus::CANCELLED]
            );

            $zone        = $this->commissionZone($sessionDate);
            $byInstructor = 0;
            $byPlatform   = 0;

            foreach ($bookingIDs as $b) {
                DB::update(
                    "UPDATE bookings
                     SET status = ?, payment_status = ?,
                         cancelled_reason = ?, commission_absorbed_by = ?
                     WHERE id = ?",
                    [BookingStatus::CANCELLED, PaymentStatus::REFUNDED, CancelReason::INSTRUCTOR_CANCEL, $zone, $b->id]
                );
                $zone === CommissionZone::INSTRUCTOR ? $byInstructor++ : $byPlatform++;
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al cancelar sesión: ' . $e->getMessage()], 500);
        }

        return response()->json(['data' => [
            'session_id'                        => $sessionID,
            'cancelled_bookings'                => count($bookingIDs),
            'commission_absorbed_by_instructor' => $byInstructor,
            'commission_absorbed_by_platform'   => $byPlatform,
        ]]);
    }
}
