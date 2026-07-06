-- ============================================================
-- Avatar storage bucket + RLS
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND SPLIT_PART(name, '.', 1) = auth.uid()::text);

CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND SPLIT_PART(name, '.', 1) = auth.uid()::text);

CREATE POLICY "avatars_user_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND SPLIT_PART(name, '.', 1) = auth.uid()::text);
