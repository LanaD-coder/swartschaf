-- ============================================================
-- Swartschaf – Initial Schema
-- Paste this into Supabase SQL Editor and run it.
-- ============================================================

-- ── Salons (multi-tenant root) ──────────────────────────────
CREATE TABLE salons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  address               text,
  steuernummer          text,
  salon_code            text UNIQUE NOT NULL,
  owner_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id    text,
  stripe_subscription_id text,
  subscription_status   text NOT NULL DEFAULT 'trialing'
                        CHECK (subscription_status IN ('active','trialing','past_due','canceled')),
  plan                  text CHECK (plan IN ('starter','pro')),
  trial_ends_at         timestamptz DEFAULT (now() + INTERVAL '14 days'),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Profiles (extends auth.users) ───────────────────────────
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salon_id    uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  role        text NOT NULL DEFAULT 'employee'
              CHECK (role IN ('owner','employee')),
  pin_hash    text,
  color       text NOT NULL DEFAULT '#e94560',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Service categories ───────────────────────────────────────
CREATE TABLE service_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#888888',
  is_active   boolean NOT NULL DEFAULT true
);

-- ── Appointments ─────────────────────────────────────────────
CREATE TABLE appointments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id              uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  assigned_to           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_name           text NOT NULL,
  service_category_id   uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  scheduled_start       timestamptz NOT NULL,
  scheduled_end         timestamptz NOT NULL,
  actual_start          timestamptz,
  actual_end            timestamptz,
  customer_type         text NOT NULL DEFAULT 'appointment'
                        CHECK (customer_type IN ('appointment','walkin')),
  notes                 text,
  status                text NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','in_progress','completed','no_show','cancelled')),
  created_by            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Correction requests (GoBD audit trail) ───────────────────
CREATE TABLE correction_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  requested_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approved_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  original_data   jsonb NOT NULL,
  requested_data  jsonb NOT NULL,
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE salons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;

-- Helper: get the current user's salon_id
CREATE OR REPLACE FUNCTION current_salon_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT salon_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: get the current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Salons: owner can read/update their own salon
CREATE POLICY "salon_owner_all" ON salons
  FOR ALL USING (owner_id = auth.uid());

-- Profiles: users can read profiles in their salon
CREATE POLICY "profiles_salon_read" ON profiles
  FOR SELECT USING (salon_id = current_salon_id());

-- Profiles: owner can insert/update employees in their salon
CREATE POLICY "profiles_owner_write" ON profiles
  FOR ALL USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner'
  );

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles_self" ON profiles
  FOR ALL USING (id = auth.uid());

-- Service categories: all salon members can read
CREATE POLICY "categories_salon_read" ON service_categories
  FOR SELECT USING (salon_id = current_salon_id());

-- Service categories: owner can manage
CREATE POLICY "categories_owner_write" ON service_categories
  FOR ALL USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner'
  );

-- Appointments: owner sees all in salon; employee sees own
CREATE POLICY "appointments_owner_all" ON appointments
  FOR ALL USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner'
  );

CREATE POLICY "appointments_employee_read" ON appointments
  FOR SELECT USING (assigned_to = auth.uid());

-- Employees can start/stop their own appointments (update actual_start/end/status)
CREATE POLICY "appointments_employee_timer" ON appointments
  FOR UPDATE USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- Employees can insert walkin appointments for themselves
CREATE POLICY "appointments_employee_walkin" ON appointments
  FOR INSERT WITH CHECK (
    assigned_to = auth.uid() AND customer_type = 'walkin'
  );

-- Correction requests: employee can create; owner can read/update all
CREATE POLICY "corrections_employee_insert" ON correction_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid());

CREATE POLICY "corrections_employee_read" ON correction_requests
  FOR SELECT USING (requested_by = auth.uid());

CREATE POLICY "corrections_owner_all" ON correction_requests
  FOR ALL USING (
    get_user_role() = 'owner' AND
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id AND a.salon_id = current_salon_id()
    )
  );

-- ── Employee PIN login (no auth.users row needed) ────────────
-- Employees log in via salon_code + pin (no Supabase Auth session).
-- The app stores profile + salon in Zustand after PIN match.
-- NOTE: pin_hash stores the raw 4-digit PIN for MVP.
-- Replace with bcrypt hashing via Edge Function for production.
