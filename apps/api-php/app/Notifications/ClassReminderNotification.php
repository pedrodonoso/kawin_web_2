<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Recuerda al estudiante que tiene una clase al día siguiente.
 * Despachada por el comando SendClassReminders (cron diario).
 */
class ClassReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string  $workshopTitle,
        public readonly string  $sessionDate,   // ISO datetime string
        public readonly ?string $onlineUrl,
        public readonly ?string $location,
    ) {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $where = $this->onlineUrl
            ? "Online: {$this->onlineUrl}"
            : ($this->location ?? 'Consulta los detalles en tu reserva');

        return [
            'type'           => 'class_reminder',
            'workshop_title' => $this->workshopTitle,
            'session_date'   => $this->sessionDate,
            'online_url'     => $this->onlineUrl,
            'location'       => $this->location,
            'message'        => "Mañana tienes \"{$this->workshopTitle}\" — {$where}",
        ];
    }
}
