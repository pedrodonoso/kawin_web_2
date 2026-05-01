<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class CreateDiscounts extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS discounts (
                id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
                workshop_id  UUID          NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
                session_id   UUID          REFERENCES sessions(id) ON DELETE CASCADE,
                type         VARCHAR(10)   NOT NULL CHECK (type IN ('percent', 'flat')),
                value        NUMERIC(10,2) NOT NULL CHECK (value > 0),
                label        VARCHAR(255)  NOT NULL DEFAULT '',
                max_uses     INTEGER,
                uses_count   INTEGER       NOT NULL DEFAULT 0,
                active       BOOLEAN       NOT NULL DEFAULT true,
                valid_from   TIMESTAMPTZ,
                valid_until  TIMESTAMPTZ,
                created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
            )
        ");

        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_discounts_workshop
            ON discounts(workshop_id) WHERE active = true
        ");

        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_discounts_session
            ON discounts(session_id) WHERE active = true AND session_id IS NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS discounts');
    }
}
