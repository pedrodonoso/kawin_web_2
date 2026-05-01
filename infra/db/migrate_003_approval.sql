-- Migration 003: add approval workflow columns to workshops
-- Idempotent: safe to re-run

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workshops' AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE workshops
            ADD COLUMN approval_status VARCHAR(30) NOT NULL DEFAULT 'not_submitted'
            CONSTRAINT workshops_approval_status_check
            CHECK (approval_status IN ('not_submitted','pending_review','approved','changes_requested'));
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workshops' AND column_name = 'admin_observations'
    ) THEN
        ALTER TABLE workshops ADD COLUMN admin_observations TEXT;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workshops' AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE workshops ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workshops' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE workshops ADD COLUMN reviewed_by UUID REFERENCES users(id);
    END IF;
END$$;
