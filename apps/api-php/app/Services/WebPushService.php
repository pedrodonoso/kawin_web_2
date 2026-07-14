<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class WebPushService
{
    private WebPush $client;

    public function __construct()
    {
        $this->client = new WebPush(
            [
                'VAPID' => [
                    'subject'    => env('VAPID_SUBJECT', 'mailto:noreply@kawin.app'),
                    'publicKey'  => env('VAPID_PUBLIC_KEY', ''),
                    'privateKey' => env('VAPID_PRIVATE_KEY', ''),
                ],
            ],
            [],   // default notification options
            // Per-request timeout (seconds): a slow/unreachable push endpoint must
            // never block the web request. Runs single-threaded under `php -S`.
            5
        );
    }

    /**
     * Send a push notification to all active subscriptions of a user.
     *
     * $data must contain at least:
     *   'title'   string  — notification title
     *   'body'    string  — notification body (shown under the title)
     *   'type'    string  — used by the SW for routing / deduplication
     *   'url'     string  — path to open on click
     */
    public function notifyUser(string $userId, array $data): void
    {
        if (empty(env('VAPID_PUBLIC_KEY'))) {
            return;
        }

        try {
            $subs = DB::select(
                "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?::uuid",
                [$userId]
            );

            if (empty($subs)) {
                return;
            }

            foreach ($subs as $sub) {
                $this->client->queueNotification(
                    Subscription::create([
                        'endpoint' => $sub->endpoint,
                        'keys'     => ['p256dh' => $sub->p256dh, 'auth' => $sub->auth],
                    ]),
                    json_encode($data)
                );
            }

            foreach ($this->client->flush() as $report) {
                if (!$report->isSuccess() && $report->isSubscriptionExpired()) {
                    $endpoint = (string) $report->getRequest()->getUri();
                    DB::delete(
                        "DELETE FROM push_subscriptions WHERE endpoint = ?",
                        [$endpoint]
                    );
                }
            }
        } catch (\Throwable $e) {
            \Log::warning('WebPush failed for user ' . $userId . ': ' . $e->getMessage());
        }
    }

    /** Map a notification data array (DB payload) to a push payload. */
    public static function buildPayload(array $data, string $defaultUrl = '/'): array
    {
        $urlMap = [
            'new_booking'        => '/dashboard/reservas',
            'booking_cancelled'  => '/dashboard/reservas',
            'class_reminder'     => '/mis-reservas',
            'workshop_submitted' => '/dashboard',
            'workshop_approved'  => ($data['recipient_role'] ?? '') === 'student'
                                        ? '/mis-reservas'
                                        : '/dashboard',
            'workshop_updated'   => '/mis-reservas',
        ];

        $type = $data['type'] ?? 'notification';

        return [
            'title' => 'kwin',
            'body'  => $data['message'] ?? 'Nueva notificación',
            'type'  => $type,
            'url'   => $urlMap[$type] ?? $defaultUrl,
        ];
    }
}
