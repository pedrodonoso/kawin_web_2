<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Notifica a los estudiantes con reservas confirmadas cuando un taller
 * publicado es modificado por el tallerista.
 */
class WorkshopUpdatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $workshopId,
        public readonly string $workshopTitle,
        public readonly bool   $pendingReview,
    ) {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $message = $this->pendingReview
            ? "El taller \"{$this->workshopTitle}\" tiene cambios pendientes de revisión"
            : "El taller \"{$this->workshopTitle}\" ha sido actualizado";

        return [
            'type'          => 'workshop_updated',
            'workshop_id'   => $this->workshopId,
            'workshop_title'=> $this->workshopTitle,
            'pending_review'=> $this->pendingReview,
            'message'       => $message,
        ];
    }
}
