<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Venues ("sedes"): physical places that host multiple workshops, courses and
 * events (e.g. "casas taller"). They are ONLY a way to group workshops on the
 * map and in listings — no registration or booking logic attached.
 *
 * Managed exclusively by admins. Instructors can only pick an existing venue
 * for their workshop. When a workshop belongs to a venue, the venue's
 * coordinates/address take precedence over the workshop's own fields.
 */
class CreateVenues extends Migration
{
    public function up(): void
    {
        DB::statement("DO $$ BEGIN
            CREATE TYPE venue_status AS ENUM ('active', 'inactive');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$");

        DB::statement("
            CREATE TABLE IF NOT EXISTS venues (
                id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                created_by      UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                name            VARCHAR(255) NOT NULL,
                slug            VARCHAR(255) NOT NULL UNIQUE,
                description     TEXT         NOT NULL DEFAULT '',
                address         TEXT         NOT NULL DEFAULT '',
                city            VARCHAR(100) NOT NULL DEFAULT '',
                country         VARCHAR(100) NOT NULL DEFAULT 'Chile',
                lat             NUMERIC(10,7),
                lng             NUMERIC(10,7),
                cover_image_url TEXT         NOT NULL DEFAULT '',
                phone           VARCHAR(50)  NOT NULL DEFAULT '',
                whatsapp        VARCHAR(50)  NOT NULL DEFAULT '',
                instagram_url   VARCHAR(255) NOT NULL DEFAULT '',
                facebook_url    VARCHAR(255) NOT NULL DEFAULT '',
                website         TEXT         NOT NULL DEFAULT '',
                status          venue_status NOT NULL DEFAULT 'active',
                created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        ");

        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_venues_status ON venues(status)
        ");

        DB::statement("
            ALTER TABLE workshops
                ADD COLUMN IF NOT EXISTS venue_id UUID
                    REFERENCES venues(id) ON DELETE SET NULL
        ");

        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_workshops_venue
            ON workshops(venue_id) WHERE venue_id IS NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE workshops DROP COLUMN IF EXISTS venue_id");
        DB::statement("DROP TABLE IF EXISTS venues");
        DB::statement("DROP TYPE IF EXISTS venue_status");
    }
}
