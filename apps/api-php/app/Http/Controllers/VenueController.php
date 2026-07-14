<?php

namespace App\Http\Controllers;

use App\Constants\VenueStatus;
use App\Models\Venue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VenueController extends Controller
{
    // -----------------------------------------------------------------------
    // Public
    // -----------------------------------------------------------------------

    // GET /api/v1/venues  (public — only active, with published workshop count)
    public function index(): JsonResponse
    {
        $venues = DB::select(
            "SELECT v.id, v.name, v.slug,
                    COALESCE(v.description,'') as description,
                    COALESCE(v.address,'') as address,
                    COALESCE(v.city,'') as city,
                    COALESCE(v.country,'Chile') as country,
                    v.lat, v.lng,
                    COALESCE(v.cover_image_url,'') as cover_image_url,
                    v.status,
                    (SELECT COUNT(*) FROM workshops w
                     WHERE w.venue_id = v.id AND w.status = 'published')::int as workshops_count
             FROM venues v
             WHERE v.status = ?
             ORDER BY v.name ASC",
            [VenueStatus::ACTIVE]
        );

        return response()->json(['data' => $venues]);
    }

    // GET /api/v1/venues/:id  (public — accepts UUID or slug, only active)
    public function show(string $id): JsonResponse
    {
        $venue = DB::selectOne(
            "SELECT v.id, v.name, v.slug,
                    COALESCE(v.description,'') as description,
                    COALESCE(v.address,'') as address,
                    COALESCE(v.city,'') as city,
                    COALESCE(v.country,'Chile') as country,
                    v.lat, v.lng,
                    COALESCE(v.cover_image_url,'') as cover_image_url,
                    COALESCE(v.phone,'') as phone,
                    COALESCE(v.whatsapp,'') as whatsapp,
                    COALESCE(v.instagram_url,'') as instagram_url,
                    COALESCE(v.facebook_url,'') as facebook_url,
                    COALESCE(v.website,'') as website,
                    v.status
             FROM venues v
             WHERE (v.id::text = ? OR v.slug = ?) AND v.status = ?",
            [$id, $id, VenueStatus::ACTIVE]
        );

        if (!$venue) {
            return response()->json(['message' => 'Sede no encontrada'], 404);
        }

        $venue->workshops = DB::select(
            "SELECT w.id, w.title, w.slug,
                    COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price::int as price, w.currency,
                    COALESCE(v.name, w.location, '') as location,
                    COALESCE(v.lat, w.lat) as lat,
                    COALESCE(v.lng, w.lng) as lng,
                    COALESCE(w.cover_image_url,'') as cover_image_url,
                    COALESCE(c.name,'') as category_name,
                    COALESCE(c.slug,'') as category_slug,
                    COALESCE(p.name, '') as instructor_name,
                    w.instructor_id::text as instructor_id
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             LEFT JOIN profiles p ON p.user_id = w.instructor_id
             LEFT JOIN venues v ON v.id = w.venue_id
             WHERE w.venue_id = ? AND w.status = 'published'
             ORDER BY w.created_at DESC",
            [$venue->id]
        );

        // Attach date/time info per workshop:
        //  - class type   -> active recurring schedule rules
        //  - other types  -> next upcoming (non-cancelled) session
        foreach ($venue->workshops as $w) {
            $w->schedules = [];
            $w->next_session_at = null;
            $w->next_session_ends_at = null;

            if ($w->type === 'class') {
                $rows = DB::select(
                    "SELECT array_to_string(days_of_week, ',') as days_of_week,
                            time_start::text as time_start, duration_min
                     FROM schedules
                     WHERE workshop_id = ?
                       AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
                     ORDER BY valid_from, time_start",
                    [$w->id]
                );
                $w->schedules = array_map(function ($r) {
                    $r->days_of_week = ($r->days_of_week === null || $r->days_of_week === '')
                        ? []
                        : array_map('intval', explode(',', $r->days_of_week));
                    return $r;
                }, $rows);
            } else {
                $next = DB::selectOne(
                    "SELECT starts_at::text as starts_at, ends_at::text as ends_at
                     FROM sessions
                     WHERE workshop_id = ?
                       AND schedule_id IS NULL
                       AND cancelled = false
                       AND ends_at >= (NOW() AT TIME ZONE 'America/Santiago')::timestamp
                     ORDER BY starts_at ASC
                     LIMIT 1",
                    [$w->id]
                );
                if ($next) {
                    $w->next_session_at = $next->starts_at;
                    $w->next_session_ends_at = $next->ends_at;
                }
            }
        }

        return response()->json(['data' => $venue]);
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    // GET /api/v1/admin/venues  (all statuses, with workshop counts)
    public function adminIndex(): JsonResponse
    {
        $venues = DB::select(
            "SELECT v.id, v.name, v.slug,
                    COALESCE(v.description,'') as description,
                    COALESCE(v.address,'') as address,
                    COALESCE(v.city,'') as city,
                    COALESCE(v.country,'Chile') as country,
                    v.lat, v.lng,
                    COALESCE(v.cover_image_url,'') as cover_image_url,
                    v.status,
                    COALESCE(v.created_at::text,'') as created_at,
                    (SELECT COUNT(*) FROM workshops w WHERE w.venue_id = v.id)::int as workshops_count
             FROM venues v
             ORDER BY v.name ASC"
        );

        return response()->json(['data' => $venues]);
    }

    // GET /api/v1/admin/venues/:id  (single, any status)
    public function adminShow(string $id): JsonResponse
    {
        $venue = DB::selectOne(
            "SELECT v.id, v.name, v.slug,
                    COALESCE(v.description,'') as description,
                    COALESCE(v.address,'') as address,
                    COALESCE(v.city,'') as city,
                    COALESCE(v.country,'Chile') as country,
                    v.lat, v.lng,
                    COALESCE(v.cover_image_url,'') as cover_image_url,
                    COALESCE(v.phone,'') as phone,
                    COALESCE(v.whatsapp,'') as whatsapp,
                    COALESCE(v.instagram_url,'') as instagram_url,
                    COALESCE(v.facebook_url,'') as facebook_url,
                    COALESCE(v.website,'') as website,
                    v.status
             FROM venues v
             WHERE v.id::text = ?",
            [$id]
        );

        if (!$venue) {
            return response()->json(['message' => 'Sede no encontrada'], 404);
        }

        return response()->json(['data' => $venue]);
    }

    // POST /api/v1/admin/venues
    public function store(Request $request): JsonResponse
    {
        $this->validate($request, ['name' => 'required|string']);

        $venue = new Venue();
        $venue->fill([
            'created_by'      => $this->userId($request),
            'name'            => $request->input('name'),
            'slug'            => $this->slugify($request->input('name')),
            'description'     => $request->input('description', '') ?: '',
            'address'         => $request->input('address', '') ?: '',
            'city'            => $request->input('city', '') ?: '',
            'country'         => $request->input('country', 'Chile') ?: 'Chile',
            'lat'             => $request->input('lat') !== null && $request->input('lat') !== '' ? (float)$request->input('lat') : null,
            'lng'             => $request->input('lng') !== null && $request->input('lng') !== '' ? (float)$request->input('lng') : null,
            'cover_image_url' => $request->input('cover_image_url', '') ?: '',
            'phone'           => $request->input('phone', '') ?: '',
            'whatsapp'        => $request->input('whatsapp', '') ?: '',
            'instagram_url'   => $request->input('instagram_url', '') ?: '',
            'facebook_url'    => $request->input('facebook_url', '') ?: '',
            'website'         => $request->input('website', '') ?: '',
            'status'          => VenueStatus::ACTIVE,
        ]);
        $venue->save();

        return response()->json(['data' => ['id' => $venue->id, 'slug' => $venue->slug]], 201);
    }

    // PUT /api/v1/admin/venues/:id
    public function update(Request $request, string $id): JsonResponse
    {
        $this->validate($request, ['name' => 'required|string']);

        $venue = Venue::where('id', $id)->first();
        if (!$venue) {
            return response()->json(['message' => 'Sede no encontrada'], 404);
        }

        $venue->fill([
            'name'            => $request->input('name'),
            'description'     => $request->input('description', '') ?: '',
            'address'         => $request->input('address', '') ?: '',
            'city'            => $request->input('city', '') ?: '',
            'country'         => $request->input('country', 'Chile') ?: 'Chile',
            'lat'             => $request->input('lat') !== null && $request->input('lat') !== '' ? (float)$request->input('lat') : null,
            'lng'             => $request->input('lng') !== null && $request->input('lng') !== '' ? (float)$request->input('lng') : null,
            'cover_image_url' => $request->input('cover_image_url', '') ?: '',
            'phone'           => $request->input('phone', '') ?: '',
            'whatsapp'        => $request->input('whatsapp', '') ?: '',
            'instagram_url'   => $request->input('instagram_url', '') ?: '',
            'facebook_url'    => $request->input('facebook_url', '') ?: '',
            'website'         => $request->input('website', '') ?: '',
        ]);
        $venue->save();

        return response()->json(['data' => ['id' => $id]]);
    }

    // DELETE /api/v1/admin/venues/:id  (soft — set inactive)
    public function archive(string $id): JsonResponse
    {
        $affected = DB::update(
            "UPDATE venues SET status = ?, updated_at = NOW() WHERE id::text = ? AND status != ?",
            [VenueStatus::INACTIVE, $id, VenueStatus::INACTIVE]
        );

        if ($affected === 0) {
            return response()->json(['message' => 'Sede no encontrada o ya inhabilitada'], 404);
        }

        return response()->json(['data' => ['id' => $id, 'status' => VenueStatus::INACTIVE]]);
    }

    // POST /api/v1/admin/venues/:id/restore
    public function restore(string $id): JsonResponse
    {
        $affected = DB::update(
            "UPDATE venues SET status = ?, updated_at = NOW() WHERE id::text = ? AND status = ?",
            [VenueStatus::ACTIVE, $id, VenueStatus::INACTIVE]
        );

        if ($affected === 0) {
            return response()->json(['message' => 'Sede no encontrada o no está inhabilitada'], 404);
        }

        return response()->json(['data' => ['id' => $id, 'status' => VenueStatus::ACTIVE]]);
    }

    // DELETE /api/v1/admin/venues/:id/permanent
    public function destroy(string $id): JsonResponse
    {
        $inUse = DB::selectOne(
            "SELECT COUNT(*)::int as total FROM workshops WHERE venue_id::text = ?",
            [$id]
        );

        if ($inUse && $inUse->total > 0) {
            return response()->json([
                'message' => 'No se puede eliminar: hay talleres asociados a esta sede',
            ], 409);
        }

        DB::delete("DELETE FROM venues WHERE id::text = ?", [$id]);

        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }
}
