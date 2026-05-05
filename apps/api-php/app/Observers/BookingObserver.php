<?php

namespace App\Observers;

use App\Models\Booking;
use App\Models\User;
use App\Notifications\NewBookingNotification;
use App\Notifications\NewBookingStudentNotification;
use App\Services\PusherService;
use App\Services\WebPushService;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification as NotificationFacade;

class BookingObserver
{
    public function __construct(
        private readonly PusherService  $pusher,
        private readonly WebPushService $webPush,
    ) {}

    public function created(Booking $booking): void
    {
        try {
            $workshop = DB::selectOne(
                "SELECT title, slug, instructor_id::text as instructor_id FROM workshops WHERE id = ?",
                [$booking->workshop_id]
            );
            if (!$workshop) return;

            $student = DB::selectOne(
                "SELECT COALESCE(p.name, u.email) as name
                 FROM users u LEFT JOIN profiles p ON p.user_id = u.id
                 WHERE u.id = ?",
                [$booking->student_id]
            );

            $sessionDate = null;
            if ($booking->session_id) {
                $sess        = DB::selectOne("SELECT starts_at::text as starts_at FROM sessions WHERE id = ?", [$booking->session_id]);
                $sessionDate = $sess?->starts_at;
            }

            $workshopId    = (string) $booking->workshop_id;
            $workshopTitle = $workshop->title;
            $workshopSlug  = $workshop->slug;
            $studentName   = $student?->name ?? '';

            // Notify instructor
            $this->send($workshop->instructor_id, new NewBookingNotification(
                bookingId:     $booking->id,
                workshopId:    $workshopId,
                workshopTitle: $workshopTitle,
                workshopSlug:  $workshopSlug,
                studentName:   $studentName,
                sessionDate:   $sessionDate,
                amount:        (float) $booking->amount,
            ));

            // Notify student
            $this->send($booking->student_id, new NewBookingStudentNotification(
                bookingId:     $booking->id,
                workshopId:    $workshopId,
                workshopTitle: $workshopTitle,
                workshopSlug:  $workshopSlug,
                sessionDate:   $sessionDate,
                amount:        (float) $booking->amount,
            ));
        } catch (\Throwable $e) {
            \Log::warning('BookingObserver::created failed: ' . $e->getMessage());
        }
    }

    private function send(string $userId, Notification $notification): void
    {
        $notifiable     = new User();
        $notifiable->id = $userId;

        NotificationFacade::send($notifiable, $notification);

        $payload = $notification->toDatabase($notifiable);
        $this->pusher->notifyUser($userId, $payload);

        try {
            $this->webPush->notifyUser($userId, WebPushService::buildPayload($payload));
        } catch (\Throwable $e) {
            \Log::warning("WebPush failed for user {$userId}: " . $e->getMessage());
        }
    }
}
