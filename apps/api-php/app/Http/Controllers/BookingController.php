<?php

namespace App\Http\Controllers;

use App\Notifications\BookingCancelledNotification;
use App\Notifications\NewBookingNotification;
use App\Services\PusherService;
use App\Services\WebPushService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class BookingController extends Controller
{
    // POST /api/v1/bookings
    public function store(Request $request): JsonResponse
    {
        $studentID = $this->userId($request);

        $this->validate($request, [
            'workshop_id' => 'required|string',
        ]);

        $workshopInfo = DB::selectOne(
            "SELECT type, price, capacity, instructor_id::text as instructor_id
             FROM workshops WHERE id = ? AND status = 'published'",
            [$request->input('workshop_id')]
        );
        if (!$workshopInfo) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $price     = (float)$workshopInfo->price;
        $sessionID = null;

        if ($workshopInfo->type === 'class') {
            if (!$request->input('session_id')) {
                return response()->json(['message' => 'session_id es requerido para talleres tipo class'], 400);
            }

            $sessionInfo = DB::selectOne(
                "SELECT workshop_id::text as workshop_id, cancelled FROM sessions WHERE id = ?",
                [$request->input('session_id')]
            );
            if (!$sessionInfo) {
                return response()->json(['message' => 'Sesión no encontrada'], 404);
            }
            if ($sessionInfo->workshop_id !== $request->input('workshop_id')) {
                return response()->json(['message' => 'La sesión no pertenece a este taller'], 400);
            }
            if ($sessionInfo->cancelled) {
                return response()->json(['message' => 'Esta clase fue cancelada'], 409);
            }

            $sid = $request->input('session_id');

            // Apply best active discount (session-specific takes priority)
            $discount = DiscountController::bestActiveDiscount($request->input('workshop_id'), $sid);
            [$finalPrice, $discountAmount] = DiscountController::applyDiscount($price, $discount);
            $commission = $finalPrice * 0.15;

            DB::beginTransaction();
            try {
                if ($workshopInfo->capacity !== null) {
                    $count = DB::selectOne(
                        "SELECT COUNT(*) as cnt FROM bookings WHERE session_id = ? AND status != 'cancelled'",
                        [$sid]
                    );
                    if ((int)($count->cnt ?? 0) >= (int)$workshopInfo->capacity) {
                        DB::rollBack();
                        return response()->json(['message' => 'No hay cupos disponibles para esta clase'], 409);
                    }
                }

                $booking = DB::selectOne(
                    "INSERT INTO bookings (student_id, workshop_id, session_id, status, payment_status, amount, commission)
                     VALUES (?, ?, ?, 'confirmed', 'pending', ?, ?)
                     RETURNING id",
                    [$studentID, $request->input('workshop_id'), $sid, $finalPrice, $commission]
                );

                // Increment discount uses_count
                if ($discount) {
                    DB::update(
                        "UPDATE discounts SET uses_count = uses_count + 1 WHERE id = ?",
                        [$discount->id]
                    );
                }

                DB::commit();
                $sessionID = $sid;
            } catch (\Throwable $e) {
                DB::rollBack();
                return response()->json(['message' => 'Error al crear reserva: ' . $e->getMessage()], 500);
            }
        } else {
            // Apply best active discount (workshop-wide only for non-class types)
            $discount = DiscountController::bestActiveDiscount($request->input('workshop_id'), null);
            [$finalPrice, $discountAmount] = DiscountController::applyDiscount($price, $discount);
            $commission = $finalPrice * 0.15;

            $booking = DB::selectOne(
                "INSERT INTO bookings (student_id, workshop_id, status, payment_status, amount, commission)
                 VALUES (?, ?, 'confirmed', 'pending', ?, ?)
                 RETURNING id",
                [$studentID, $request->input('workshop_id'), $finalPrice, $commission]
            );

            if ($discount) {
                DB::update(
                    "UPDATE discounts SET uses_count = uses_count + 1 WHERE id = ?",
                    [$discount->id]
                );
            }
        }

        // ----------------------------------------------------------------
        // Notify instructor (queued via Redis)
        // ----------------------------------------------------------------
        $this->notifyInstructor($booking->id, $workshopInfo->instructor_id, $request->input('workshop_id'), $sessionID, $studentID, $finalPrice);

        return response()->json(['data' => [
            'id'              => $booking->id,
            'workshop_id'     => $request->input('workshop_id'),
            'session_id'      => $sessionID,
            'status'          => 'confirmed',
            'payment_status'  => 'pending',
            'amount'          => $finalPrice,
            'original_amount' => $discountAmount > 0 ? $price : null,
            'discount_amount' => $discountAmount > 0 ? $discountAmount : null,
            'discount_label'  => $discount?->label,
            'commission'      => $commission,
        ]], 201);
    }

    // GET /api/v1/my-bookings
    public function myBookings(Request $request): JsonResponse
    {
        $studentID = $this->userId($request);

        $workshopFilter     = $request->query('workshop_id', '');
        $workshopSlugFilter = $request->query('workshop_slug', '');

        $sql = "SELECT b.id, b.workshop_id, w.title as workshop_title, w.slug as workshop_slug,
                       b.session_id::text as session_id, b.status, b.payment_status, b.amount,
                       COALESCE(s.starts_at::text, '') as session_date,
                       COALESCE(s.schedule_id::text, '') as schedule_id,
                       COALESCE((s.starts_at AT TIME ZONE 'UTC')::date::text, '') as session_day,
                       b.created_at::text as created_at,
                       COALESCE(s.online_url, w.online_url, '') as online_url
                FROM bookings b
                JOIN workshops w ON w.id = b.workshop_id
                LEFT JOIN sessions s ON s.id = b.session_id
                WHERE b.student_id = ?";

        $bindings = [$studentID];

        if ($workshopFilter !== '') {
            $sql .= " AND b.workshop_id = ?";
            $bindings[] = $workshopFilter;
        } elseif ($workshopSlugFilter !== '') {
            $sql .= " AND w.slug = ?";
            $bindings[] = $workshopSlugFilter;
        }

        $sql .= " ORDER BY b.created_at DESC LIMIT 50";

        return response()->json(['data' => DB::select($sql, $bindings)]);
    }

    // GET /api/v1/instructor-bookings
    public function instructorBookings(Request $request): JsonResponse
    {
        $instructorID    = $this->userId($request);
        $workshopFilter  = $request->query('workshop_id', '');
        $statusFilter    = $request->query('status', '');
        $fromFilter      = $request->query('from', '');
        $toFilter        = $request->query('to', '');

        $sql = "SELECT b.id as booking_id, b.workshop_id, w.title as workshop_title,
                       COALESCE(p.name, u.email) as student_name,
                       COALESCE(
                           s.starts_at::text,
                           (SELECT ns.starts_at::text FROM sessions ns
                            WHERE ns.workshop_id = b.workshop_id AND ns.schedule_id IS NULL
                            ORDER BY ns.starts_at ASC LIMIT 1),
                           ''
                       ) as session_date,
                       b.status, b.payment_status, b.amount, b.created_at::text as created_at
                FROM bookings b
                JOIN workshops w ON w.id = b.workshop_id
                JOIN users u ON u.id = b.student_id
                LEFT JOIN profiles p ON p.user_id = b.student_id
                LEFT JOIN sessions s ON s.id = b.session_id
                WHERE w.instructor_id = ?";

        $bindings = [$instructorID];

        if ($workshopFilter !== '') {
            $sql .= " AND b.workshop_id = ?";
            $bindings[] = $workshopFilter;
        }
        if ($statusFilter !== '') {
            $sql .= " AND b.status = ?";
            $bindings[] = $statusFilter;
        }
        if ($fromFilter !== '') {
            $sql .= " AND b.created_at >= ?::date";
            $bindings[] = $fromFilter;
        }
        if ($toFilter !== '') {
            $sql .= " AND b.created_at < (?::date + interval '1 day')";
            $bindings[] = $toFilter;
        }

        $sql .= " ORDER BY b.created_at DESC LIMIT 100";

        return response()->json(['data' => DB::select($sql, $bindings)]);
    }

    // POST /api/v1/bookings/:id/cancel
    public function cancel(Request $request, string $id): JsonResponse
    {
        $studentID = $this->userId($request);

        $bookingInfo = DB::selectOne(
            "SELECT b.workshop_id::text as workshop_id, b.status, b.payment_status,
                    COALESCE((s.starts_at AT TIME ZONE 'UTC')::date::text, '') as starts_at_str
             FROM bookings b
             LEFT JOIN sessions s ON s.id = b.session_id
             WHERE b.id = ? AND b.student_id = ?",
            [$id, $studentID]
        );
        if (!$bookingInfo) {
            return response()->json(['message' => 'Reserva no encontrada'], 404);
        }

        $error = $this->validateBookingTransition($bookingInfo->status, 'cancelled');
        if ($error) {
            return response()->json(['message' => "No se puede cancelar esta reserva: {$error}"], 409);
        }

        $sessionDate    = Carbon::now('UTC');
        if ($bookingInfo->starts_at_str !== '') {
            try {
                $sessionDate = Carbon::createFromFormat('Y-m-d', $bookingInfo->starts_at_str, 'UTC');
            } catch (\Throwable $e) {}
        }

        $zone             = $this->commissionZone($sessionDate);
        $newPaymentStatus = $bookingInfo->payment_status === 'paid' ? 'refunded' : $bookingInfo->payment_status;

        DB::update(
            "UPDATE bookings
             SET status = 'cancelled', payment_status = ?,
                 cancelled_reason = 'student_request', commission_absorbed_by = ?
             WHERE id = ?",
            [$newPaymentStatus, $zone, $id]
        );

        $this->notifyCancellation($id, $bookingInfo->workshop_id, $studentID, $bookingInfo->starts_at_str, 'student_request');

        return response()->json(['data' => [
            'id'                     => $id,
            'workshop_id'            => $bookingInfo->workshop_id,
            'status'                 => 'cancelled',
            'payment_status'         => $newPaymentStatus,
            'cancelled_reason'       => 'student_request',
            'commission_absorbed_by' => $zone,
        ]]);
    }

    // POST /api/v1/bookings/:id/migrate
    public function migrate(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $this->validate($request, ['target_session_id' => 'required|string']);

        $bookingInfo = DB::selectOne(
            "SELECT b.workshop_id::text as workshop_id, b.session_id::text as old_session_id,
                    b.status, w.instructor_id::text as owner_id
             FROM bookings b
             JOIN workshops w ON w.id = b.workshop_id
             WHERE b.id = ?",
            [$id]
        );
        if (!$bookingInfo) {
            return response()->json(['message' => 'Reserva no encontrada'], 404);
        }
        if ($bookingInfo->owner_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para modificar esta reserva'], 403);
        }

        $error = $this->validateBookingTransition($bookingInfo->status, 'confirmed');
        if ($error) {
            return response()->json(['message' => "No se puede migrar esta reserva: {$error}"], 409);
        }

        $targetInfo = DB::selectOne(
            "SELECT workshop_id::text as workshop_id, cancelled FROM sessions WHERE id = ?",
            [$request->input('target_session_id')]
        );
        if (!$targetInfo) {
            return response()->json(['message' => 'Sesión destino no encontrada'], 404);
        }
        if ($targetInfo->workshop_id !== $bookingInfo->workshop_id) {
            return response()->json(['message' => 'La sesión destino no pertenece al mismo taller'], 400);
        }
        if ($targetInfo->cancelled) {
            return response()->json(['message' => 'La sesión destino está cancelada'], 409);
        }

        $capacity = DB::selectOne(
            "SELECT capacity FROM workshops WHERE id = ?",
            [$bookingInfo->workshop_id]
        );
        if ($capacity && $capacity->capacity !== null) {
            $count = DB::selectOne(
                "SELECT COUNT(*) as cnt FROM bookings WHERE session_id = ? AND status != 'cancelled'",
                [$request->input('target_session_id')]
            );
            if ((int)($count->cnt ?? 0) >= (int)$capacity->capacity) {
                return response()->json(['message' => 'No hay cupos disponibles en la sesión destino'], 409);
            }
        }

        DB::update(
            "UPDATE bookings SET session_id = ?, migrated_from_session_id = ?, status = 'confirmed' WHERE id = ?",
            [$request->input('target_session_id'), $bookingInfo->old_session_id, $id]
        );

        return response()->json(['data' => [
            'id'                       => $id,
            'session_id'               => $request->input('target_session_id'),
            'migrated_from_session_id' => $bookingInfo->old_session_id,
            'status'                   => 'confirmed',
        ]]);
    }

    // POST /api/v1/bookings/:id/refund
    public function refund(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $bookingInfo = DB::selectOne(
            "SELECT b.workshop_id::text as workshop_id, b.status, b.payment_status,
                    w.instructor_id::text as owner_id,
                    COALESCE(s.starts_at::date::text, '') as starts_at_str
             FROM bookings b
             JOIN workshops w ON w.id = b.workshop_id
             LEFT JOIN sessions s ON s.id = b.session_id
             WHERE b.id = ?",
            [$id]
        );
        if (!$bookingInfo) {
            return response()->json(['message' => 'Reserva no encontrada'], 404);
        }
        if ($bookingInfo->owner_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para modificar esta reserva'], 403);
        }

        $error = $this->validateBookingTransition($bookingInfo->status, 'cancelled');
        if ($error) {
            return response()->json(['message' => "No se puede reembolsar esta reserva: {$error}"], 409);
        }

        $sessionDate = Carbon::now('UTC');
        if ($bookingInfo->starts_at_str !== '') {
            try {
                $sessionDate = Carbon::createFromFormat('Y-m-d', $bookingInfo->starts_at_str, 'UTC');
            } catch (\Throwable $e) {}
        }

        $zone = $this->commissionZone($sessionDate);

        DB::update(
            "UPDATE bookings
             SET status = 'cancelled', payment_status = 'refunded',
                 cancelled_reason = 'schedule_change', commission_absorbed_by = ?
             WHERE id = ?",
            [$zone, $id]
        );

        $this->notifyCancellation($id, $bookingInfo->workshop_id, null, $bookingInfo->starts_at_str, 'schedule_change');

        return response()->json(['data' => [
            'id'                     => $id,
            'workshop_id'            => $bookingInfo->workshop_id,
            'status'                 => 'cancelled',
            'payment_status'         => 'refunded',
            'cancelled_reason'       => 'schedule_change',
            'commission_absorbed_by' => $zone,
        ]]);
    }

    // -----------------------------------------------------------------------
    // Booking state machine
    // -----------------------------------------------------------------------

    protected function validateBookingTransition(string $from, string $to): ?string
    {
        $transitions = [
            'pending'   => ['confirmed', 'cancelled'],
            'confirmed' => ['cancelled'],
            'cancelled' => [],
        ];

        if (!isset($transitions[$from])) {
            return "estado de reserva desconocido: {$from}";
        }
        if (!in_array($to, $transitions[$from], true)) {
            return "transición de estado inválida: {$from} → {$to}";
        }

        return null;
    }

    // -----------------------------------------------------------------------
    // Instructor notification helper
    // -----------------------------------------------------------------------

    private function notifyCancellation(
        string $bookingId,
        string $workshopId,
        ?string $studentId,
        string $startsAtStr,
        string $reason
    ): void {
        try {
            $workshop = DB::selectOne(
                "SELECT title, instructor_id::text as instructor_id FROM workshops WHERE id = ?",
                [$workshopId]
            );
            $student = $studentId ? DB::selectOne(
                "SELECT COALESCE(p.name, u.email) as name
                 FROM users u LEFT JOIN profiles p ON p.user_id = u.id
                 WHERE u.id = ?",
                [$studentId]
            ) : null;

            $booking = DB::selectOne(
                "SELECT amount FROM bookings WHERE id = ?",
                [$bookingId]
            );

            $instructor = new \App\Models\User();
            $instructor->id = $workshop->instructor_id;

            $notification = new BookingCancelledNotification(
                bookingId:      $bookingId,
                workshopTitle:  $workshop?->title ?? '',
                studentName:    $student?->name ?? '',
                sessionDate:    $startsAtStr ?: null,
                amount:         (float)($booking?->amount ?? 0),
                reason:         $reason,
            );

            Notification::send($instructor, $notification);

            // Push real-time event to instructor via WebSocket + mobile push
            $payload = $notification->toDatabase($instructor);
            app(PusherService::class)->notifyUser($workshop->instructor_id, $payload);
            app(WebPushService::class)->notifyUser($workshop->instructor_id, WebPushService::buildPayload($payload));
        } catch (\Throwable $e) {
            \Log::warning('Failed to dispatch BookingCancelledNotification: ' . $e->getMessage());
        }
    }

    private function notifyInstructor(
        string $bookingId,
        string $instructorId,
        string $workshopId,
        ?string $sessionId,
        string $studentId,
        float $amount
    ): void {
        try {
            // Gather data for the notification
            $workshop = DB::selectOne("SELECT title FROM workshops WHERE id = ?", [$workshopId]);
            $student  = DB::selectOne(
                "SELECT COALESCE(p.name, u.email) as name
                 FROM users u LEFT JOIN profiles p ON p.user_id = u.id
                 WHERE u.id = ?",
                [$studentId]
            );
            $sessionDate = null;
            if ($sessionId) {
                $sess = DB::selectOne(
                    "SELECT starts_at::text as starts_at FROM sessions WHERE id = ?",
                    [$sessionId]
                );
                $sessionDate = $sess?->starts_at;
            }

            // Use Notification facade with a plain notifiable wrapper
            $instructor = new \App\Models\User();
            $instructor->id = $instructorId;

            $notification = new NewBookingNotification(
                bookingId: $bookingId,
                workshopTitle: $workshop?->title ?? '',
                studentName: $student?->name ?? '',
                sessionDate: $sessionDate,
                amount: $amount,
            );

            Notification::send($instructor, $notification);

            // Push real-time event to instructor via WebSocket + mobile push
            $payload = $notification->toDatabase($instructor);
            app(PusherService::class)->notifyUser($instructorId, $payload);
            app(WebPushService::class)->notifyUser($instructorId, WebPushService::buildPayload($payload));
        } catch (\Throwable $e) {
            // Notification failures must never break booking creation
            \Log::warning('Failed to dispatch NewBookingNotification: ' . $e->getMessage());
        }
    }
}
