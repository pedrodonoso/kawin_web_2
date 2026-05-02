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
                    COALESCE(p.phone,'') as phone,
                    COALESCE(p.whatsapp,'') as whatsapp,
                    COALESCE(p.instagram_url,'') as instagram_url,
                    COALESCE(p.facebook_url,'') as facebook_url,
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
                    w.type, w.modality, w.price, w.currency,
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
                    COALESCE(facebook_url,'') as facebook_url
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
                 instagram_url=?, facebook_url=?, updated_at=NOW()
             WHERE user_id=?",
            [
                $request->input('name'),
                $request->input('bio', ''),
                $request->input('phone', ''),
                $request->input('whatsapp', ''),
                $request->input('instagram_url', ''),
                $request->input('facebook_url', ''),
                $userID,
            ]
        );

        return response()->json(['data' => ['message' => 'Perfil actualizado']]);
    }
}
