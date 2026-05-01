<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
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
