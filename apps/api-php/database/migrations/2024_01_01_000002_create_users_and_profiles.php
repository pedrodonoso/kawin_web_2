<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE TABLE IF NOT EXISTS users (
            id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email          VARCHAR(255) UNIQUE NOT NULL,
            password_hash  VARCHAR(255),
            role           user_role NOT NULL DEFAULT 'student',
            email_verified BOOLEAN DEFAULT FALSE,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )");

        DB::statement("CREATE TABLE IF NOT EXISTS profiles (
            id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name          VARCHAR(255) NOT NULL,
            bio           TEXT,
            avatar_url    TEXT,
            phone         VARCHAR(50),
            whatsapp      VARCHAR(50),
            telegram      VARCHAR(100),
            city          VARCHAR(100),
            country       VARCHAR(100) DEFAULT 'Chile',
            instagram_url VARCHAR(255),
            facebook_url  VARCHAR(255),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id)
        )");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS profiles');
        DB::statement('DROP TABLE IF EXISTS users');
    }
};
