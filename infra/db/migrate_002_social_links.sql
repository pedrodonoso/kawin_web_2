-- Migration 002: Add social links to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT;
