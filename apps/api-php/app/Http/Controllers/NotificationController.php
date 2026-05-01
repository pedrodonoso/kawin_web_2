<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    // GET /api/v1/my-notifications
    // Returns the 50 most recent notifications for the authenticated user, unread first.
    public function index(Request $request): JsonResponse
    {
        $userID = $this->userId($request);

        $rows = DB::select(
            "SELECT id, type, data, read_at, created_at
             FROM notifications
             WHERE notifiable_type = ? AND notifiable_id = ?::uuid
             ORDER BY read_at IS NOT NULL, created_at DESC
             LIMIT 50",
            ['App\\Models\\User', $userID]
        );

        foreach ($rows as $row) {
            $row->data    = json_decode($row->data, true);
            $row->is_read = $row->read_at !== null;
        }

        $unreadCount = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM notifications
             WHERE notifiable_type = ? AND notifiable_id = ?::uuid AND read_at IS NULL",
            ['App\\Models\\User', $userID]
        );

        return response()->json([
            'data'         => $rows,
            'unread_count' => (int)($unreadCount->cnt ?? 0),
        ]);
    }

    // POST /api/v1/notifications/:id/read
    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $affected = DB::update(
            "UPDATE notifications
             SET read_at = NOW()
             WHERE id = ? AND notifiable_type = ? AND notifiable_id = ?::uuid AND read_at IS NULL",
            [$id, 'App\\Models\\User', $userID]
        );

        if ($affected === 0) {
            // Either already read, belongs to another user, or doesn't exist — return 200 either way
            return response()->json(['data' => ['id' => $id, 'read' => true]]);
        }

        return response()->json(['data' => ['id' => $id, 'read' => true]]);
    }

    // POST /api/v1/notifications/read-all
    public function markAllAsRead(Request $request): JsonResponse
    {
        $userID = $this->userId($request);

        $affected = DB::update(
            "UPDATE notifications
             SET read_at = NOW()
             WHERE notifiable_type = ? AND notifiable_id = ?::uuid AND read_at IS NULL",
            ['App\\Models\\User', $userID]
        );

        return response()->json(['data' => ['marked_read' => $affected]]);
    }
}
