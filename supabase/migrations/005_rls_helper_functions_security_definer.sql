-- ============================================================
-- Fix RLS helper functions (prevents 500 recursion)
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION current_salon_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT salon_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "salon_owner_all" ON salons;
CREATE POLICY "salon_owner_all" ON salons
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
