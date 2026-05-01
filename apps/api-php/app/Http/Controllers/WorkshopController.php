<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkshopController extends Controller
{
    // GET /api/v1/workshops
    public function index(Request $request): JsonResponse
    {
        $q            = $request->query('q', '');
        $modality     = $request->query('modality', '');
        $type         = $request->query('type', '');
        $categorySlug = $request->query('category', '');

        $sql = "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                       w.type, w.modality, w.price, w.currency,
                       w.capacity, COALESCE(w.location,'') as location,
                       COALESCE(w.online_url,'') as online_url,
                       COALESCE(w.cover_image_url,'') as cover_image_url,
                       w.status, COALESCE(w.created_at::text,'') as created_at,
                       COALESCE(c.id::text,'') as category_id,
                       COALESCE(c.name,'') as category_name,
                       COALESCE(c.slug,'') as category_slug,
                       COALESCE(p.name,'') as instructor_name
                FROM workshops w
                LEFT JOIN categories c ON c.id = w.category_id
                LEFT JOIN profiles p ON p.user_id = w.instructor_id
                WHERE w.status = 'published'";

        $bindings = [];

        if ($q !== '') {
            $sql .= " AND (w.title ILIKE ? OR w.description ILIKE ?)";
            $bindings[] = "%{$q}%";
            $bindings[] = "%{$q}%";
        }
        if ($modality !== '') {
            $sql .= " AND w.modality = ?";
            $bindings[] = $modality;
        }
        if ($type !== '') {
            $sql .= " AND w.type = ?";
            $bindings[] = $type;
        }
        if ($categorySlug !== '') {
            $sql .= " AND c.slug = ?";
            $bindings[] = $categorySlug;
        }

        $sql .= " ORDER BY w.created_at DESC LIMIT 50";

        $workshops = DB::select($sql, $bindings);

        return response()->json(['data' => $workshops, 'total' => count($workshops)]);
    }

    // GET /api/v1/workshops/:id  (accepts UUID or slug)
    public function show(string $id): JsonResponse
    {
        $w = DB::selectOne(
            "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price, w.currency,
                    w.capacity, COALESCE(w.location,'') as location,
                    COALESCE(w.online_url,'') as online_url,
                    COALESCE(w.cover_image_url,'') as cover_image_url,
                    w.status, COALESCE(w.created_at::text,'') as created_at,
                    COALESCE(c.id::text,'') as category_id,
                    COALESCE(c.name,'') as category_name,
                    COALESCE(c.slug,'') as category_slug,
                    w.instructor_id::text as instructor_id,
                    COALESCE(p.name,'') as instructor_name,
                    COALESCE(p.bio,'') as instructor_bio,
                    COALESCE(p.instagram_url,'') as instructor_instagram,
                    COALESCE(p.facebook_url,'') as instructor_facebook,
                    COALESCE(p.whatsapp,'') as instructor_whatsapp,
                    COALESCE(p.phone,'') as instructor_phone
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             LEFT JOIN profiles p ON p.user_id = w.instructor_id
             WHERE (w.id::text = ? OR w.slug = ?)",
            [$id, $id]
        );

        if (!$w) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        // Booking count
        $bc = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings WHERE workshop_id = ? AND status = 'confirmed'",
            [$w->id]
        );
        $w->bookings_count = (int)($bc->cnt ?? 0);

        if ($w->type === 'class') {
            $w->schedules = $this->loadScheduleRows($w->id);

            // Upcoming materialized sessions with booking count
            $sessions = DB::select(
                "SELECT s.id, s.starts_at::text as starts_at, s.ends_at::text as ends_at,
                        COALESCE(s.notes,'') as notes, COALESCE(s.online_url,'') as online_url,
                        COALESCE(COUNT(b.id) FILTER (WHERE b.status != 'cancelled'), 0)::int as booking_count
                 FROM sessions s
                 LEFT JOIN bookings b ON b.session_id = s.id
                 WHERE s.workshop_id = ?
                   AND s.schedule_id IS NOT NULL
                   AND s.cancelled = false
                   AND s.starts_at >= NOW()
                 GROUP BY s.id
                 ORDER BY s.starts_at",
                [$w->id]
            );

            // Compute spots_remaining
            foreach ($sessions as $session) {
                if ($w->capacity !== null) {
                    $remaining = max(0, (int)$w->capacity - (int)$session->booking_count);
                    $session->spots_remaining = $remaining;
                }
            }
            $w->sessions = $sessions;
        } else {
            $w->sessions = DB::select(
                "SELECT id, starts_at::text as starts_at, ends_at::text as ends_at,
                        cancelled, COALESCE(notes,'') as notes
                 FROM sessions WHERE workshop_id = ? AND schedule_id IS NULL ORDER BY starts_at",
                [$w->id]
            );
            $w->schedules = [];
        }

        return response()->json(['data' => $w]);
    }

    // GET /api/v1/workshops/:id/available-slots  (instructor only)
    public function availableSlots(Request $request, string $id): JsonResponse
    {
        $userID = $this->userId($request);

        $winfo = DB::selectOne(
            "SELECT instructor_id::text as instructor_id, capacity FROM workshops WHERE id = ?",
            [$id]
        );
        if (!$winfo) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }
        if ($winfo->instructor_id !== $userID) {
            return response()->json(['message' => 'No tienes permiso para ver este calendario'], 403);
        }

        $from = Carbon::now('UTC')->startOfDay();
        $to   = $from->copy()->addDays(56);

        if ($fs = $request->query('from')) {
            try { $from = Carbon::createFromFormat('Y-m-d', $fs, 'UTC'); } catch (\Throwable $e) {}
        }
        if ($ts = $request->query('to')) {
            try { $to = Carbon::createFromFormat('Y-m-d', $ts, 'UTC'); } catch (\Throwable $e) {}
        }

        $schedules   = $this->loadActiveSchedules($id, $from, $to);
        $materialized = $this->loadMaterializedSessions($id, $from, $to);
        $bookingCounts = $this->loadBookingCounts($id);

        $slots = $this->computeAvailableSlots(
            $schedules, $from, $to, $materialized, $bookingCounts, $winfo->capacity
        );

        return response()->json(['data' => $slots]);
    }

    // -----------------------------------------------------------------------
    // Slot engine helpers
    // -----------------------------------------------------------------------

    private function loadScheduleRows(string $workshopID): array
    {
        $rows = DB::select(
            "SELECT id, workshop_id,
                    array_to_string(days_of_week, ',') as days_of_week,
                    time_start::text as time_start, duration_min,
                    valid_from::text as valid_from, valid_until::text as valid_until,
                    created_at::text as created_at
             FROM schedules
             WHERE workshop_id = ?
               AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
             ORDER BY valid_from, time_start",
            [$workshopID]
        );

        return array_map(function ($r) {
            $r->days_of_week = $this->parseIntCSV($r->days_of_week ?? '');
            return $r;
        }, $rows);
    }

    private function loadActiveSchedules(string $workshopID, Carbon $from, Carbon $to): array
    {
        $rows = DB::select(
            "SELECT id, workshop_id,
                    array_to_string(days_of_week, ',') as days_str,
                    time_start::text as time_start, duration_min,
                    valid_from::text as valid_from, valid_until::text as valid_until
             FROM schedules
             WHERE workshop_id = ?
               AND valid_from <= ?
               AND (valid_until IS NULL OR valid_until >= ?)
             ORDER BY valid_from, time_start",
            [$workshopID, $to->format('Y-m-d'), $from->format('Y-m-d')]
        );

        return array_map(function ($r) {
            $r->days_of_week = $this->parseIntCSV($r->days_str ?? '');
            return $r;
        }, $rows);
    }

    private function loadMaterializedSessions(string $workshopID, Carbon $from, Carbon $to): array
    {
        $rows = DB::select(
            "SELECT id, schedule_id::text as schedule_id,
                    (starts_at AT TIME ZONE 'UTC')::date::text as date_str,
                    cancelled, COALESCE(online_url,'') as online_url
             FROM sessions
             WHERE workshop_id = ?
               AND schedule_id IS NOT NULL
               AND starts_at >= ?
               AND starts_at <= ?",
            [
                $workshopID,
                $from->format('Y-m-d'),
                $to->copy()->addDay()->format('Y-m-d'),
            ]
        );

        $map = [];
        foreach ($rows as $r) {
            $map[$r->schedule_id . ':' . $r->date_str] = $r;
        }
        return $map;
    }

    private function loadBookingCounts(string $workshopID): array
    {
        $rows = DB::select(
            "SELECT session_id::text as session_id, COUNT(*) as count
             FROM bookings
             WHERE workshop_id = ?
               AND session_id IS NOT NULL
               AND status != 'cancelled'
             GROUP BY session_id",
            [$workshopID]
        );

        $counts = [];
        foreach ($rows as $r) {
            $counts[$r->session_id] = (int)$r->count;
        }
        return $counts;
    }

    private function computeAvailableSlots(
        array $schedules,
        Carbon $from,
        Carbon $to,
        array $materialized,
        array $bookingCounts,
        ?int $capacity
    ): array {
        $result = [];

        foreach ($schedules as $sched) {
            $validFrom = Carbon::createFromFormat('Y-m-d', substr($sched->valid_from, 0, 10), 'UTC');
            $validUntil = null;
            if (!empty($sched->valid_until)) {
                try {
                    $validUntil = Carbon::createFromFormat('Y-m-d', substr($sched->valid_until, 0, 10), 'UTC');
                } catch (\Throwable $e) {}
            }

            $daySet = array_flip($sched->days_of_week);

            // Parse HH:MM[:SS]
            $parts = explode(':', $sched->time_start);
            $hour   = (int)($parts[0] ?? 0);
            $minute = (int)($parts[1] ?? 0);
            $timeStr = sprintf('%02d:%02d', $hour, $minute);

            $current = $from->copy()->startOfDay();
            while (!$current->greaterThan($to)) {
                $dow = (int)$current->dayOfWeek; // 0=Sun…6=Sat

                if (!isset($daySet[$dow])) {
                    $current->addDay();
                    continue;
                }

                $dayOnly = $current->copy()->startOfDay();

                if ($dayOnly->lt($validFrom)) {
                    $current->addDay();
                    continue;
                }
                if ($validUntil && $dayOnly->gt($validUntil)) {
                    $current->addDay();
                    continue;
                }

                $dateStr = $current->format('Y-m-d');
                $key     = $sched->id . ':' . $dateStr;

                $status         = 'not_materialized';
                $sessionID      = null;
                $spotsRemaining = null;
                $slotOnlineURL  = '';
                $bookingCount   = 0;

                if (isset($materialized[$key])) {
                    $mat       = $materialized[$key];
                    $sessionID = $mat->id;
                    $slotOnlineURL = $mat->online_url;
                    $bookingCount  = $bookingCounts[$mat->id] ?? 0;

                    if ($mat->cancelled) {
                        $status = 'cancelled';
                    } elseif ($capacity !== null) {
                        $remaining = $capacity - $bookingCount;
                        if ($remaining <= 0) {
                            $status = 'full';
                            $remaining = 0;
                        } else {
                            $status = 'available';
                        }
                        $spotsRemaining = $remaining;
                    } else {
                        $status = 'available';
                    }
                } elseif ($capacity !== null) {
                    $spotsRemaining = $capacity;
                }

                $result[] = [
                    'date'            => $dateStr,
                    'time'            => $timeStr,
                    'duration_min'    => (int)$sched->duration_min,
                    'schedule_id'     => $sched->id,
                    'session_id'      => $sessionID,
                    'online_url'      => $slotOnlineURL,
                    'spots_remaining' => $spotsRemaining,
                    'booking_count'   => $bookingCount,
                    'status'          => $status,
                ];

                $current->addDay();
            }
        }

        usort($result, function ($a, $b) {
            $dateCmp = strcmp($a['date'], $b['date']);
            return $dateCmp !== 0 ? $dateCmp : strcmp($a['time'], $b['time']);
        });

        return $result;
    }
}
