<?php

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Cookie;

class AuthController extends Controller
{
    private const ALLOWED_ROLES = ['student', 'instructor'];
    private const TOKEN_TTL = 24 * 60 * 60; // 24 hours

    // POST /api/v1/auth/register
    public function register(Request $request): JsonResponse
    {
        $this->validate($request, [
            'name'     => 'required|string|max:120',
            'email'    => 'required|email|max:255',
            'password' => [
                'required', 'min:8', 'max:128',
                'regex:/[A-Z]/',
                'regex:/[a-z]/',
                'regex:/[0-9]/',
                'regex:/[@$!%*?&#._\-]/',
            ],
            'role'     => 'sometimes|string|in:student,instructor',
        ], [
            'name.required'     => 'El nombre es obligatorio.',
            'email.required'    => 'El email es obligatorio.',
            'email.email'       => 'El email no tiene un formato válido.',
            'password.required' => 'La contraseña es obligatoria.',
            'password.min'      => 'La contraseña debe tener al menos 8 caracteres.',
            'password.regex'    => 'La contraseña debe incluir mayúscula, minúscula, número y símbolo (@$!%*?&#._-).',
        ]);

        $role = $request->input('role', 'student') ?: 'student';
        if (!in_array($role, self::ALLOWED_ROLES, true)) {
            $role = 'student';
        }

        $email = mb_strtolower(trim($request->input('email')));
        $name = strip_tags(trim($request->input('name')));
        $hash = password_hash($request->input('password'), PASSWORD_BCRYPT);

        try {
            $userId = DB::selectOne(
                "INSERT INTO users (email, password_hash, role)
                 VALUES (?, ?, ?)
                 RETURNING id",
                [$email, $hash, $role]
            )->id;
        } catch (\Exception $e) {
            // Generic message to prevent user enumeration (SEC-06)
            return response()->json(['message' => 'No se pudo crear la cuenta. Intenta con otro email.'], 422);
        }

        DB::insert(
            "INSERT INTO profiles (user_id, name) VALUES (?, ?)
             ON CONFLICT (user_id) DO NOTHING",
            [$userId, $name]
        );

        $token = $this->makeToken($userId, $email, $role);
        $response = response()->json([
            'token' => $token,
            'user'  => ['id' => $userId, 'email' => $email, 'role' => $role],
        ], 201);

        $response->headers->setCookie($this->makeTokenCookie($token));

        return $response;
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

        $token    = $this->makeToken($user->id, $email, $user->role);
        $response = response()->json([
            'token' => $token,
            'user'  => ['id' => $user->id, 'email' => $email, 'role' => $user->role],
        ]);

        $response->headers->setCookie($this->makeTokenCookie($token));

        return $response;
    }

    // POST /api/v1/auth/logout
    public function logout(): JsonResponse
    {
        $response = response()->json(['message' => 'Sesión cerrada']);
        $response->headers->setCookie($this->makeTokenCookie('', 0));
        return $response;
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

    private function makeTokenCookie(string $value, ?int $ttl = null): Cookie
    {
        $ttl    = $ttl ?? self::TOKEN_TTL;
        $secure = app()->environment('production');

        return new Cookie(
            'token',
            $value,
            time() + $ttl,
            '/',
            null,
            $secure,
            true,    // httpOnly — JS cannot read this cookie
            false,
            'Strict'
        );
    }
}
