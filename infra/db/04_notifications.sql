-- Migration: tabla de notificaciones in-app para Laravel Notifications (database channel)
-- Ejecutar una sola vez contra la base de datos kawin.

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(255) NOT NULL,
    notifiable_type VARCHAR(255) NOT NULL,
    notifiable_id   UUID        NOT NULL,
    data            TEXT        NOT NULL,
    read_at         TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_notifiable
    ON notifications (notifiable_type, notifiable_id, read_at);
