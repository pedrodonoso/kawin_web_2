<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE workshops ADD COLUMN IF NOT EXISTS notes TEXT");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE workshops DROP COLUMN IF EXISTS notes");
    }
};
