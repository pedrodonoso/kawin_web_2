<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Categories
        DB::statement("INSERT INTO categories (name, slug, icon) VALUES
            ('Arte y Creatividad',   'arte-creatividad',   'palette'),
            ('Cocina y Gastronomía', 'cocina-gastronomia', 'chef-hat'),
            ('Música y Danza',       'musica-danza',       'music'),
            ('Bienestar y Salud',    'bienestar-salud',    'heart'),
            ('Tecnología',           'tecnologia',         'code'),
            ('Idiomas',              'idiomas',            'globe'),
            ('Deportes',             'deportes',           'activity'),
            ('Negocios',             'negocios',           'briefcase'),
            ('Fotografía',           'fotografia',         'camera'),
            ('Artesanía',            'artesania',          'scissors')
            ON CONFLICT (slug) DO NOTHING");

        // Users (password: test1234)
        DB::statement("INSERT INTO users (id, email, password_hash, role) VALUES
            ('00000000-0000-0000-0000-000000000001', 'maria@kawin.app',
             '\$2a\$10\$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'instructor'),
            ('00000000-0000-0000-0000-000000000002', 'carlos@kawin.app',
             '\$2a\$10\$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'student'),
            ('00000000-0000-0000-0000-000000000003', 'jorge@kawin.app',
             '\$2a\$10\$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'instructor'),
            ('00000000-0000-0000-0000-000000000004', 'camila@kawin.app',
             '\$2a\$10\$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'instructor'),
            ('00000000-0000-0000-0000-000000000005', 'pablo@kawin.app',
             '\$2a\$10\$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'instructor'),
            ('00000000-0000-0000-0000-000000000099', 'admin@kawin.app',
             '\$2a\$10\$8lU7Wn25aYsRnBURkQB.Q.ZeOcDorE1W9h3RSMxwuMAoW.xlV/rhW', 'admin')
            ON CONFLICT DO NOTHING");

        // Profiles
        DB::statement("INSERT INTO profiles (user_id, name, bio, city, country) VALUES
            ('00000000-0000-0000-0000-000000000099', 'Administrador Kawin',
             'Equipo de revisión y moderación de Kawin.', 'Santiago', 'Chile'),
            ('00000000-0000-0000-0000-000000000001', 'María González',
             'Artista visual con 10 años de experiencia.', 'Santiago', 'Chile'),
            ('00000000-0000-0000-0000-000000000002', 'Carlos Moreno',
             'Apasionado por la música y el bienestar.', 'Santiago', 'Chile'),
            ('00000000-0000-0000-0000-000000000003', 'Jorge Castillo',
             'DJ y productor musical con 15 años en la escena electrónica chilena.', 'Santiago', 'Chile'),
            ('00000000-0000-0000-0000-000000000004', 'Camila Rojas',
             'Escritora y editora con Magíster en Literatura.', 'Santiago', 'Chile'),
            ('00000000-0000-0000-0000-000000000005', 'Pablo Morales',
             'Emprendedor en serie y consultor de negocios.', 'Santiago', 'Chile')
            ON CONFLICT DO NOTHING");
    }

    public function down(): void
    {
        // No revertir seed data
    }
};
