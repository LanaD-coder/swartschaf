-- ============================================================
-- Drop duplicate appointments UPDATE policies
-- Run this in Supabase SQL Editor after 010_trial_lock.sql
--
-- Discovered while verifying 010: two policies existed on `appointments`
-- (appointments_employee_update_timers, employee_update_own_timers) that
-- aren't in any migration file in this repo — added by hand at some point,
-- outside the migration history. Both were exact duplicates of the
-- pre-010 appointments_employee_timer policy (assigned_to = auth.uid(),
-- no lock check). Since RLS OR's every applicable policy for the same
-- command together, leaving them in place would let employees keep
-- starting/stopping timers even while a salon is locked, silently
-- defeating 010's lock. Their permissions are fully covered by 010's
-- replacement appointments_employee_timer policy, so they're just dropped.
-- ============================================================

DROP POLICY IF EXISTS "appointments_employee_update_timers" ON appointments;
DROP POLICY IF EXISTS "employee_update_own_timers" ON appointments;
