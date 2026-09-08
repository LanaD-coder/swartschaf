-- ============================================================
-- Employee login: name picker + 3-strikes PIN lockout
-- Run this in Supabase SQL Editor after 016_employee_pin_reset.sql
--
-- Previously, employee-pin.tsx asked for a Saloncode then a blind PIN guess —
-- the login flow never identified *which* employee was attempting, since a
-- wrong PIN doesn't match anyone. That made a real per-employee lockout
-- impossible to implement precisely (only a coarse, salon-wide throttle was
-- possible). Fixed at the root: the client now lists the salon's employees
-- by name (list_salon_employees, new) after the Saloncode step, the employee
-- picks themself, then enters their PIN against that specific profile. This
-- makes exact per-employee tracking possible: 3 wrong PINs locks that one
-- employee's account (pin_locked_at set) until the owner resets their PIN
-- (reset-employee-pin already exists — just extended to clear the lock too).
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_pin_attempts int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_locked_at timestamptz;

-- Public, unauthenticated — same trust level as verify_employee_pin below (no
-- session exists yet at this point in the login flow). Only ever exposes
-- name + id for ACTIVE employees of the given salon; never pin_hash or any
-- other field. Saloncodes are already meant to be shared within a salon, so
-- this doesn't expose anything beyond "who works here."
CREATE OR REPLACE FUNCTION list_salon_employees(p_salon_code text)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM salons s
  JOIN profiles p ON p.salon_id = s.id
  WHERE s.salon_code = upper(p_salon_code)
    AND p.role = 'employee'
    AND p.is_active = true
  ORDER BY p.full_name;
$$;

-- Signature change: now takes p_profile_id (from the name picker) instead of
-- matching blind against every employee's hash in the salon. Adds a `locked`
-- flag to the result so the client can show "ask your owner to reset your
-- PIN" distinctly from a generic wrong-PIN message.
DROP FUNCTION IF EXISTS verify_employee_pin(text, text);

CREATE OR REPLACE FUNCTION verify_employee_pin(p_salon_code text, p_profile_id uuid, p_pin text)
RETURNS TABLE (user_id uuid, full_name text, salon_id uuid, locked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row profiles%ROWTYPE;
  v_new_count int;
BEGIN
  SELECT p.* INTO v_row
  FROM salons s
  JOIN profiles p ON p.salon_id = s.id
  WHERE s.salon_code = upper(p_salon_code)
    AND p.id = p_profile_id
    AND p.role = 'employee'
    AND p.is_active = true;

  IF v_row.id IS NULL THEN
    RETURN; -- salon_code/profile_id/active mismatch — shouldn't happen via the
             -- normal picker flow, but don't leak anything if it does
  END IF;

  IF v_row.pin_locked_at IS NOT NULL THEN
    user_id := NULL; full_name := NULL; salon_id := NULL; locked := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.pin_hash = crypt(p_pin, v_row.pin_hash) THEN
    UPDATE profiles SET failed_pin_attempts = 0 WHERE id = v_row.id;
    user_id := v_row.id; full_name := v_row.full_name; salon_id := v_row.salon_id; locked := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Wrong PIN: increment, lock at 3.
  v_new_count := v_row.failed_pin_attempts + 1;
  UPDATE profiles
  SET failed_pin_attempts = v_new_count,
      pin_locked_at = CASE WHEN v_new_count >= 3 THEN now() ELSE pin_locked_at END
  WHERE id = v_row.id;

  IF v_new_count >= 3 THEN
    user_id := NULL; full_name := NULL; salon_id := NULL; locked := true;
    RETURN NEXT;
  END IF;
  -- Otherwise: empty result set — generic "wrong PIN" case, matches the
  -- existing client handling. Deliberately not revealing "N attempts left."
  RETURN;
END;
$$;
