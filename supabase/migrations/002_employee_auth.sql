-- ============================================================
-- Employee PIN authentication helper
-- Run this in Supabase SQL Editor after 001_schema.sql
-- ============================================================

-- verify_employee_pin: called from the client WITHOUT an auth session.
-- SECURITY DEFINER lets it bypass RLS to look up the profile.
-- Returns the profile's id (= auth.users id) if salon_code + PIN match.
CREATE OR REPLACE FUNCTION verify_employee_pin(p_salon_code text, p_pin text)
RETURNS TABLE (user_id uuid, full_name text, salon_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.salon_id
  FROM salons s
  JOIN profiles p ON p.salon_id = s.id
  WHERE s.salon_code = upper(p_salon_code)
    AND p.pin_hash = p_pin
    AND p.role = 'employee'
    AND p.is_active = true
  LIMIT 1;
END;
$$;

-- Allow anonymous (unauthenticated) callers to invoke this function.
GRANT EXECUTE ON FUNCTION verify_employee_pin(text, text) TO anon;
