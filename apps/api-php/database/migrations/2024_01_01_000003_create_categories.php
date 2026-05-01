<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE TABLE IF NOT EXISTS categories (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name        VARCHAR(100) NOT NULL,
            slug        VARCHAR(100) UNIQUE NOT NULL,
            icon        VARCHAR(50),
            description TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS categories');
    }
};
