<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class NewBookingNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string  $bookingId,
        public readonly string  $workshopId,
        public readonly string  $workshopTitle,
        public readonly string  $workshopSlug,
        public readonly string  $studentName,
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
        return [
            'type'           => 'new_booking',
            'booking_id'     => $this->bookingId,
            'workshop_id'    => $this->workshopId,
            'workshop_slug'  => $this->workshopSlug,
            'workshop_title' => $this->workshopTitle,
            'student_name'   => $this->studentName,
            'session_date'   => $this->sessionDate,
            'amount'         => $this->amount,
            'message'        => "{$this->studentName} reservó \"{$this->workshopTitle}\"" .
                                ($this->sessionDate ? " para el {$this->sessionDate}" : ''),
        ];
    }
}
