<?php

namespace App\Http\Controllers;

use App\Services\PusherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BroadcastingController extends Controller
{
    // POST /api/v1/broadcasting/auth
    // Authorizes the authenticated user to subscribe to their private channel.
    public function auth(Request $request): JsonResponse
    {
        $userId      = $this->userId($request);
        $channelName = $request->input('channel_name', '');
        $socketId    = $request->input('socket_id', '');

        // Each user may only subscribe to their own channel
        if ($channelName !== 'private-user.' . $userId) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $auth = app(PusherService::class)->authorizeChannel($channelName, $socketId);

        return response()->json(json_decode($auth, true));
    }
}
