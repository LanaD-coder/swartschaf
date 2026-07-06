-- ============================================================
-- Security hardening
-- Run this in Supabase SQL Editor after 003_breaks.sql
--
-- Fixes:
--   1. Employee PINs stored in plaintext (profiles.pin_hash)
--   2. Any authenticated user could self-promote by updating
--      their own profiles.role / salon_id / pin_hash
--   3. Employees could rewrite any field on their own
--      appointments (scheduled_start/end, client_name, etc.),
--      bypassing the correction_requests audit-trail flow
--   4. Employees could insert a walk-in appointment into a
--      different salon by spoofing salon_id
-- ============================================================

-- ── 1. Bcrypt-hash employee PINs ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Backfill any existing plaintext PINs before the write-trigger exists below.
UPDATE profiles
SET pin_hash = extensions.crypt(pin_hash, extensions.gen_salt('bf'))
WHERE pin_hash IS NOT NULL
  AND pin_hash !~ '^\$2[aby]\$';

-- Hash on write: create-employee inserts the raw PIN; this transparently
-- bcrypt-hashes it so no application code needs to change.
CREATE OR REPLACE FUNCTION hash_pin_on_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  NEW.pin_hash := crypt(NEW.pin_hash, gen_salt('bf'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_hash_pin ON profiles;
CREATE TRIGGER profiles_hash_pin
  BEFORE INSERT OR UPDATE OF pin_hash ON profiles
  FOR EACH ROW
  WHEN (NEW.pin_hash IS NOT NULL AND NEW.pin_hash !~ '^\$2[aby]\$')
  EXECUTE FUNCTION hash_pin_on_write();

-- Verify against the bcrypt hash instead of a plaintext match.
CREATE OR REPLACE FUNCTION verify_employee_pin(p_salon_code text, p_pin text)
RETURNS TABLE (user_id uuid, full_name text, salon_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.salon_id
  FROM salons s
  JOIN profiles p ON p.salon_id = s.id
  WHERE s.salon_code = upper(p_salon_code)
    AND p.pin_hash = crypt(p_pin, p.pin_hash)
    AND p.role = 'employee'
    AND p.is_active = true
  LIMIT 1;
END;
$$;

-- ── 2. Lock role / salon_id / pin_hash from client-side updates ──
-- Only the service role (Edge Functions) may change these; the app
-- never updates them directly (create-employee only INSERTs, and
-- owner/employee screens only touch is_active / avatar_url / etc.).
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.salon_id IS DISTINCT FROM OLD.salon_id
     OR NEW.pin_hash IS DISTINCT FROM OLD.pin_hash THEN
    RAISE EXCEPTION 'role, salon_id and pin_hash cannot be changed directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON profiles;
CREATE TRIGGER profiles_prevent_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation();

-- ── 3. Restrict what employees can change on their own appointments ──
-- Employees may only touch actual_start/actual_end/status/notes
-- (timer + walk-in flow). Rescheduling, reassigning, or editing the
-- client must go through the owner or the correction_requests flow,
-- otherwise the GoBD audit trail is meaningless.
CREATE OR REPLACE FUNCTION restrict_employee_appointment_updates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR get_user_role() = 'owner' THEN
    RETURN NEW;
  END IF;

  IF NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
     OR NEW.scheduled_end       IS DISTINCT FROM OLD.scheduled_end
     OR NEW.client_name         IS DISTINCT FROM OLD.client_name
     OR NEW.service_category_id IS DISTINCT FROM OLD.service_category_id
     OR NEW.salon_id            IS DISTINCT FROM OLD.salon_id
     OR NEW.assigned_to         IS DISTINCT FROM OLD.assigned_to
     OR NEW.customer_type       IS DISTINCT FROM OLD.customer_type
     OR NEW.created_by          IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'Employees may only update actual_start, actual_end, status and notes';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_restrict_employee_updates ON appointments;
CREATE TRIGGER appointments_restrict_employee_updates
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION restrict_employee_appointment_updates();

-- ── 4. Walk-ins must stay inside the employee's own salon ───────
DROP POLICY IF EXISTS "appointments_employee_walkin" ON appointments;
CREATE POLICY "appointments_employee_walkin" ON appointments
  FOR INSERT WITH CHECK (
    assigned_to = auth.uid()
    AND customer_type = 'walkin'
    AND salon_id = current_salon_id()
  );
