-- ============================================================
-- Schwarzarbeit compliance tracking (Sofortmeldung + Ausweispflicht)
-- Run this in Supabase SQL Editor after 008_reports_vault.sql
--
-- Friseurhandwerk is one of the legally listed Sofortmeldepflicht-Branchen
-- (§ 28a Abs. 4 SGB IV) — new employees must be reported to the Zoll at/before
-- their first day of work. This app cannot submit that report itself (it would
-- require ITSG certification, the same category of problem as KassenSichV/TSE
-- for cash registers), but it can track that the owner has done it, and remind
-- them about the Ausweispflicht (staff must carry ID during work) requirement.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sofortmeldung_confirmed_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sofortmeldung_reference text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ausweis_acknowledged_at timestamptz;

-- Extend the existing privilege-escalation guard (004) so employees can't
-- self-attest their own compliance status — these are the owner's legal
-- attestations about the employee, not something the employee sets themselves.
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

  IF (NEW.sofortmeldung_confirmed_at IS DISTINCT FROM OLD.sofortmeldung_confirmed_at
      OR NEW.sofortmeldung_reference IS DISTINCT FROM OLD.sofortmeldung_reference
      OR NEW.ausweis_acknowledged_at IS DISTINCT FROM OLD.ausweis_acknowledged_at)
     AND get_user_role() <> 'owner' THEN
    RAISE EXCEPTION 'Compliance fields can only be set by the salon owner';
  END IF;

  RETURN NEW;
END;
$$;
