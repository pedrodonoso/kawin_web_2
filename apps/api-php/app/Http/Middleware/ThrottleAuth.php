<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ThrottleAuth
{
    private const MAX_ATTEMPTS = 10;
    private const DECAY_SECONDS = 60;

    public function handle(Request $request, Closure $next)
    {
        $key = 'auth_throttle:' . ($request->ip() ?? 'unknown');
        $attempts = (int) Cache::get($key, 0);

        if ($attempts >= self::MAX_ATTEMPTS) {
            $ttl = Cache::getStore() instanceof \Illuminate\Cache\ArrayStore
                ? self::DECAY_SECONDS
                : (int) ceil((Cache::get("{$key}:timer", time()) - time()));

            return response()->json([
                'message' => 'Demasiados intentos. Intenta de nuevo en un momento.',
            ], 429)->withHeaders([
                'Retry-After' => max($ttl, 1),
                'X-RateLimit-Limit' => self::MAX_ATTEMPTS,
                'X-RateLimit-Remaining' => 0,
            ]);
        }

        $response = $next($request);

        if ($response->getStatusCode() === 401 || $response->getStatusCode() === 409) {
            Cache::put($key, $attempts + 1, self::DECAY_SECONDS);
            Cache::put("{$key}:timer", time() + self::DECAY_SECONDS, self::DECAY_SECONDS);
        }

        return $response->withHeaders([
            'X-RateLimit-Limit' => self::MAX_ATTEMPTS,
            'X-RateLimit-Remaining' => max(0, self::MAX_ATTEMPTS - $attempts - 1),
        ]);
    }
}
