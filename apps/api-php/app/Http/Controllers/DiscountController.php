<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DiscountController extends Controller
{
    // GET /api/v1/workshops/{id}/discounts
    public function index(Request $request, string $id): JsonResponse
    {
        if (!$this->ownsWorkshop($id, $this->userId($request))) {
            return response()->json(['message' => 'No tienes acceso a este taller'], 403);
        }

        $discounts = DB::select(
            "SELECT id, workshop_id::text, session_id::text, type, value, label,
                    max_uses, uses_count, active,
                    valid_from::text, valid_until::text, created_at::text
             FROM discounts WHERE workshop_id = ? ORDER BY created_at DESC",
            [$id]
        );

        return response()->json(['data' => $discounts]);
    }

    // POST /api/v1/workshops/{id}/discounts
    public function store(Request $request, string $id): JsonResponse
    {
        if (!$this->ownsWorkshop($id, $this->userId($request))) {
            return response()->json(['message' => 'No tienes acceso a este taller'], 403);
        }

        $this->validate($request, [
            'type'  => 'required|in:percent,flat',
            'value' => 'required|numeric|min:0.01',
            'label' => 'required|string|max:255',
        ]);

        $discount = DB::selectOne(
            "INSERT INTO discounts
                (workshop_id, session_id, type, value, label, max_uses, active, valid_from, valid_until)
             VALUES (?, ?, ?, ?, ?, ?, true,
                     ?::timestamptz, ?::timestamptz)
             RETURNING id, workshop_id::text, session_id::text, type, value, label,
                       max_uses, uses_count, active,
                       valid_from::text, valid_until::text, created_at::text",
            [
                $id,
                $request->input('session_id'),
                $request->input('type'),
                $request->input('value'),
                $request->input('label'),
                $request->input('max_uses'),
                $request->input('valid_from'),
                $request->input('valid_until'),
            ]
        );

        return response()->json(['data' => $discount], 201);
    }

    // PUT /api/v1/discounts/{id}
    public function update(Request $request, string $id): JsonResponse
    {
        $discount = DB::selectOne(
            "SELECT id, workshop_id::text as workshop_id FROM discounts WHERE id = ?", [$id]
        );
        if (!$discount) {
            return response()->json(['message' => 'Descuento no encontrado'], 404);
        }
        if (!$this->ownsWorkshop($discount->workshop_id, $this->userId($request))) {
            return response()->json(['message' => 'No tienes acceso a este descuento'], 403);
        }

        $sets     = [];
        $bindings = [];

        if ($request->has('active')) {
            $sets[]     = 'active = ?';
            $bindings[] = (bool)$request->input('active');
        }
        if ($request->has('label')) {
            $sets[]     = 'label = ?';
            $bindings[] = $request->input('label');
        }
        if ($request->has('value')) {
            $sets[]     = 'value = ?';
            $bindings[] = (float)$request->input('value');
        }
        if ($request->has('max_uses')) {
            $sets[]     = 'max_uses = ?';
            $bindings[] = $request->input('max_uses');
        }
        if ($request->has('valid_from')) {
            $sets[]     = 'valid_from = ?::timestamptz';
            $bindings[] = $request->input('valid_from');
        }
        if ($request->has('valid_until')) {
            $sets[]     = 'valid_until = ?::timestamptz';
            $bindings[] = $request->input('valid_until');
        }

        if (empty($sets)) {
            return response()->json(['message' => 'Nada que actualizar'], 400);
        }

        $bindings[] = $id;
        $updated = DB::selectOne(
            "UPDATE discounts SET " . implode(', ', $sets) . "
             WHERE id = ?
             RETURNING id, workshop_id::text, session_id::text, type, value, label,
                       max_uses, uses_count, active,
                       valid_from::text, valid_until::text, created_at::text",
            $bindings
        );

        return response()->json(['data' => $updated]);
    }

    // DELETE /api/v1/discounts/{id}
    public function destroy(Request $request, string $id): JsonResponse
    {
        $discount = DB::selectOne(
            "SELECT id, workshop_id::text as workshop_id FROM discounts WHERE id = ?", [$id]
        );
        if (!$discount) {
            return response()->json(['message' => 'Descuento no encontrado'], 404);
        }
        if (!$this->ownsWorkshop($discount->workshop_id, $this->userId($request))) {
            return response()->json(['message' => 'No tienes acceso a este descuento'], 403);
        }

        DB::delete("DELETE FROM discounts WHERE id = ?", [$id]);

        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }

    // GET /api/v1/workshops/{id}/active-discounts  (public — no auth)
    public function publicDiscounts(string $id): JsonResponse
    {
        $now = now()->toIso8601String();
        $discounts = DB::select(
            "SELECT id, workshop_id::text, session_id::text, type, value, label,
                    max_uses, uses_count, valid_from::text, valid_until::text
             FROM discounts
             WHERE workshop_id = ?
               AND active = true
               AND (valid_from IS NULL OR valid_from <= ?::timestamptz)
               AND (valid_until IS NULL OR valid_until >= ?::timestamptz)
               AND (max_uses IS NULL OR uses_count < max_uses)
             ORDER BY (CASE WHEN session_id IS NOT NULL THEN 1 ELSE 0 END), value DESC",
            [$id, $now, $now]
        );
        return response()->json(['data' => $discounts]);
    }

    // -------------------------------------------------------------------------
    // Static helpers used by BookingController
    // -------------------------------------------------------------------------

    /**
     * Find the best active discount for a workshop + optional session.
     * Session-specific discounts take precedence over workshop-wide ones.
     * Returns the stdClass row or null.
     */
    public static function bestActiveDiscount(string $id, ?string $sessionId): ?object
    {
        $now      = now()->toIso8601String();
        $extraSql = '';
        $extra    = [];

        if ($sessionId) {
            $extraSql = ' OR session_id = ?';
            $extra[]  = $sessionId;
        }

        return DB::selectOne(
            "SELECT * FROM discounts
             WHERE workshop_id = ?
               AND active = true
               AND (valid_from IS NULL OR valid_from <= ?::timestamptz)
               AND (valid_until IS NULL OR valid_until >= ?::timestamptz)
               AND (max_uses IS NULL OR uses_count < max_uses)
               AND (session_id IS NULL{$extraSql})
             ORDER BY (CASE WHEN session_id IS NOT NULL THEN 0 ELSE 1 END), value DESC
             LIMIT 1",
            array_merge([$id, $now, $now], $extra)
        );
    }

    /**
     * Calculate the final price after applying a discount.
     * Returns [finalPrice, discountAmount].
     */
    public static function applyDiscount(float $originalPrice, ?object $discount): array
    {
        if (!$discount) {
            return [$originalPrice, 0.0];
        }
        $discountAmount = $discount->type === 'percent'
            ? $originalPrice * ((float)$discount->value / 100)
            : (float)$discount->value;

        $discountAmount = min($discountAmount, $originalPrice);
        return [$originalPrice - $discountAmount, $discountAmount];
    }

    // -------------------------------------------------------------------------

    private function ownsWorkshop(string $id, string $userId): bool
    {
        $count = DB::selectOne(
            "SELECT COUNT(*) as cnt FROM workshops WHERE id = ? AND instructor_id = ?",
            [$id, $userId]
        );
        return (int)($count->cnt ?? 0) > 0;
    }
}
