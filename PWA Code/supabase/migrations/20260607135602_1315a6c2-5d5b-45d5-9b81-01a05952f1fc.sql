-- Allow ESP32 (anon key) to update only operational fields on devices.
-- Restricted via a column-level GRANT so anon cannot touch user_id, system_key, etc.

GRANT UPDATE (pending_command, tank_height, tank_height_unit)
  ON public.devices TO anon;

DROP POLICY IF EXISTS "Device can ack pending command" ON public.devices;
CREATE POLICY "Device can ack pending command"
  ON public.devices
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
