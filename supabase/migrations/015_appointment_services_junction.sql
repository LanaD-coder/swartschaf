-- ============================================================
-- Correct 014's singular appointments.service_id -> a junction table
-- Run this in Supabase SQL Editor after 014_services_and_recipe_linking.sql
--
-- Discovered while wiring this up: the live `appointments` table already has
-- an undocumented `service_category_ids uuid[]` column (not in any migration
-- file — same kind of drift as the duplicate timer policies found earlier)
-- that `app/(owner)/appointments/new.tsx` already writes to. Appointments
-- support multiple services per visit (a real haircut+color visit), so 014's
-- singular `service_id` was wrong. This drops it in favor of an
-- appointment_services junction, and updates the consumption trigger to loop
-- over every linked service instead of assuming one.
-- ============================================================

ALTER TABLE appointments DROP COLUMN IF EXISTS service_id;

CREATE TABLE IF NOT EXISTS appointment_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id     uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, service_id)
);

CREATE INDEX IF NOT EXISTS appointment_services_appointment_idx ON appointment_services (appointment_id);

ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_services_salon_read" ON appointment_services
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id AND a.salon_id = current_salon_id())
  );

-- Insert/delete follow who's allowed to touch the appointment itself (owner,
-- or the assigned employee), same shape as appointment_products.
CREATE POLICY "appointment_services_insert" ON appointment_services
  FOR INSERT WITH CHECK (
    NOT salon_is_locked()
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id
        AND a.salon_id = current_salon_id()
        AND (a.assigned_to = auth.uid() OR get_user_role() = 'owner')
    )
  );

CREATE POLICY "appointment_services_delete" ON appointment_services
  FOR DELETE USING (
    NOT salon_is_locked()
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id
        AND a.salon_id = current_salon_id()
        AND (a.assigned_to = auth.uid() OR get_user_role() = 'owner')
    )
  );

-- ── Trigger: loop over every linked service, not just one ───────
CREATE OR REPLACE FUNCTION decrement_inventory_on_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN

    INSERT INTO appointment_material_usage (appointment_id, inventory_item_id, portions_used, portion_price)
    SELECT NEW.id, sr.inventory_item_id, sr.portions_per_use, ii.portion_price
    FROM appointment_services aps
    JOIN service_recipes sr ON sr.service_id = aps.service_id
    JOIN inventory_items ii ON ii.id = sr.inventory_item_id
    WHERE aps.appointment_id = NEW.id;

    UPDATE inventory_items ii
    SET stock_quantity = ii.stock_quantity - usage.total_portions
    FROM (
      SELECT sr.inventory_item_id, SUM(sr.portions_per_use) AS total_portions
      FROM appointment_services aps
      JOIN service_recipes sr ON sr.service_id = aps.service_id
      WHERE aps.appointment_id = NEW.id
      GROUP BY sr.inventory_item_id
    ) usage
    WHERE ii.id = usage.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$;
