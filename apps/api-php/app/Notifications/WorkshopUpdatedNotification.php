<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class WorkshopUpdatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $workshopId,
        public readonly string $workshopTitle,
        public readonly string $workshopSlug,
        public readonly string $recipientRole = 'student',  // 'student' | 'instructor'
        public readonly bool   $pendingReview = false,
    ) {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        if ($this->recipientRole === 'instructor') {
            $message = "Tu taller \"{$this->workshopTitle}\" fue editado por un administrador";
        } elseif ($this->pendingReview) {
            $message = "El taller \"{$this->workshopTitle}\" tiene cambios pendientes de revisión";
        } else {
            $message = "El taller \"{$this->workshopTitle}\" ha sido actualizado";
        }

        return [
            'type'           => 'workshop_updated',
            'workshop_id'    => $this->workshopId,
            'workshop_slug'  => $this->workshopSlug,
            'workshop_title' => $this->workshopTitle,
            'recipient_role' => $this->recipientRole,
            'pending_review' => $this->pendingReview,
            'message'        => $message,
        ];
    }
}
