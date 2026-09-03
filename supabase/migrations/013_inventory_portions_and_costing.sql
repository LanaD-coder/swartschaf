-- ============================================================
-- Inventory: purchase-unit costing + portion-based consumption
-- Run this in Supabase SQL Editor after 012_working_hours_and_inventory.sql
--
-- Refines 012's inventory_items/service_recipes from a raw ml/g balance into
-- a purchase-unit model: a salon buys a tube (product_code, brand, total_qty,
-- purchase_price), that tube yields a known number of service portions
-- (portions_per_unit), and each portion has a price charged to the client
-- (portion_price). stock_quantity now counts PORTIONS remaining (not ml/g,
-- not whole tubes) — the actual thing a service consumes and a low-stock
-- threshold should warn about.
--
-- No data exists yet in either table (schema-only, no UI shipped before this
-- migration), so this is a clean restructure, not a data migration.
-- ============================================================

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS product_code text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS total_qty numeric;         -- size of one fresh tube, e.g. 500 (in `unit`)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS portions_per_unit numeric; -- how many service portions one tube yields
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS purchase_price numeric;    -- cost of one tube
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS portion_price numeric;     -- price charged to the client per portion used

COMMENT ON COLUMN inventory_items.stock_quantity IS
  'Current stock in PORTIONS remaining — not raw ml/g and not whole tubes. Restocking a tube adds portions_per_unit to this.';

-- service_recipes.amount_per_use was ml/g; it's now a portion count.
ALTER TABLE service_recipes RENAME COLUMN amount_per_use TO portions_per_use;

-- ── Material usage log (mirrors appointment_products' role for retail) ──
-- Snapshots portions consumed + the portion_price at the time, so historical
-- cost reporting doesn't silently change if portion_price is edited later.
-- No hard deletes/edits by design (GoBD-style immutability, same as
-- generated_reports and correction_requests) — only the trigger below writes
-- to it, via SECURITY DEFINER; there are deliberately no INSERT/UPDATE/DELETE
-- RLS policies for regular users.
CREATE TABLE IF NOT EXISTS appointment_material_usage (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id     uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  inventory_item_id  uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  portions_used      numeric NOT NULL,
  portion_price      numeric, -- snapshot; null if the item had no portion_price set at the time
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS material_usage_appointment_idx ON appointment_material_usage (appointment_id);

ALTER TABLE appointment_material_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_usage_salon_read" ON appointment_material_usage
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id AND a.salon_id = current_salon_id())
  );

-- ── Trigger: on completion, log usage (with price snapshot) AND decrement stock ──
CREATE OR REPLACE FUNCTION decrement_inventory_on_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.service_category_id IS NOT NULL THEN

    INSERT INTO appointment_material_usage (appointment_id, inventory_item_id, portions_used, portion_price)
    SELECT NEW.id, sr.inventory_item_id, sr.portions_per_use, ii.portion_price
    FROM service_recipes sr
    JOIN inventory_items ii ON ii.id = sr.inventory_item_id
    WHERE sr.service_category_id = NEW.service_category_id;

    UPDATE inventory_items ii
    SET stock_quantity = ii.stock_quantity - sr.portions_per_use
    FROM service_recipes sr
    WHERE sr.service_category_id = NEW.service_category_id
      AND sr.inventory_item_id = ii.id;
  END IF;
  RETURN NEW;
END;
$$;
-- Trigger itself is unchanged from 012 (same name, same firing conditions) —
-- only the function body changed, so no DROP/CREATE TRIGGER needed here.
