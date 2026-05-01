<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Notifica a los administradores cuando un tallerista envía un taller a revisión.
 */
class WorkshopSubmittedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $workshopId,
        public readonly string $workshopTitle,
        public readonly string $instructorName,
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
            'type'            => 'workshop_submitted',
            'workshop_id'     => $this->workshopId,
            'workshop_title'  => $this->workshopTitle,
            'instructor_name' => $this->instructorName,
            'message'         => "{$this->instructorName} envió \"{$this->workshopTitle}\" a revisión",
        ];
    }
}
