-- ============================================================
-- Billable services (with their own price) + re-link recipes to them
-- Run this in Supabase SQL Editor after 013_inventory_portions_and_costing.sql
--
-- service_categories (existing, e.g. "Schneiden", "Färben") is used throughout
-- the app for calendar coloring/grouping and is left completely untouched —
-- it's referenced by 12 existing files and changing it is out of scope here.
--
-- What was missing: an actual priced, bookable line item. A hairdresser sells
-- "Schneiden Kurz Damen" (€35) and "Schneiden Lang Herren" (€45) as different
-- things, not just "Schneiden" at one price — and material usage genuinely
-- varies by variant too (long hair uses more color than short). `services`
-- is that layer: salon-scoped, grouped under a service_category, with its own
-- price.
--
-- appointments.service_id is added ADDITIVELY (nullable) alongside the
-- existing service_category_id — no existing screen's behavior changes.
--
-- service_recipes moves from service_category_id to service_id: this table
-- has zero rows in production (schema-only, shipped this same session), so
-- it's a clean re-point rather than a data migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS services (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id             uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  service_category_id  uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  name                 text NOT NULL,      -- e.g. "Schneiden Kurz Damen"
  price                numeric NOT NULL CHECK (price >= 0),
  duration_minutes     int,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_salon_idx    ON services (salon_id);
CREATE INDEX IF NOT EXISTS services_category_idx ON services (service_category_id);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_salon_read" ON services
  FOR SELECT USING (salon_id = current_salon_id());

CREATE POLICY "services_owner_insert" ON services
  FOR INSERT WITH CHECK (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );
CREATE POLICY "services_owner_update" ON services
  FOR UPDATE USING (salon_id = current_salon_id() AND get_user_role() = 'owner')
  WITH CHECK (salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked());
CREATE POLICY "services_owner_delete" ON services
  FOR DELETE USING (
    salon_id = current_salon_id() AND get_user_role() = 'owner' AND NOT salon_is_locked()
  );

-- ── appointments: additive service_id (billable line item), category stays as-is ──
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES services(id) ON DELETE SET NULL;

-- ── service_recipes: re-point from category to the specific priced service ──
ALTER TABLE service_recipes ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES services(id) ON DELETE CASCADE;
ALTER TABLE service_recipes DROP CONSTRAINT IF EXISTS service_recipes_service_category_id_inventory_item_id_key;
ALTER TABLE service_recipes DROP CONSTRAINT IF EXISTS service_recipes_service_category_id_fkey;
ALTER TABLE service_recipes DROP COLUMN IF EXISTS service_category_id;
ALTER TABLE service_recipes ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE service_recipes ADD CONSTRAINT service_recipes_service_id_inventory_item_id_key
  UNIQUE (service_id, inventory_item_id);

-- ── Trigger: now keys off appointments.service_id instead of service_category_id ──
CREATE OR REPLACE FUNCTION decrement_inventory_on_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.service_id IS NOT NULL THEN

    INSERT INTO appointment_material_usage (appointment_id, inventory_item_id, portions_used, portion_price)
    SELECT NEW.id, sr.inventory_item_id, sr.portions_per_use, ii.portion_price
    FROM service_recipes sr
    JOIN inventory_items ii ON ii.id = sr.inventory_item_id
    WHERE sr.service_id = NEW.service_id;

    UPDATE inventory_items ii
    SET stock_quantity = ii.stock_quantity - sr.portions_per_use
    FROM service_recipes sr
    WHERE sr.service_id = NEW.service_id
      AND sr.inventory_item_id = ii.id;
  END IF;
  RETURN NEW;
END;
$$;
