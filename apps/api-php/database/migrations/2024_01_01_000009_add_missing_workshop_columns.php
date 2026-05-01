<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE workshops
            ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) NOT NULL DEFAULT 'not_submitted'");

        DB::statement("ALTER TABLE workshops
            ADD COLUMN IF NOT EXISTS admin_observations TEXT");

        DB::statement("ALTER TABLE workshops
            ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL");

        DB::statement("ALTER TABLE workshops
            ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ");

        // CHECK constraint (solo si no existe)
        DB::statement("DO \$\$ BEGIN
            ALTER TABLE workshops ADD CONSTRAINT workshops_approval_status_check
                CHECK (approval_status IN ('not_submitted','pending_review','approved','changes_requested'));
        EXCEPTION WHEN duplicate_object THEN NULL; END \$\$");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE workshops DROP COLUMN IF EXISTS reviewed_at');
        DB::statement('ALTER TABLE workshops DROP COLUMN IF EXISTS reviewed_by');
        DB::statement('ALTER TABLE workshops DROP COLUMN IF EXISTS admin_observations');
        DB::statement('ALTER TABLE workshops DROP COLUMN IF EXISTS approval_status');
    }
};
