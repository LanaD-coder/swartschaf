-- ============================================================
-- Mandatory PIN reset on an employee's first login
-- Run this in Supabase SQL Editor after 015_appointment_services_junction.sql
--
-- The owner sets an employee's initial PIN at creation time (create-employee
-- Edge Function). That PIN is now treated as temporary: on first login, the
-- employee is forced to set their own PIN before reaching the app.
--
-- Two things needed for an employee to actually change their own PIN:
--   1. profiles.pin_hash — currently blocked from ANY non-service-role change
--      by prevent_profile_privilege_escalation (004). Loosened here to allow
--      a user to change their OWN pin_hash (auth.uid() = id); still blocked
--      for anyone changing someone else's.
--   2. The Supabase Auth password itself (separate from pin_hash — pin_hash
--      backs the pre-auth verify_employee_pin RPC, the Auth password backs
--      the actual signInWithPassword call). That's changed client-side via
--      supabase.auth.updateUser({ password }), which needs no RLS/trigger
--      change — it's the standard "change your own password" Auth API call.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_reset_pin boolean NOT NULL DEFAULT false;
-- Default false is correct for existing rows (already using a real PIN, not
-- forced into this retroactively) — create-employee sets it explicitly true
-- for new rows going forward.

CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.salon_id IS DISTINCT FROM OLD.salon_id THEN
    RAISE EXCEPTION 'role and salon_id cannot be changed directly';
  END IF;

  -- pin_hash: only the profile's own owner may change it now (self-service
  -- PIN reset). Anyone changing someone else's pin_hash is still blocked —
  -- this does not let an owner silently overwrite an employee's PIN either.
  IF NEW.pin_hash IS DISTINCT FROM OLD.pin_hash AND auth.uid() IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'pin_hash can only be changed by the profile owner or the service role';
  END IF;

  IF (NEW.sofortmeldung_confirmed_at IS DISTINCT FROM OLD.sofortmeldung_confirmed_at
      OR NEW.sofortmeldung_reference IS DISTINCT FROM OLD.sofortmeldung_reference
      OR NEW.ausweis_acknowledged_at IS DISTINCT FROM OLD.ausweis_acknowledged_at)
     AND get_user_role() <> 'owner' THEN
    RAISE EXCEPTION 'Compliance fields can only be set by the salon owner';
  END IF;

  RETURN NEW;
END;
$$;
