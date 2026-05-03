<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Guest contacts: instructor/guide info for workshops and routes created by admin
 * on behalf of external collaborators who don't have a Kawin account yet.
 *
 * Migration path (future): once the collaborator creates an account,
 * set workshops.instructor_id = new_user_id, set guest_contact_id = NULL.
 */
class CreateGuestContacts extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS guest_contacts (
                id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                created_by  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                name        VARCHAR(255) NOT NULL,
                email       VARCHAR(255) NOT NULL DEFAULT '',
                phone       VARCHAR(50)  NOT NULL DEFAULT '',
                whatsapp    VARCHAR(50)  NOT NULL DEFAULT '',
                bio         TEXT         NOT NULL DEFAULT '',
                instagram   VARCHAR(100) NOT NULL DEFAULT '',
                website     TEXT         NOT NULL DEFAULT '',
                created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        ");

        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_guest_contacts_created_by
            ON guest_contacts(created_by)
        ");

        DB::statement("
            ALTER TABLE workshops
                ADD COLUMN IF NOT EXISTS guest_contact_id UUID
                    REFERENCES guest_contacts(id) ON DELETE SET NULL
        ");

        DB::statement("
            ALTER TABLE routes
                ADD COLUMN IF NOT EXISTS guest_contact_id UUID
                    REFERENCES guest_contacts(id) ON DELETE SET NULL
        ");

        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_workshops_guest_contact
            ON workshops(guest_contact_id) WHERE guest_contact_id IS NOT NULL
        ");

        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_routes_guest_contact
            ON routes(guest_contact_id) WHERE guest_contact_id IS NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE routes DROP COLUMN IF EXISTS guest_contact_id");
        DB::statement("ALTER TABLE workshops DROP COLUMN IF EXISTS guest_contact_id");
        DB::statement("DROP TABLE IF EXISTS guest_contacts");
    }
}
