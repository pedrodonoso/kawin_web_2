<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE TABLE IF NOT EXISTS schedules (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
            days_of_week INTEGER[] NOT NULL,
            time_start   TIME NOT NULL,
            duration_min INTEGER NOT NULL DEFAULT 60,
            valid_from   DATE NOT NULL DEFAULT CURRENT_DATE,
            valid_until  DATE,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_schedules_workshop ON schedules(workshop_id)');

        DB::statement("CREATE TABLE IF NOT EXISTS sessions (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
            schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
            starts_at   TIMESTAMPTZ NOT NULL,
            ends_at     TIMESTAMPTZ NOT NULL,
            cancelled   BOOLEAN NOT NULL DEFAULT FALSE,
            notes       TEXT,
            online_url  TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (workshop_id, schedule_id, starts_at)
        )");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_sessions_schedule  ON sessions(schedule_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_sessions_cancelled ON sessions(cancelled)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS sessions');
        DB::statement('DROP TABLE IF EXISTS schedules');
    }
};
