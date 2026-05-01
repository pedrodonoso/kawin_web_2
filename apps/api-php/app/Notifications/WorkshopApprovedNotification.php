<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Notifica al tallerista y a los estudiantes con reservas confirmadas
 * cuando un administrador aprueba (o re-aprueba) un taller.
 */
class WorkshopApprovedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $workshopId,
        public readonly string $workshopTitle,
        public readonly string $instructorName,
        /**
         * 'instructor' | 'student'
         * Permite personalizar el mensaje según el destinatario.
         */
        public readonly string $recipientRole = 'instructor',
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
            'type'             => 'workshop_approved',
            'workshop_id'      => $this->workshopId,
            'workshop_title'   => $this->workshopTitle,
            'instructor_name'  => $this->instructorName,
            'recipient_role'   => $this->recipientRole,
            'message'          => $message,
        ];
    }
}
