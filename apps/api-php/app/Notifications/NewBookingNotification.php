<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Notifica al tallerista cuando un estudiante hace una nueva reserva.
 *
 * Canal activo: database (in-app).
 * Canal futuro: mail (descomentar en via() cuando se configure SMTP).
 *
 * La notificación se despacha de forma asíncrona usando la cola Redis
 * configurada en QUEUE_CONNECTION.
 */
class NewBookingNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string  $bookingId,
        public readonly string  $workshopTitle,
        public readonly string  $studentName,
        public readonly ?string $sessionDate,
        public readonly float   $amount,
    ) {
        $this->onQueue('notifications');
    }

    /**
     * Canales de entrega.
     * Añadir 'mail' aquí cuando se quiera activar el email.
     */
    public function via(object $notifiable): array
    {
        return ['database'];
        // return ['database', 'mail'];  // activar para email
    }

    /**
     * Payload guardado en la tabla notifications.data (JSON).
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'type'          => 'new_booking',
            'booking_id'    => $this->bookingId,
            'workshop_title'=> $this->workshopTitle,
            'student_name'  => $this->studentName,
            'session_date'  => $this->sessionDate,
            'amount'        => $this->amount,
            'message'       => "{$this->studentName} reservó \"{$this->workshopTitle}\"" .
                               ($this->sessionDate ? " para el {$this->sessionDate}" : ''),
        ];
    }

    /**
     * Plantilla de email (activar en via() para usarla).
     * Requiere MAIL_MAILER configurado en .env.
     */
    // public function toMail(object $notifiable): \Illuminate\Notifications\Messages\MailMessage
    // {
    //     return (new \Illuminate\Notifications\Messages\MailMessage)
    //         ->subject("Nueva reserva en \"{$this->workshopTitle}\"")
    //         ->greeting("¡Hola!")
    //         ->line("{$this->studentName} acaba de reservar tu taller \"{$this->workshopTitle}\".")
    //         ->when($this->sessionDate, fn ($mail) =>
    //             $mail->line("Fecha de la sesión: {$this->sessionDate}")
    //         )
    //         ->line("Monto: $" . number_format($this->amount, 0, ',', '.') . " CLP")
    //         ->action('Ver reservas', url('/dashboard/reservas'))
    //         ->line('¡Gracias por usar Kawin!');
    // }
}
