-- Migration 001: Scheduling system
-- Run this against existing databases. init.sql already includes these changes.

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  days_of_week INTEGER[] NOT NULL,
  time_start   TIME NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  valid_from   DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add schedule_id and cancelled to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled BOOLEAN NOT NULL DEFAULT FALSE;

-- Add scheduling columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS commission_absorbed_by   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cancelled_reason         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS migrated_from_session_id UUID REFERENCES sessions(id);

-- Unique constraint for safe session materialization
ALTER TABLE sessions
  ADD CONSTRAINT IF NOT EXISTS uq_sessions_workshop_schedule_starts
  UNIQUE (workshop_id, schedule_id, starts_at);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schedules_workshop ON schedules(workshop_id);
CREATE INDEX IF NOT EXISTS idx_sessions_schedule  ON sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sessions_cancelled ON sessions(cancelled);
