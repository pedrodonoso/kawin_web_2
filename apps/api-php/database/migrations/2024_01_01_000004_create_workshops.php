<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE TABLE IF NOT EXISTS workshops (
            id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            instructor_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category_id        UUID REFERENCES categories(id) ON DELETE SET NULL,
            title              VARCHAR(255) NOT NULL,
            slug               VARCHAR(255) UNIQUE NOT NULL,
            description        TEXT,
            type               workshop_type NOT NULL DEFAULT 'workshop',
            modality           workshop_modality NOT NULL DEFAULT 'in-person',
            price              INTEGER NOT NULL DEFAULT 0,
            currency           VARCHAR(3) NOT NULL DEFAULT 'CLP',
            capacity           INTEGER,
            location           VARCHAR(255),
            address            TEXT,
            lat                NUMERIC(10,7),
            lng                NUMERIC(10,7),
            online_url         TEXT,
            cover_image_url    TEXT,
            status             workshop_status NOT NULL DEFAULT 'draft',
            approval_status    VARCHAR(30) NOT NULL DEFAULT 'not_submitted'
                               CHECK (approval_status IN ('not_submitted','pending_review','approved','changes_requested')),
            admin_observations TEXT,
            reviewed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at        TIMESTAMPTZ,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_workshops_instructor ON workshops(instructor_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_workshops_category   ON workshops(category_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_workshops_status     ON workshops(status)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_workshops_type       ON workshops(type)');
        DB::statement("CREATE INDEX IF NOT EXISTS idx_workshops_search ON workshops
            USING gin(to_tsvector('spanish', title || ' ' || COALESCE(description, '')))");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS workshops');
    }
};
