<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Laravel\Lumen\Routing\Controller as BaseController;

abstract class Controller extends BaseController
{
    // -----------------------------------------------------------------------
    // Auth helpers
    // -----------------------------------------------------------------------

    protected function userId(Request $request): string
    {
        return $request->attributes->get('userID', '');
    }

    protected function userRole(Request $request): string
    {
        return $request->attributes->get('userRole', '');
    }

    // -----------------------------------------------------------------------
    // Slug generator (matches Go implementation)
    // -----------------------------------------------------------------------

    protected function slugify(string $title): string
    {
        // Lowercase primero (igual que Go: strings.ToLower antes del replacer)
        // mb_strtolower maneja correctamente Ñ→ñ, Á→á, etc.
        $s = mb_strtolower($title, 'UTF-8');

        $map = [
            'á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n','ü'=>'u',
        ];
        $s = str_replace(array_keys($map), array_values($map), $s);
        $s = preg_replace('/[^a-z0-9]+/', '-', $s);
        $s = trim($s, '-');
        $ts = (int)(microtime(true) * 1000) % 100000;
        return "{$s}-{$ts}";
    }

    // -----------------------------------------------------------------------
    // Commission zone (matches Go commissionZone)
    //
    // Returns "instructor" if now >= Monday of sessionDate's ISO week.
    // Returns "platform" otherwise.
    // -----------------------------------------------------------------------

    protected function commissionZone(Carbon $sessionDate): string
    {
        $dayOfWeek   = (int)$sessionDate->dayOfWeek;          // 0=Sun … 6=Sat
        $daysFromMon = ($dayOfWeek + 6) % 7;                  // Mon→0 … Sun→6
        $cutoff      = $sessionDate->copy()
                          ->subDays($daysFromMon)
                          ->startOfDay()
                          ->utc();

        return Carbon::now('UTC')->lt($cutoff) ? 'platform' : 'instructor';
    }

    // -----------------------------------------------------------------------
    // Parse comma-separated int string (e.g. "1,3,5")
    // -----------------------------------------------------------------------

    protected function parseIntCSV(?string $s): array
    {
        if (empty($s)) {
            return [];
        }
        return array_map('intval', explode(',', $s));
    }

    // -----------------------------------------------------------------------
    // Active bookings count for a workshop
    // -----------------------------------------------------------------------

    protected function activeBookingsCount(string $workshopID): int
    {
        $sessionBookings = \DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings b
             JOIN sessions s ON s.id = b.session_id
             WHERE b.workshop_id = ?
               AND b.status = 'confirmed'
               AND s.starts_at > (NOW() AT TIME ZONE 'America/Santiago')::timestamp",
            [$workshopID]
        );
        $directBookings = \DB::selectOne(
            "SELECT COUNT(*) as cnt FROM bookings
             WHERE workshop_id = ? AND status = 'confirmed' AND session_id IS NULL",
            [$workshopID]
        );

        return (int)($sessionBookings->cnt ?? 0) + (int)($directBookings->cnt ?? 0);
    }
}
