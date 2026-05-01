<?php

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    // POST /api/v1/auth/register
    public function register(Request $request): JsonResponse
    {
        $this->validate($request, [
            'name'     => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|min:8',
            'role'     => 'sometimes|string',
        ]);

        $role = $request->input('role', 'student') ?: 'student';
        $hash = password_hash($request->input('password'), PASSWORD_BCRYPT);

        try {
            $userId = DB::selectOne(
                "INSERT INTO users (email, password_hash, role)
                 VALUES (?, ?, ?)
                 RETURNING id",
                [$request->input('email'), $hash, $role]
            )->id;
        } catch (\Exception $e) {
            return response()->json(['message' => 'El email ya está registrado'], 409);
        }

        DB::insert(
            "INSERT INTO profiles (user_id, name) VALUES (?, ?)
             ON CONFLICT (user_id) DO NOTHING",
            [$userId, $request->input('name')]
        );

        $token = $this->makeToken($userId, $request->input('email'), $role);

        return response()->json([
            'token' => $token,
            'user'  => ['id' => $userId, 'email' => $request->input('email'), 'role' => $role],
        ], 201);
    }

    // POST /api/v1/auth/login
    public function login(Request $request): JsonResponse
    {
        $this->validate($request, [
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = DB::selectOne(
            "SELECT id, password_hash, role FROM users WHERE email = ?",
            [$request->input('email')]
        );

        if (!$user || !password_verify($request->input('password'), $user->password_hash)) {
            return response()->json(['message' => 'Credenciales incorrectas'], 401);
        }

        $token = $this->makeToken($user->id, $request->input('email'), $user->role);

        return response()->json([
            'token' => $token,
            'user'  => ['id' => $user->id, 'email' => $request->input('email'), 'role' => $user->role],
        ]);
    }

    // -----------------------------------------------------------------------

    private function makeToken(string $userId, string $email, string $role): string
    {
        $payload = [
            'sub'   => $userId,
            'email' => $email,
            'role'  => $role,
            'exp'   => time() + (30 * 24 * 60 * 60),
        ];

        return JWT::encode($payload, env('API_SECRET', 'dev-secret'), 'HS256');
    }
}
