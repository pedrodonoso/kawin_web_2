<?php

namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;
use Throwable;

class OptionalAuth
{
    public function handle(Request $request, Closure $next)
    {
        $header = $request->header('Authorization', '');

        if (str_starts_with($header, 'Bearer ')) {
            $token  = substr($header, 7);
            $secret = env('API_SECRET');
            if (!$secret) {
                return $next($request);
            }

            try {
                $decoded = JWT::decode($token, new Key($secret, 'HS256'));
                $request->attributes->set('userID',    $decoded->sub);
                $request->attributes->set('userRole',  $decoded->role  ?? 'student');
                $request->attributes->set('userEmail', $decoded->email ?? '');
            } catch (Throwable) {
                // Invalid token — treat as unauthenticated
            }
        }

        return $next($request);
    }
}
