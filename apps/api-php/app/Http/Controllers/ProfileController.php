<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
    // GET /api/v1/instructors/:id/profile  (public)
    public function publicShow(string $id): JsonResponse
    {
        $profile = DB::selectOne(
            "SELECT u.id::text as id,
                    COALESCE(p.name,'') as name,
                    COALESCE(p.bio,'') as bio,
                    COALESCE(p.avatar_url,'') as avatar_url,
                    CASE WHEN COALESCE(p.show_phone,TRUE)     THEN COALESCE(p.phone,'')         ELSE '' END as phone,
                    CASE WHEN COALESCE(p.show_whatsapp,TRUE)  THEN COALESCE(p.whatsapp,'')      ELSE '' END as whatsapp,
                    CASE WHEN COALESCE(p.show_instagram,TRUE) THEN COALESCE(p.instagram_url,'') ELSE '' END as instagram_url,
                    CASE WHEN COALESCE(p.show_facebook,TRUE)  THEN COALESCE(p.facebook_url,'')  ELSE '' END as facebook_url,
                    COALESCE(p.city,'') as city,
                    COALESCE(p.country,'Chile') as country
             FROM profiles p
             JOIN users u ON u.id = p.user_id
             WHERE u.id::text = ? AND u.role IN ('instructor','both')",
            [$id]
        );

        if (!$profile) {
            return response()->json(['message' => 'Tallerista no encontrado'], 404);
        }

        $workshops = DB::select(
            "SELECT w.id, w.title, w.slug,
                    COALESCE(w.description,'') as description,
                    w.type, w.modality, w.price::int as price, w.currency,
                    COALESCE(w.location,'') as location,
                    w.lat, w.lng,
                    COALESCE(w.cover_image_url,'') as cover_image_url,
                    COALESCE(c.name,'') as category_name,
                    COALESCE(c.slug,'') as category_slug
             FROM workshops w
             LEFT JOIN categories c ON c.id = w.category_id
             WHERE w.instructor_id = ? AND w.status = 'published'
             ORDER BY w.created_at DESC",
            [$id]
        );

        $profile->workshops = $workshops;

        return response()->json(['data' => $profile]);
    }

    // GET /api/v1/my-profile
    public function show(Request $request): JsonResponse
    {
        $userID = $this->userId($request);

        $profile = DB::selectOne(
            "SELECT COALESCE(name,'') as name, COALESCE(bio,'') as bio,
                    COALESCE(phone,'') as phone, COALESCE(whatsapp,'') as whatsapp,
                    COALESCE(instagram_url,'') as instagram_url,
                    COALESCE(facebook_url,'') as facebook_url,
                    COALESCE(show_phone,TRUE)     as show_phone,
                    COALESCE(show_whatsapp,TRUE)  as show_whatsapp,
                    COALESCE(show_instagram,TRUE) as show_instagram,
                    COALESCE(show_facebook,TRUE)  as show_facebook
             FROM profiles WHERE user_id = ?",
            [$userID]
        );

        if (!$profile) {
            return response()->json(['message' => 'Perfil no encontrado'], 404);
        }

        return response()->json(['data' => $profile]);
    }

    // PUT /api/v1/my-profile
    public function update(Request $request): JsonResponse
    {
        $userID = $this->userId($request);

        $this->validate($request, [
            'name' => 'required|string',
        ]);

        DB::update(
            "UPDATE profiles
             SET name=?, bio=?, phone=?, whatsapp=?,
                 instagram_url=?, facebook_url=?,
                 show_phone=?, show_whatsapp=?, show_instagram=?, show_facebook=?,
                 updated_at=NOW()
             WHERE user_id=?",
            [
                $request->input('name'),
                $request->input('bio', ''),
                $request->input('phone', ''),
                $request->input('whatsapp', ''),
                $request->input('instagram_url', ''),
                $request->input('facebook_url', ''),
                $request->boolean('show_phone', true),
                $request->boolean('show_whatsapp', true),
                $request->boolean('show_instagram', true),
                $request->boolean('show_facebook', true),
                $userID,
            ]
        );

        return response()->json(['data' => ['message' => 'Perfil actualizado']]);
    }
}
