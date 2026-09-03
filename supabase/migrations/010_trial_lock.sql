-- ============================================================
-- Trial-lock enforcement
-- Run this in Supabase SQL Editor after 009_schwarzarbeit_compliance.sql
--
-- CLAUDE.md has documented "expired subscription -> read-only mode" as a rule
-- since early on, but it was never actually enforced anywhere (verified: no
-- RLS policy or app code ever checked subscription_status). This migration
-- builds it, for the pilot-week sales model: a salon locks to read-only once
-- its trial has expired and it isn't marked 'active'. SELECT stays open
-- everywhere (view + PDF export keep working, per the documented rule) —
-- only INSERT/UPDATE/DELETE on operational data is blocked. Unlocking is
-- manual: flip salons.subscription_status to 'active' once paid outside the
-- app (no in-app billing, see CLAUDE.md's Billing note).
--
-- Postgres RLS policies for the same command are OR'd together, so the lock
-- check has to *replace* each permissive "FOR ALL" write policy, not just add
-- alongside it — otherwise the old unconditional policy still grants access.
-- salons.salon_owner_all is deliberately left untouched: editing salon
-- metadata isn't the "keep using the service" behavior this is meant to stop,
-- and the owner needs their own row visible regardless of lock state.
-- ============================================================

-- Shorten the default trial window from 14 to 7 days, matching the pilot-week
-- sales model. Only affects new salons going forward.
ALTER TABLE salons ALTER COLUMN trial_ends_at SET DEFAULT (now() + INTERVAL '7 days');

CREATE OR REPLACE FUNCTION salon_is_locked()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.subscription_status <> 'active' AND now() > s.trial_ends_at
  FROM salons s
  WHERE s.id = current_salon_id()
$$;

-- ── profiles: owner manages employees ────────────────────────
DROP POLICY IF EXISTS "profiles_owner_write" ON profiles;
CREATE POLICY "profiles_owner_select" ON profiles
  FOR SELECT USING (salon_id = current_salon_id() AND get_user_role() = 'owner');
CREATE POLICY "profiles_owner_insert" ON profiles
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
CREATE POLICY "profiles_owner_update" ON profiles
  FOR UPDATE USING (salon_id = current_salon_id() AND get_user_role() = 'owner')
  WITH CHECK (salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked());
CREATE POLICY "profiles_owner_delete" ON profiles
  FOR DELETE USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
-- profiles_self (id = auth.uid()) is untouched — everyone can still edit their own row
-- (has_seen_onboarding, avatar_url, etc.) even while locked; it's personal preference,
-- not "using the service."

-- ── service_categories ────────────────────────────────────────
DROP POLICY IF EXISTS "categories_owner_write" ON service_categories;
CREATE POLICY "categories_owner_select" ON service_categories
  FOR SELECT USING (salon_id = current_salon_id() AND get_user_role() = 'owner');
CREATE POLICY "categories_owner_insert" ON service_categories
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
CREATE POLICY "categories_owner_update" ON service_categories
  FOR UPDATE USING (salon_id = current_salon_id() AND get_user_role() = 'owner')
  WITH CHECK (salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked());
CREATE POLICY "categories_owner_delete" ON service_categories
  FOR DELETE USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
-- categories_salon_read (plain SELECT for all salon members) is untouched.

-- ── appointments: owner side ─────────────────────────────────
DROP POLICY IF EXISTS "appointments_owner_all" ON appointments;
CREATE POLICY "appointments_owner_select" ON appointments
  FOR SELECT USING (salon_id = current_salon_id() AND get_user_role() = 'owner');
CREATE POLICY "appointments_owner_insert" ON appointments
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
CREATE POLICY "appointments_owner_update" ON appointments
  FOR UPDATE USING (salon_id = current_salon_id() AND get_user_role() = 'owner')
  WITH CHECK (salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked());
CREATE POLICY "appointments_owner_delete" ON appointments
  FOR DELETE USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );

-- ── appointments: employee side (timers + walk-ins also stop while locked) ──
DROP POLICY IF EXISTS "appointments_employee_timer" ON appointments;
CREATE POLICY "appointments_employee_timer" ON appointments
  FOR UPDATE USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid() AND NOT salon_is_locked());

DROP POLICY IF EXISTS "appointments_employee_walkin" ON appointments;
CREATE POLICY "appointments_employee_walkin" ON appointments
  FOR INSERT WITH CHECK (
    assigned_to = auth.uid()
    AND customer_type = 'walkin'
    AND salon_id = current_salon_id()
    AND NOT salon_is_locked()
  );
-- appointments_employee_read (SELECT) is untouched — employees can still view their own.

-- ── correction_requests ───────────────────────────────────────
DROP POLICY IF EXISTS "corrections_employee_insert" ON correction_requests;
CREATE POLICY "corrections_employee_insert" ON correction_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid() AND NOT salon_is_locked());
-- corrections_employee_read (SELECT) is untouched.

DROP POLICY IF EXISTS "corrections_owner_all" ON correction_requests;
CREATE POLICY "corrections_owner_select" ON correction_requests
  FOR SELECT USING (
    get_user_role() = 'owner' AND
    EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id AND a.salon_id = current_salon_id())
  );
CREATE POLICY "corrections_owner_update" ON correction_requests
  FOR UPDATE USING (
    get_user_role() = 'owner' AND
    EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id AND a.salon_id = current_salon_id())
  )
  WITH CHECK (get_user_role() = 'owner' AND NOT salon_is_locked());

-- ── breaks ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "breaks_own_all" ON breaks;
CREATE POLICY "breaks_own_select" ON breaks
  FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "breaks_own_insert" ON breaks
  FOR INSERT WITH CHECK (profile_id = auth.uid() AND NOT salon_is_locked());
CREATE POLICY "breaks_own_update" ON breaks
  FOR UPDATE USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid() AND NOT salon_is_locked());
CREATE POLICY "breaks_own_delete" ON breaks
  FOR DELETE USING (profile_id = auth.uid() AND NOT salon_is_locked());
-- breaks_owner_read (SELECT) is untouched.

-- generated_reports is deliberately untouched — report generation is "export",
-- which the documented rule explicitly keeps working while locked.
