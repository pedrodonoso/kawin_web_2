<?php

namespace App\Observers;

use App\Constants\BookingStatus;
use App\Constants\UserRole;
use App\Models\User;
use App\Models\Workshop;
use App\Notifications\WorkshopApprovedNotification;
use App\Notifications\WorkshopSubmittedNotification;
use App\Notifications\WorkshopUpdatedNotification;
use App\Services\PusherService;
use App\Services\WebPushService;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification as NotificationFacade;

class WorkshopObserver
{
    public function __construct(
        private readonly PusherService  $pusher,
        private readonly WebPushService $webPush,
    ) {}

    public function updated(Workshop $workshop): void
    {
        $ctx    = $workshop->notifyContext ?? [];
        $action = $ctx['action'] ?? 'update';

        try {
            match ($action) {
                'approve'       => $this->onApproved($workshop),
                'submit_review' => $this->onSubmittedForReview($workshop, $ctx),
                'admin_update'  => $this->onAdminUpdate($workshop, $ctx),
                default         => $this->onInstructorUpdate($workshop, $ctx),
            };
        } catch (\Throwable $e) {
            \Log::warning("WorkshopObserver::updated [{$action}] failed: " . $e->getMessage());
        }
    }

    // Admin approved → notify instructor + students
    private function onApproved(Workshop $workshop): void
    {
        $instructorName = $this->resolveUserName($workshop->instructor_id);

        $this->send($workshop->instructor_id, new WorkshopApprovedNotification(
            workshopId:     $workshop->id,
            workshopTitle:  $workshop->title,
            workshopSlug:   $workshop->slug,
            instructorName: $instructorName,
            recipientRole:  'instructor',
        ));

        foreach ($this->confirmedStudents($workshop->id) as $studentId) {
            $this->send($studentId, new WorkshopApprovedNotification(
                workshopId:     $workshop->id,
                workshopTitle:  $workshop->title,
                workshopSlug:   $workshop->slug,
                instructorName: $instructorName,
                recipientRole:  'student',
            ));
        }
    }

    // Instructor submitted for review → notify admins
    private function onSubmittedForReview(Workshop $workshop, array $ctx): void
    {
        $instructorName = $ctx['instructor_name'] ?? $this->resolveUserName($workshop->instructor_id);

        foreach ($this->adminIds() as $adminId) {
            $this->send($adminId, new WorkshopSubmittedNotification(
                workshopId:     $workshop->id,
                workshopTitle:  $workshop->title,
                workshopSlug:   $workshop->slug,
                instructorName: $instructorName,
            ));
        }
    }

    // Admin directly edited a published workshop → notify instructor + students
    private function onAdminUpdate(Workshop $workshop, array $ctx): void
    {
        if (!($ctx['was_published'] ?? false)) return;

        $this->send($workshop->instructor_id, new WorkshopUpdatedNotification(
            workshopId:    $workshop->id,
            workshopTitle: $workshop->title,
            workshopSlug:  $workshop->slug,
            recipientRole: 'instructor',
            pendingReview: false,
        ));

        foreach ($this->confirmedStudents($workshop->id) as $studentId) {
            $this->send($studentId, new WorkshopUpdatedNotification(
                workshopId:    $workshop->id,
                workshopTitle: $workshop->title,
                workshopSlug:  $workshop->slug,
                recipientRole: 'student',
                pendingReview: false,
            ));
        }
    }

    // Instructor edited their own published workshop → notify admins (if sensitive) + students
    private function onInstructorUpdate(Workshop $workshop, array $ctx): void
    {
        if (!($ctx['was_published'] ?? false)) return;

        $sensitiveChanged = $ctx['sensitive_changed'] ?? false;

        if ($sensitiveChanged) {
            $instructorName = $this->resolveUserName($workshop->instructor_id);
            foreach ($this->adminIds() as $adminId) {
                $this->send($adminId, new WorkshopSubmittedNotification(
                    workshopId:     $workshop->id,
                    workshopTitle:  $workshop->title,
                    workshopSlug:   $workshop->slug,
                    instructorName: $instructorName,
                ));
            }
        }

        foreach ($this->confirmedStudents($workshop->id) as $studentId) {
            $this->send($studentId, new WorkshopUpdatedNotification(
                workshopId:    $workshop->id,
                workshopTitle: $workshop->title,
                workshopSlug:  $workshop->slug,
                recipientRole: 'student',
                pendingReview: $sensitiveChanged,
            ));
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

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

    private function confirmedStudents(string $workshopId): array
    {
        return array_column(
            DB::select(
                "SELECT DISTINCT student_id::text as student_id FROM bookings WHERE workshop_id = ? AND status = ?",
                [$workshopId, BookingStatus::CONFIRMED]
            ),
            'student_id'
        );
    }

    private function adminIds(): array
    {
        return array_column(
            DB::select("SELECT id::text as id FROM users WHERE role = ?", [UserRole::ADMIN]),
            'id'
        );
    }

    private function resolveUserName(string $userId): string
    {
        $row = DB::selectOne(
            "SELECT COALESCE(p.name, u.email) as name FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?",
            [$userId]
        );
        return $row?->name ?? '';
    }
}
