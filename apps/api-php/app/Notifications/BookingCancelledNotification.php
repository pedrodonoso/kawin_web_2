<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Notifica al tallerista cuando un estudiante cancela una reserva,
 * o al estudiante cuando el tallerista genera un reembolso por cambio de horario.
 */
class BookingCancelledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string  $bookingId,
        public readonly string  $workshopTitle,
        public readonly string  $studentName,
        public readonly ?string $sessionDate,
        public readonly float   $amount,
        public readonly string  $reason,   // 'student_request' | 'schedule_change'
    ) {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $message = $this->reason === 'schedule_change'
            ? "{$this->studentName} recibió un reembolso en \"{$this->workshopTitle}\" por cambio de horario"
            : "{$this->studentName} canceló su reserva en \"{$this->workshopTitle}\"" .
              ($this->sessionDate ? " (sesión del {$this->sessionDate})" : '');

        return [
            'type'           => 'booking_cancelled',
            'booking_id'     => $this->bookingId,
            'workshop_title' => $this->workshopTitle,
            'student_name'   => $this->studentName,
            'session_date'   => $this->sessionDate,
            'amount'         => $this->amount,
            'reason'         => $this->reason,
            'message'        => $message,
        ];
    }
}
