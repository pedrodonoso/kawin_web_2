<?php

namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;
use Throwable;

class Authenticate
{
    public function handle(Request $request, Closure $next)
    {
        $header = $request->header('Authorization', '');

        if (!str_starts_with($header, 'Bearer ')) {
            return response()->json(['message' => 'Token requerido'], 401);
        }

        $token = substr($header, 7);
        $secret = env('API_SECRET');
        if (!$secret) {
            return response()->json(['message' => 'Server misconfigured'], 500);
        }

        try {
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
        } catch (Throwable $e) {
            return response()->json(['message' => 'Token inválido'], 401);
        }

        // Inject claims into the request for downstream use
        $request->attributes->set('userID', $decoded->sub);
        $request->attributes->set('userRole', $decoded->role ?? 'student');
        $request->attributes->set('userEmail', $decoded->email ?? '');

        return $next($request);
    }
}
