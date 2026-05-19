<?php

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    private const ALLOWED_ROLES = ['student', 'instructor'];
    private const TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

    // POST /api/v1/auth/register
    public function register(Request $request): JsonResponse
    {
        $this->validate($request, [
            'name'     => 'required|string|max:120',
            'email'    => 'required|email|max:255',
            'password' => 'required|min:8|max:128',
            'role'     => 'sometimes|string|in:student,instructor',
        ]);

        $role = $request->input('role', 'student') ?: 'student';
        if (!in_array($role, self::ALLOWED_ROLES, true)) {
            $role = 'student';
        }

        $email = mb_strtolower(trim($request->input('email')));
        $hash = password_hash($request->input('password'), PASSWORD_BCRYPT);

        try {
            $userId = DB::selectOne(
                "INSERT INTO users (email, password_hash, role)
                 VALUES (?, ?, ?)
                 RETURNING id",
                [$email, $hash, $role]
            )->id;
        } catch (\Exception $e) {
            return response()->json(['message' => 'El email ya está registrado'], 409);
        }

        DB::insert(
            "INSERT INTO profiles (user_id, name) VALUES (?, ?)
             ON CONFLICT (user_id) DO NOTHING",
            [$userId, trim($request->input('name'))]
        );

        $token = $this->makeToken($userId, $email, $role);

        return response()->json([
            'token' => $token,
            'user'  => ['id' => $userId, 'email' => $email, 'role' => $role],
        ], 201);
    }

    // POST /api/v1/auth/login
    public function login(Request $request): JsonResponse
    {
        $this->validate($request, [
            'email'    => 'required|email|max:255',
            'password' => 'required|max:128',
        ]);

        $email = mb_strtolower(trim($request->input('email')));

        $user = DB::selectOne(
            "SELECT id, password_hash, role FROM users WHERE email = ?",
            [$email]
        );

        if (!$user || !password_verify($request->input('password'), $user->password_hash)) {
            return response()->json(['message' => 'Credenciales incorrectas'], 401);
        }

        $token = $this->makeToken($user->id, $email, $user->role);

        return response()->json([
            'token' => $token,
            'user'  => ['id' => $user->id, 'email' => $email, 'role' => $user->role],
        ]);
    }

    // -----------------------------------------------------------------------

    private function makeToken(string $userId, string $email, string $role): string
    {
        $secret = env('API_SECRET');
        if (!$secret) {
            throw new \RuntimeException('API_SECRET env var is not set');
        }

        $payload = [
            'sub'   => $userId,
            'email' => $email,
            'role'  => $role,
            'iat'   => time(),
            'exp'   => time() + self::TOKEN_TTL,
        ];

        return JWT::encode($payload, $secret, 'HS256');
    }
}
