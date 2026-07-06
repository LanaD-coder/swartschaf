-- ============================================================
-- Monthly timesheet vault: generated_reports table + storage bucket
-- Run this in Supabase SQL Editor after 007_profiles_onboarding_and_visibility.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS generated_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  employee_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  generated_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  period_label    text NOT NULL,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  file_path       text NOT NULL,
  file_size_bytes bigint,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_reports_salon_created_idx ON generated_reports (salon_id, created_at DESC);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generated_reports_owner_read" ON generated_reports;
CREATE POLICY "generated_reports_owner_read" ON generated_reports
  FOR SELECT USING (salon_id = current_salon_id() AND get_user_role() = 'owner');

DROP POLICY IF EXISTS "generated_reports_owner_insert" ON generated_reports;
CREATE POLICY "generated_reports_owner_insert" ON generated_reports
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND generated_by = auth.uid()
  );
-- Deliberately no UPDATE/DELETE policy: rows are immutable, matching the app's
-- existing no-hard-deletes GoBD philosophy — reports just accumulate.

-- Private bucket (unlike the public `avatars` bucket) — these PDFs contain client names.
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "reports_owner_read" ON storage.objects;
CREATE POLICY "reports_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reports'
    AND get_user_role() = 'owner'
    AND (storage.foldername(name))[1] = current_salon_id()::text
  );

DROP POLICY IF EXISTS "reports_owner_insert" ON storage.objects;
CREATE POLICY "reports_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'reports'
    AND get_user_role() = 'owner'
    AND (storage.foldername(name))[1] = current_salon_id()::text
  );
-- No storage UPDATE/DELETE policy either — immutable at the object-storage layer too.
