<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class NewBookingStudentNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string  $bookingId,
        public readonly string  $workshopId,
        public readonly string  $workshopTitle,
        public readonly string  $workshopSlug,
        public readonly ?string $sessionDate,
        public readonly float   $amount,
    ) {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $message = "Tu reserva en \"{$this->workshopTitle}\" fue confirmada" .
                   ($this->sessionDate ? " para el {$this->sessionDate}" : '');

        return [
            'type'           => 'booking_confirmed',
            'booking_id'     => $this->bookingId,
            'workshop_id'    => $this->workshopId,
            'workshop_slug'  => $this->workshopSlug,
            'workshop_title' => $this->workshopTitle,
            'session_date'   => $this->sessionDate,
            'amount'         => $this->amount,
            'message'        => $message,
        ];
    }
}
