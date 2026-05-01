<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE TABLE IF NOT EXISTS notifications (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            type            VARCHAR(255) NOT NULL,
            notifiable_type VARCHAR(255) NOT NULL,
            notifiable_id   UUID NOT NULL,
            data            TEXT NOT NULL,
            read_at         TIMESTAMPTZ,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )");

        DB::statement("CREATE INDEX IF NOT EXISTS idx_notifications_notifiable
            ON notifications (notifiable_type, notifiable_id, read_at)");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS notifications');
    }
};
