<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GuestContactController extends Controller
{
    // GET /api/v1/admin/guest-contacts
    public function index(): JsonResponse
    {
        $contacts = DB::select(
            "SELECT gc.id, gc.name, gc.email, gc.phone, gc.whatsapp,
                    gc.bio, gc.instagram, gc.website,
                    gc.created_at::text as created_at,
                    COALESCE(p.name,'') as created_by_name,
                    (SELECT COUNT(*) FROM workshops w WHERE w.guest_contact_id = gc.id)::int as workshops_count,
                    (SELECT COUNT(*) FROM routes r WHERE r.guest_contact_id = gc.id)::int as routes_count
             FROM guest_contacts gc
             LEFT JOIN profiles p ON p.user_id = gc.created_by
             ORDER BY gc.name ASC"
        );

        return response()->json(['data' => $contacts]);
    }

    // GET /api/v1/admin/guest-contacts/:id
    public function show(string $id): JsonResponse
    {
        $contact = DB::selectOne(
            "SELECT gc.id, gc.name, gc.email, gc.phone, gc.whatsapp,
                    gc.bio, gc.instagram, gc.website,
                    gc.created_at::text as created_at
             FROM guest_contacts gc
             WHERE gc.id::text = ?",
            [$id]
        );

        if (!$contact) {
            return response()->json(['message' => 'Contacto no encontrado'], 404);
        }

        return response()->json(['data' => $contact]);
    }

    // POST /api/v1/admin/guest-contacts
    public function store(Request $request): JsonResponse
    {
        $adminId = $this->userId($request);

        $this->validate($request, ['name' => 'required|string']);

        $row = DB::selectOne(
            "INSERT INTO guest_contacts
                (created_by, name, email, phone, whatsapp, bio, instagram, website)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id",
            [
                $adminId,
                $request->input('name'),
                $request->input('email', ''),
                $request->input('phone', ''),
                $request->input('whatsapp', ''),
                $request->input('bio', ''),
                $request->input('instagram', ''),
                $request->input('website', ''),
            ]
        );

        return response()->json(['data' => ['id' => $row->id]], 201);
    }

    // PUT /api/v1/admin/guest-contacts/:id
    public function update(Request $request, string $id): JsonResponse
    {
        $this->validate($request, ['name' => 'required|string']);

        $affected = DB::update(
            "UPDATE guest_contacts
             SET name=?, email=?, phone=?, whatsapp=?, bio=?, instagram=?, website=?,
                 updated_at=NOW()
             WHERE id::text=?",
            [
                $request->input('name'),
                $request->input('email', ''),
                $request->input('phone', ''),
                $request->input('whatsapp', ''),
                $request->input('bio', ''),
                $request->input('instagram', ''),
                $request->input('website', ''),
                $id,
            ]
        );

        if ($affected === 0) {
            return response()->json(['message' => 'Contacto no encontrado'], 404);
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    // DELETE /api/v1/admin/guest-contacts/:id
    public function destroy(string $id): JsonResponse
    {
        // Only delete if no workshops or routes reference it
        $inUse = DB::selectOne(
            "SELECT
                (SELECT COUNT(*) FROM workshops WHERE guest_contact_id::text = ?)::int +
                (SELECT COUNT(*) FROM routes    WHERE guest_contact_id::text = ?)::int
             AS total",
            [$id, $id]
        );

        if ($inUse && $inUse->total > 0) {
            return response()->json([
                'message' => 'No se puede eliminar: hay talleres o rutas asociados a este contacto',
            ], 409);
        }

        DB::delete("DELETE FROM guest_contacts WHERE id::text = ?", [$id]);

        return response()->json(['data' => ['id' => $id]]);
    }
}
