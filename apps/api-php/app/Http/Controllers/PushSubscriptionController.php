<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PushSubscriptionController extends Controller
{
    // POST /api/v1/push/subscribe
    public function subscribe(Request $request): JsonResponse
    {
        $userId   = $this->userId($request);
        $endpoint = $request->input('endpoint');
        $p256dh   = $request->input('keys.p256dh');
        $auth     = $request->input('keys.auth');

        if (!$endpoint || !$p256dh || !$auth) {
            return response()->json(['message' => 'endpoint, keys.p256dh and keys.auth are required'], 422);
        }

        DB::statement(
            "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
             VALUES (?::uuid, ?, ?, ?)
             ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth",
            [$userId, $endpoint, $p256dh, $auth]
        );

        return response()->json(['data' => ['subscribed' => true]]);
    }

    // DELETE /api/v1/push/subscribe
    public function unsubscribe(Request $request): JsonResponse
    {
        $userId   = $this->userId($request);
        $endpoint = $request->input('endpoint');

        if (!$endpoint) {
            return response()->json(['message' => 'endpoint is required'], 422);
        }

        DB::delete(
            "DELETE FROM push_subscriptions WHERE user_id = ?::uuid AND endpoint = ?",
            [$userId, $endpoint]
        );

        return response()->json(['data' => ['unsubscribed' => true]]);
    }
}
