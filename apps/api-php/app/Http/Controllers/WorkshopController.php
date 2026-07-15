<?php

namespace App\Http\Controllers;

use App\Constants\BookingStatus;
use App\Constants\WorkshopType;
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
        $venue        = $request->query('venue', '');

        // When a workshop belongs to a venue, the venue's coordinates / address
        // take precedence over the workshop's own fields.
        $sql = "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                       w.type, w.modality, w.price::int as price, w.currency,
                       w.capacity, COALESCE(v.name, NULLIF(w.location,''), '') as location,
                       COALESCE(NULLIF(v.address,''), w.address, '') as address,
                       COALESCE(v.lat, w.lat) as lat,
                       COALESCE(v.lng, w.lng) as lng,
                       COALESCE(w.online_url,'') as online_url,
                       COALESCE(w.maps_url,'') as maps_url,
                       COALESCE(w.cover_image_url,'') as cover_image_url,
                       w.status, COALESCE(w.created_at::text,'') as created_at,
                       COALESCE(c.id::text,'') as category_id,
                       COALESCE(c.name,'') as category_name,
                       COALESCE(c.slug,'') as category_slug,
                       COALESCE(gc.name, p.name, '') as instructor_name,
                       w.instructor_id::text as instructor_id,
                       gc.id::text as guest_contact_id,
                       v.id::text as venue_id,
                       COALESCE(v.name,'') as venue_name,
                       COALESCE(v.slug,'') as venue_slug
                FROM workshops w
                LEFT JOIN categories c ON c.id = w.category_id
                LEFT JOIN profiles p ON p.user_id = w.instructor_id
                LEFT JOIN guest_contacts gc ON gc.id = w.guest_contact_id
                LEFT JOIN venues v ON v.id = w.venue_id
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
        if ($venue !== '') {
            $sql .= " AND (v.id::text = ? OR v.slug = ?)";
            $bindings[] = $venue;
            $bindings[] = $venue;
        }

        $sql .= " ORDER BY w.created_at DESC LIMIT 50";

        $workshops = DB::select($sql, $bindings);

        return response()->json(['data' => $workshops, 'total' => count($workshops)]);
    }

    // GET /api/v1/workshops/:id  (accepts UUID or slug)
    public function show(Request $request, string $id): JsonResponse
    {
        $w = DB::selectOne(
            "SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price::int as price, w.currency,
                    w.capacity, COALESCE(v.name, NULLIF(w.location,''), '') as location,
                    COALESCE(NULLIF(v.address,''), w.address, '') as address,
                    COALESCE(v.lat, w.lat) as lat,
                    COALESCE(v.lng, w.lng) as lng,
                    COALESCE(w.online_url,'') as online_url,
                    COALESCE(w.maps_url,'') as maps_url,
                    COALESCE(w.notes,'') as notes,
                    COALESCE(w.cover_image_url,'') as cover_image_url,
                    w.status, COALESCE(w.created_at::text,'') as created_at,
                    COALESCE(c.id::text,'') as category_id,
                    COALESCE(c.name,'') as category_name,
                    COALESCE(c.slug,'') as category_slug,
                    w.instructor_id::text as instructor_id,
                    gc.id::text as guest_contact_id,
                    v.id::text as venue_id,
                    COALESCE(v.name,'') as venue_name,
                    COALESCE(v.slug,'') as venue_slug,
                    w.use_guest_contact,
                    CASE WHEN w.use_guest_contact AND gc.id IS NOT NULL THEN COALESCE(gc.name,   p.name,          '') ELSE COALESCE(p.name,          '') END as instructor_name,
                    CASE WHEN w.use_guest_contact AND gc.id IS NOT NULL THEN COALESCE(gc.bio,    p.bio,           '') ELSE COALESCE(p.bio,           '') END as instructor_bio,
                    CASE WHEN w.use_guest_contact AND gc.id IS NOT NULL THEN COALESCE(gc.instagram, p.instagram_url,'') WHEN COALESCE(p.show_instagram,TRUE) THEN COALESCE(p.instagram_url,'') ELSE '' END as instructor_instagram,
                    CASE WHEN w.use_guest_contact AND gc.id IS NOT NULL THEN '' WHEN COALESCE(p.show_facebook,TRUE)  THEN COALESCE(p.facebook_url, '') ELSE '' END as instructor_facebook,
                    CASE WHEN w.use_guest_contact AND gc.id IS NOT NULL THEN COALESCE(gc.website, '') ELSE '' END as instructor_website,
                    CASE WHEN w.use_guest_contact AND gc.id IS NOT NULL THEN COALESCE(gc.whatsapp, p.whatsapp,   '') WHEN COALESCE(p.show_whatsapp,TRUE)  THEN COALESCE(p.whatsapp,    '') ELSE '' END as instructor_whatsapp,
                    CASE WHEN w.use_guest_contact AND gc.id IS NOT NULL THEN COALESCE(gc.phone,  p.phone,        '') WHEN COALESCE(p.show_phone,TRUE)     THEN COALESCE(p.phone,       '') ELSE '' END as instructor_phone
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             LEFT JOIN profiles p ON p.user_id = w.instructor_id
             LEFT JOIN guest_contacts gc ON gc.id = w.guest_contact_id
             LEFT JOIN venues v ON v.id = w.venue_id
             WHERE (w.id::text = ? OR w.slug = ?)",
            [$id, $id]
        );

        if (!$w) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        if ($w->status === \App\Constants\WorkshopStatus::ARCHIVED) {
            $userID   = $request->attributes->get('userID');
            $userRole = $request->attributes->get('userRole', '');
            $isOwner  = $userID && $userID === $w->instructor_id;
            $isAdmin  = $userRole === \App\Constants\UserRole::ADMIN;
            if (!$isOwner && !$isAdmin) {
                return response()->json(['message' => 'Taller no encontrado'], 404);
            }
        }

        // Co-talleristas adicionales (solo visibilidad). El tallerista principal
        // sigue en los campos instructor_* de arriba; esto agrega los extra.
        $w->co_instructors = $this->loadCoInstructors($w->id);

        // Booking count
        $bc = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings WHERE workshop_id = ? AND status = 'confirmed'",
            [$w->id]
        );
        $w->bookings_count = (int)($bc->cnt ?? 0);

        if ($w->type === WorkshopType::CLASS_TYPE) {
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
                   AND s.ends_at >= (NOW() AT TIME ZONE 'America/Santiago')::timestamp
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
            $w->schedules = $this->loadScheduleRows($w->id);
        }

        // Active discounts (workshop-wide and session-specific)
        $w->discounts = DB::select(
            "SELECT id, session_id::text as session_id, type, value::float as value,
                    label, max_uses, uses_count,
                    valid_from::text as valid_from, valid_until::text as valid_until
             FROM discounts
             WHERE workshop_id = ?
               AND active = true
               AND (max_uses IS NULL OR uses_count < max_uses)
               AND (valid_from IS NULL  OR valid_from  <= NOW())
               AND (valid_until IS NULL OR valid_until >= NOW())
             ORDER BY (CASE WHEN session_id IS NOT NULL THEN 1 ELSE 0 END), value DESC",
            [$w->id]
        );

        return response()->json(['data' => $w]);
    }

    // GET /api/v1/workshops/:id/available-slots  (instructor only)
    public function availableSlots(Request $request, string $id): JsonResponse
    {
        $userID  = $this->userId($request);
        $isAdmin = $this->userRole($request) === 'admin';

        $winfo = DB::selectOne(
            "SELECT instructor_id::text as instructor_id, capacity FROM workshops WHERE id = ?",
            [$id]
        );
        if (!$winfo) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }
        if (!$isAdmin && $winfo->instructor_id !== $userID) {
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

    /**
     * Co-talleristas adicionales de un taller, resueltos desde profiles (usuarios
     * registrados) o guest_contacts (fantasma). Respeta los flags de visibilidad
     * del perfil, igual que el tallerista principal. Solo informativo.
     */
    private function loadCoInstructors(string $workshopID): array
    {
        // La tabla workshop_instructors puede no existir aún en algunos
        // entornos (migración pendiente). Si falla, degradamos a sin
        // co-talleristas en lugar de romper la ficha del taller.
        try {
            $rows = DB::select(
                "SELECT wi.id,
                    wi.user_id::text as user_id,
                    CASE WHEN wi.user_id IS NOT NULL THEN COALESCE(p.name,'') ELSE COALESCE(gc.name,'') END as name,
                    CASE WHEN wi.user_id IS NOT NULL THEN COALESCE(p.bio,'')  ELSE COALESCE(gc.bio,'')  END as bio,
                    COALESCE(p.avatar_url,'') as avatar_url,
                    CASE WHEN wi.user_id IS NOT NULL
                         THEN (CASE WHEN COALESCE(p.show_instagram,TRUE) THEN COALESCE(p.instagram_url,'') ELSE '' END)
                         ELSE COALESCE(gc.instagram,'') END as instagram,
                    CASE WHEN wi.user_id IS NOT NULL
                         THEN (CASE WHEN COALESCE(p.show_facebook,TRUE)  THEN COALESCE(p.facebook_url,'')  ELSE '' END)
                         ELSE '' END as facebook,
                    CASE WHEN wi.user_id IS NOT NULL
                         THEN ''
                         ELSE COALESCE(gc.website,'')  END as website,
                    CASE WHEN wi.user_id IS NOT NULL
                         THEN (CASE WHEN COALESCE(p.show_whatsapp,TRUE)  THEN COALESCE(p.whatsapp,'')      ELSE '' END)
                         ELSE COALESCE(gc.whatsapp,'') END as whatsapp,
                    CASE WHEN wi.user_id IS NOT NULL
                         THEN (CASE WHEN COALESCE(p.show_phone,TRUE)     THEN COALESCE(p.phone,'')         ELSE '' END)
                         ELSE COALESCE(gc.phone,'')    END as phone
             FROM workshop_instructors wi
             LEFT JOIN profiles p        ON p.user_id = wi.user_id
             LEFT JOIN guest_contacts gc ON gc.id = wi.guest_contact_id
             WHERE wi.workshop_id = ?
             ORDER BY wi.display_order, wi.created_at",
                [$workshopID]
            );
        } catch (\Throwable $e) {
            return [];
        }

        // is_guest determinista (evita ambigüedad de boolean PDO 't'/'f').
        foreach ($rows as $r) {
            $r->is_guest = ($r->user_id === null);
        }

        return $rows;
    }

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
               AND status != ?
             GROUP BY session_id",
            [$workshopID, BookingStatus::CANCELLED]
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
