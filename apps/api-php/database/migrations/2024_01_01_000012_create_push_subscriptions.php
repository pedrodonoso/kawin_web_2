<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class CreatePushSubscriptions extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                endpoint    TEXT NOT NULL UNIQUE,
                p256dh      TEXT NOT NULL,
                auth        TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ");

        DB::statement("
            CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
            ON push_subscriptions(user_id)
        ");
    }

    public function down(): void
    {
        DB::statement("DROP TABLE IF EXISTS push_subscriptions");
    }
}
