<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class WorkshopApprovedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $workshopId,
        public readonly string $workshopTitle,
        public readonly string $workshopSlug,
        public readonly string $instructorName,
        public readonly string $recipientRole = 'instructor',  // 'instructor' | 'student'
    ) {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $message = $this->recipientRole === 'student'
            ? "El taller \"{$this->workshopTitle}\" ha sido actualizado por {$this->instructorName}"
            : "Tu taller \"{$this->workshopTitle}\" fue aprobado y está publicado";

        return [
            'type'            => 'workshop_approved',
            'workshop_id'     => $this->workshopId,
            'workshop_slug'   => $this->workshopSlug,
            'workshop_title'  => $this->workshopTitle,
            'instructor_name' => $this->instructorName,
            'recipient_role'  => $this->recipientRole,
            'message'         => $message,
        ];
    }
}
