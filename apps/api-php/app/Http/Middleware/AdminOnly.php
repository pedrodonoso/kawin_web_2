<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminOnly
{
    public function handle(Request $request, Closure $next)
    {
        $role = $request->attributes->get('userRole', '');

        if ($role !== 'admin') {
            return response()->json(['message' => 'Acceso denegado'], 403);
        }

        return $next($request);
    }
}
