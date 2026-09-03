-- ============================================================
-- Employee working hours + inventory (consumable + retail)
-- Run this in Supabase SQL Editor after 011_fix_duplicate_timer_policies.sql
--
-- employee_working_hours: Phase B (booking) dependency — availability
-- computation needs this and it didn't exist.
-- inventory_items + service_recipes: consumable/professional-use stock,
-- decremented automatically by a per-service recipe on completion — the
-- AI-forecasting target (Phase D.1 in PROJECT-PLAN.md).
-- products + appointment_products: retail stock sold to clients.
--
-- All new write policies are trial-lock aware (NOT salon_is_locked()), same
-- as every other operational table since 010_trial_lock.sql.
-- ============================================================

-- ── Employee working hours ───────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_working_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  salon_id    uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  weekday     int NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS working_hours_profile_idx ON employee_working_hours (profile_id);
CREATE INDEX IF NOT EXISTS working_hours_salon_idx   ON employee_working_hours (salon_id);

ALTER TABLE employee_working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "working_hours_salon_read" ON employee_working_hours
  FOR SELECT USING (salon_id = current_salon_id());

CREATE POLICY "working_hours_owner_insert" ON employee_working_hours
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
CREATE POLICY "working_hours_owner_update" ON employee_working_hours
  FOR UPDATE USING (salon_id = current_salon_id() AND get_user_role() = 'owner')
  WITH CHECK (salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked());
CREATE POLICY "working_hours_owner_delete" ON employee_working_hours
  FOR DELETE USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );

-- ── Inventory: consumable / professional-use stock ───────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id            uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name                text NOT NULL,        -- e.g. "Blondierpulver", "Entwickler 20 Vol."
  unit                text NOT NULL CHECK (unit IN ('ml', 'g', 'piece')),
  stock_quantity      numeric NOT NULL DEFAULT 0,
  low_stock_threshold numeric,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_items_salon_idx ON inventory_items (salon_id);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_items_salon_read" ON inventory_items
  FOR SELECT USING (salon_id = current_salon_id());

CREATE POLICY "inventory_items_owner_insert" ON inventory_items
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
CREATE POLICY "inventory_items_owner_update" ON inventory_items
  FOR UPDATE USING (salon_id = current_salon_id() AND get_user_role() = 'owner')
  WITH CHECK (salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked());
CREATE POLICY "inventory_items_owner_delete" ON inventory_items
  FOR DELETE USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );

-- ── Recipes: how much of an inventory_item a service_category consumes per use ──
CREATE TABLE IF NOT EXISTS service_recipes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id            uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  service_category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  inventory_item_id   uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  amount_per_use      numeric NOT NULL CHECK (amount_per_use > 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_category_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS service_recipes_salon_idx    ON service_recipes (salon_id);
CREATE INDEX IF NOT EXISTS service_recipes_category_idx ON service_recipes (service_category_id);

ALTER TABLE service_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_recipes_salon_read" ON service_recipes
  FOR SELECT USING (salon_id = current_salon_id());

CREATE POLICY "service_recipes_owner_insert" ON service_recipes
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
CREATE POLICY "service_recipes_owner_update" ON service_recipes
  FOR UPDATE USING (salon_id = current_salon_id() AND get_user_role() = 'owner')
  WITH CHECK (salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked());
CREATE POLICY "service_recipes_owner_delete" ON service_recipes
  FOR DELETE USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );

-- ── Inventory: retail stock sold to clients ──────────────────
CREATE TABLE IF NOT EXISTS products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  price          numeric NOT NULL CHECK (price >= 0),
  stock_quantity int NOT NULL DEFAULT 0,
  category       text,
  image_url      text,
  sourcing_type  text NOT NULL DEFAULT 'in_house' CHECK (sourcing_type IN ('in_house', 'dropship')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_salon_idx ON products (salon_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_salon_read" ON products
  FOR SELECT USING (salon_id = current_salon_id());

CREATE POLICY "products_owner_insert" ON products
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
CREATE POLICY "products_owner_update" ON products
  FOR UPDATE USING (salon_id = current_salon_id() AND get_user_role() = 'owner')
  WITH CHECK (salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked());
CREATE POLICY "products_owner_delete" ON products
  FOR DELETE USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );

-- ── Retail items sold during a completed visit ───────────────
CREATE TABLE IF NOT EXISTS appointment_products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity       int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price     numeric NOT NULL CHECK (unit_price >= 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_products_appointment_idx ON appointment_products (appointment_id);

ALTER TABLE appointment_products ENABLE ROW LEVEL SECURITY;

-- Read: same salon (via the appointment)
CREATE POLICY "appointment_products_salon_read" ON appointment_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id AND a.salon_id = current_salon_id()
    )
  );

-- Insert: the owner, or the employee assigned to that appointment — mirrors who's
-- allowed to touch the appointment itself. Deliberately no UPDATE/DELETE: a sale
-- gets corrected the same way appointment data does (owner edit), not silently
-- edited by whoever rang it up.
CREATE POLICY "appointment_products_insert" ON appointment_products
  FOR INSERT WITH CHECK (
    NOT salon_is_locked()
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id
        AND a.salon_id = current_salon_id()
        AND (a.assigned_to = auth.uid() OR get_user_role() = 'owner')
    )
  );

CREATE POLICY "appointment_products_owner_delete" ON appointment_products
  FOR DELETE USING (
    NOT salon_is_locked()
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id AND a.salon_id = current_salon_id() AND get_user_role() = 'owner'
    )
  );

-- ── Auto-decrement consumable stock when a service completes ────
-- Fires only on a transition INTO 'completed' with a service category set.
-- No lock check needed here: the underlying appointments UPDATE that flips
-- status to 'completed' is itself blocked by RLS while locked, so this
-- trigger can never fire during a lock in the first place.
CREATE OR REPLACE FUNCTION decrement_inventory_on_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.service_category_id IS NOT NULL THEN
    UPDATE inventory_items ii
    SET stock_quantity = ii.stock_quantity - sr.amount_per_use
    FROM service_recipes sr
    WHERE sr.service_category_id = NEW.service_category_id
      AND sr.inventory_item_id = ii.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_decrement_inventory ON appointments;
CREATE TRIGGER appointments_decrement_inventory
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION decrement_inventory_on_completion();
