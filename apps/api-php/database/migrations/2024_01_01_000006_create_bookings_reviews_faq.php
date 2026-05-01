<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE TABLE IF NOT EXISTS bookings (
            id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workshop_id              UUID NOT NULL REFERENCES workshops(id),
            session_id               UUID REFERENCES sessions(id),
            student_id               UUID NOT NULL REFERENCES users(id),
            status                   booking_status NOT NULL DEFAULT 'pending',
            payment_status           payment_status NOT NULL DEFAULT 'pending',
            amount                   NUMERIC(10,2) NOT NULL,
            commission               NUMERIC(10,2) NOT NULL DEFAULT 0,
            commission_absorbed_by   VARCHAR(20),
            cancelled_reason         VARCHAR(50),
            migrated_from_session_id UUID REFERENCES sessions(id),
            mp_payment_id            VARCHAR(255),
            created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_bookings_student  ON bookings(student_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_bookings_workshop ON bookings(workshop_id)');

        DB::statement("CREATE TABLE IF NOT EXISTS reviews (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workshop_id UUID NOT NULL REFERENCES workshops(id),
            student_id  UUID NOT NULL REFERENCES users(id),
            booking_id  UUID REFERENCES bookings(id),
            rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment     TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(workshop_id, student_id)
        )");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_reviews_workshop ON reviews(workshop_id)');

        DB::statement("CREATE TABLE IF NOT EXISTS faq_items (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
            question    TEXT NOT NULL,
            answer      TEXT NOT NULL,
            order_index INTEGER DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS faq_items');
        DB::statement('DROP TABLE IF EXISTS reviews');
        DB::statement('DROP TABLE IF EXISTS bookings');
    }
};
