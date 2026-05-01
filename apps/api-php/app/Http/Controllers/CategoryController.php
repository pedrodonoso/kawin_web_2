<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    // GET /api/v1/categories
    public function index(): JsonResponse
    {
        $categories = DB::select(
            "SELECT id, name, slug, COALESCE(icon,'') as icon,
                    COALESCE(description,'') as description
             FROM categories ORDER BY name"
        );

        return response()->json(['data' => $categories]);
    }
}
