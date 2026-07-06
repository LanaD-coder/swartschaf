-- Breaks table for employee time tracking (lunch, coffee, sick, day off)
CREATE TABLE IF NOT EXISTS breaks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  salon_id      uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  break_type    text NOT NULL CHECK (break_type IN ('lunch', 'coffee', 'sick', 'day_off')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS breaks_profile_id_idx ON breaks (profile_id);
CREATE INDEX IF NOT EXISTS breaks_salon_id_idx   ON breaks (salon_id);
CREATE INDEX IF NOT EXISTS breaks_started_at_idx ON breaks (started_at DESC);

-- RLS
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;

-- Employees can manage their own breaks
CREATE POLICY "breaks_own_all" ON breaks
  FOR ALL
  USING  (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Owners can read all breaks in their salon
CREATE POLICY "breaks_owner_read" ON breaks
  FOR SELECT
  USING (
    salon_id = (SELECT salon_id FROM profiles WHERE id = auth.uid())
    AND
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
  );
