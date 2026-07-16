<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * workshop_instructors: co-talleristas adicionales de un taller (SOLO VISIBILIDAD).
 *
 * El tallerista principal/dueño sigue siendo workshops.instructor_id (o el
 * guest_contact vía use_guest_contact). Esta tabla agrega talleristas EXTRA que
 * se muestran en la ficha pública, sin otorgarles ningún permiso de gestión,
 * ingresos ni notificaciones.
 *
 * Cada fila apunta a EXACTAMENTE uno de:
 *   - user_id          → tallerista registrado (perfil en profiles)
 *   - guest_contact_id → tallerista fantasma (datos en guest_contacts)
 */
class CreateWorkshopInstructors extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS workshop_instructors (
                id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                workshop_id      UUID        NOT NULL REFERENCES workshops(id)      ON DELETE CASCADE,
                user_id          UUID                 REFERENCES users(id)          ON DELETE CASCADE,
                guest_contact_id UUID                 REFERENCES guest_contacts(id) ON DELETE CASCADE,
                display_order    INT         NOT NULL DEFAULT 0,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT workshop_instructors_one_ref
                    CHECK ((user_id IS NOT NULL)::int + (guest_contact_id IS NOT NULL)::int = 1)
            )
        ");

        // Evita duplicar el mismo tallerista (registrado o fantasma) en un taller.
        DB::statement("
            CREATE UNIQUE INDEX IF NOT EXISTS uq_workshop_instructors_user
            ON workshop_instructors(workshop_id, user_id) WHERE user_id IS NOT NULL
        ");
        DB::statement("
            CREATE UNIQUE INDEX IF NOT EXISTS uq_workshop_instructors_guest
            ON workshop_instructors(workshop_id, guest_contact_id) WHERE guest_contact_id IS NOT NULL
        ");
        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_workshop_instructors_workshop
            ON workshop_instructors(workshop_id)
        ");
    }

    public function down(): void
    {
        DB::statement("DROP TABLE IF EXISTS workshop_instructors");
    }
}
