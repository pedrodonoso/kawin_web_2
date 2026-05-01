<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        DB::statement('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');

        DB::statement("DO $$ BEGIN
            CREATE TYPE user_role AS ENUM ('student', 'instructor', 'both', 'admin');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$");

        DB::statement("DO $$ BEGIN
            CREATE TYPE workshop_type AS ENUM ('workshop', 'course', 'class', 'event');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$");

        DB::statement("DO $$ BEGIN
            CREATE TYPE workshop_modality AS ENUM ('in-person', 'online', 'hybrid');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$");

        DB::statement("DO $$ BEGIN
            CREATE TYPE workshop_status AS ENUM ('draft', 'published', 'archived');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$");

        DB::statement("DO $$ BEGIN
            CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$");

        DB::statement("DO $$ BEGIN
            CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$");
    }

    public function down(): void
    {
        // Enums se eliminan con las tablas que los usan
    }
};
