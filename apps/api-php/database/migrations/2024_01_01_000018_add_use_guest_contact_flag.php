<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class AddUseGuestContactFlag extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE workshops ADD COLUMN IF NOT EXISTS use_guest_contact BOOLEAN NOT NULL DEFAULT TRUE");
        DB::statement("ALTER TABLE routes    ADD COLUMN IF NOT EXISTS use_guest_contact BOOLEAN NOT NULL DEFAULT TRUE");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE workshops DROP COLUMN IF EXISTS use_guest_contact");
        DB::statement("ALTER TABLE routes    DROP COLUMN IF EXISTS use_guest_contact");
    }
}
