-- Fix hardware writes that started returning "device row not found" after RLS tightening.
-- The sensor_data.device_id foreign key already guarantees the device exists, so the
-- INSERT policy should not depend on an anon-visible SELECT from public.devices.
DROP POLICY IF EXISTS "Anon hardware can insert sensor data for existing devices" ON public.sensor_data;

CREATE POLICY "Hardware can insert sensor data with device id"
ON public.sensor_data
FOR INSERT
TO anon, authenticated
WITH CHECK (device_id IS NOT NULL);

-- Keep firmware command acknowledgements idempotent. Some firmware clears
-- pending_command on every loop; if pending_command is already NULL, the prior
-- policy matched zero rows and surfaced as "device row not found".
DROP POLICY IF EXISTS "Device can ack pending command" ON public.devices;

REVOKE UPDATE ON public.devices FROM anon;
GRANT UPDATE (pending_command, tank_height, tank_height_unit) ON public.devices TO anon;

CREATE POLICY "Device can clear pending command"
ON public.devices
FOR UPDATE
TO anon
USING (id IS NOT NULL)
WITH CHECK (pending_command IS NULL);