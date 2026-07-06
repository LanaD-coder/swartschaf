-- ============================================================
-- Onboarding flag + profile visibility lockdown
-- Run this in Supabase SQL Editor after 006_avatars_storage.sql
-- ============================================================

-- Add the column with DEFAULT true first so every existing profile is backfilled
-- to "already seen onboarding" (they've been using the app — don't force a tutorial
-- on them). Then flip the default to false so all future rows (new signups/employees)
-- start unseen.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_onboarding boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ALTER COLUMN has_seen_onboarding SET DEFAULT false;

-- profiles_owner_write is FOR ALL (covers SELECT) and already grants owners full
-- salon-wide profile read. profiles_salon_read additionally lets EMPLOYEES read
-- every teammate's profile too — not desired. Drop it; profiles_self (id = auth.uid())
-- still gives every user read/write of their own row (needed so an employee can set
-- their own has_seen_onboarding).
DROP POLICY IF EXISTS "profiles_salon_read" ON profiles;
