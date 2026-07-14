<?php

namespace App\Services;

use GuzzleHttp\Client as GuzzleClient;
use Pusher\Pusher;

class PusherService
{
    private Pusher $client;

    public function __construct()
    {
        $this->client = new Pusher(
            env('PUSHER_APP_KEY', 'kawin-key'),
            env('PUSHER_APP_SECRET', 'kawin-secret'),
            env('PUSHER_APP_ID', 'kawin-app'),
            [
                'host'   => env('PUSHER_HOST', 'soketi'),
                'port'   => (int) env('PUSHER_PORT', 6001),
                'scheme' => 'http',
                'useTLS' => false,
            ],
            // Hard timeouts so an unreachable/slow realtime host can never block
            // the (single-threaded) web request long enough to reset the socket.
            new GuzzleClient(['connect_timeout' => 1.5, 'timeout' => 3.0])
        );
    }

    /**
     * Push a notification event to a specific user's private channel.
     * The payload mirrors what the database channel stores so the frontend
     * can render it immediately without a DB round-trip.
     */
    public function notifyUser(string $userId, array $data): void
    {
        try {
            $this->client->trigger(
                'private-user.' . $userId,
                'notification',
                $data
            );
        } catch (\Throwable $e) {
            \Log::warning('Pusher push failed: ' . $e->getMessage());
        }
    }

    /**
     * Generate a Pusher channel auth signature for private channels.
     */
    public function authorizeChannel(string $channelName, string $socketId): string
    {
        return $this->client->authorizeChannel($channelName, $socketId);
    }
}
