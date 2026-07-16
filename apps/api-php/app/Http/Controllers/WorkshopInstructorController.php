<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gestión de co-talleristas (SOLO VISIBILIDAD) de un taller — admin only.
 *
 * Los co-talleristas se muestran en la ficha pública junto al tallerista
 * principal (workshops.instructor_id). No tienen permisos ni ingresos.
 * Cada uno es un usuario registrado (user_id) o un contacto fantasma
 * (guest_contact_id), reutilizando la tabla guest_contacts existente.
 */
class WorkshopInstructorController extends Controller
{
    // GET /api/v1/admin/workshops/:id/instructors
    public function index(string $id): JsonResponse
    {
        $exists = DB::selectOne("SELECT id FROM workshops WHERE id = ?", [$id]);
        if (!$exists) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $rows = DB::select(
            "SELECT wi.id,
                    wi.user_id::text          as user_id,
                    wi.guest_contact_id::text as guest_contact_id,
                    wi.display_order,
                    CASE WHEN wi.user_id IS NOT NULL THEN COALESCE(p.name, u.email, '')
                         ELSE COALESCE(gc.name, '') END as name,
                    COALESCE(u.email, '') as email
             FROM workshop_instructors wi
             LEFT JOIN profiles p        ON p.user_id = wi.user_id
             LEFT JOIN users u           ON u.id = wi.user_id
             LEFT JOIN guest_contacts gc ON gc.id = wi.guest_contact_id
             WHERE wi.workshop_id = ?
             ORDER BY wi.display_order, wi.created_at",
            [$id]
        );

        // is_guest determinista (evita ambigüedad de boolean PDO 't'/'f').
        foreach ($rows as $r) {
            $r->is_guest      = ($r->user_id === null);
            $r->display_order = (int) $r->display_order;
        }

        return response()->json(['data' => $rows]);
    }

    // PUT /api/v1/admin/workshops/:id/instructors
    // Body: { instructors: [ {user_id} | {guest_contact_id}, ... ] }
    public function replace(Request $request, string $id): JsonResponse
    {
        $workshop = DB::selectOne(
            "SELECT id, instructor_id::text as instructor_id FROM workshops WHERE id = ?",
            [$id]
        );
        if (!$workshop) {
            return response()->json(['message' => 'Taller no encontrado'], 404);
        }

        $items = (array) $request->input('instructors', []);

        // Normaliza y valida: exactamente una referencia por item, sin duplicar
        // al tallerista principal ni entre sí.
        $clean   = [];
        $seenU   = [];
        $seenG   = [];
        foreach ($items as $it) {
            $userId  = $it['user_id']          ?? null;
            $guestId = $it['guest_contact_id'] ?? null;

            if (($userId && $guestId) || (!$userId && !$guestId)) {
                return response()->json([
                    'message' => 'Cada co-tallerista debe tener user_id O guest_contact_id (exactamente uno)',
                ], 422);
            }

            if ($userId) {
                if ($userId === $workshop->instructor_id) continue; // ya es el principal
                if (isset($seenU[$userId])) continue;
                $seenU[$userId] = true;
                $clean[] = ['user_id' => $userId, 'guest_contact_id' => null];
            } else {
                if (isset($seenG[$guestId])) continue;
                $seenG[$guestId] = true;
                $clean[] = ['user_id' => null, 'guest_contact_id' => $guestId];
            }
        }

        DB::transaction(function () use ($id, $clean) {
            DB::delete("DELETE FROM workshop_instructors WHERE workshop_id = ?", [$id]);
            foreach ($clean as $i => $ref) {
                DB::insert(
                    "INSERT INTO workshop_instructors (workshop_id, user_id, guest_contact_id, display_order)
                     VALUES (?, ?, ?, ?)",
                    [$id, $ref['user_id'], $ref['guest_contact_id'], $i]
                );
            }
        });

        return response()->json(['data' => ['id' => $id, 'count' => count($clean)]]);
    }
}
