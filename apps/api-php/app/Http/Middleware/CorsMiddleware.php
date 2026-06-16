<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CorsMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $allowedOrigins = array_filter(
            array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000')))
        );

        $origin = $request->header('Origin', '');

        if ($request->isMethod('OPTIONS')) {
            $headers = [
                'Access-Control-Allow-Methods'  => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers'  => 'Content-Type, Authorization, X-Requested-With',
                'Access-Control-Allow-Credentials' => 'true',
                'Access-Control-Max-Age'        => '86400',
                'Vary'                          => 'Origin',
            ];
            if (in_array($origin, $allowedOrigins, true)) {
                $headers['Access-Control-Allow-Origin'] = $origin;
            }
            return response('', 204, $headers);
        }

        $response = $next($request);

        if (in_array($origin, $allowedOrigins, true)) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
        }
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');
        $response->headers->set('Vary', 'Origin');

        return $response;
    }
}
