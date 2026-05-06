<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_phone     BOOLEAN NOT NULL DEFAULT TRUE");
        DB::statement("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_whatsapp  BOOLEAN NOT NULL DEFAULT TRUE");
        DB::statement("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_instagram BOOLEAN NOT NULL DEFAULT TRUE");
        DB::statement("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_facebook  BOOLEAN NOT NULL DEFAULT TRUE");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE profiles DROP COLUMN IF EXISTS show_phone");
        DB::statement("ALTER TABLE profiles DROP COLUMN IF EXISTS show_whatsapp");
        DB::statement("ALTER TABLE profiles DROP COLUMN IF EXISTS show_instagram");
        DB::statement("ALTER TABLE profiles DROP COLUMN IF EXISTS show_facebook");
    }
};
