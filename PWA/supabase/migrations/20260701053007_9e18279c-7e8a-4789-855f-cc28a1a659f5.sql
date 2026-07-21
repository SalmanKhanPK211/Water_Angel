
-- Devices: remove open insert policy (admins retain insert)
DROP POLICY IF EXISTS "Anyone can insert devices" ON public.devices;

-- Devices: replace broad anon SELECT with a scoped view
DROP POLICY IF EXISTS "Anon can read devices for hardware lookup" ON public.devices;

CREATE OR REPLACE VIEW public.device_hardware_status AS
  SELECT id, system_key, pending_command, tank_height, tank_height_unit, calibration_mode
  FROM public.devices;

GRANT SELECT ON public.device_hardware_status TO anon, authenticated;

-- Pump settings: lock insert/update to authenticated device owners
DROP POLICY IF EXISTS "Anyone can insert pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Anyone can update pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Anyone can read pump settings" ON public.pump_settings;

CREATE POLICY "Owners insert pump settings"
  ON public.pump_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

CREATE POLICY "Owners update pump settings"
  ON public.pump_settings
  FOR UPDATE
  TO authenticated
  USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()))
  WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

CREATE POLICY "Owners read pump settings"
  ON public.pump_settings
  FOR SELECT
  TO authenticated
  USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

-- Hardware still needs to read pump settings by device_id; keep an anon SELECT
-- but scoped to just the operational columns via a view.
CREATE OR REPLACE VIEW public.pump_settings_hardware AS
  SELECT device_id, pump_mode, pump_status, upper_threshold, lower_threshold, critical_threshold, updated_at
  FROM public.pump_settings;

GRANT SELECT ON public.pump_settings_hardware TO anon, authenticated;

-- Sensor data: restrict SELECT to authenticated device owners
DROP POLICY IF EXISTS "Anyone can read sensor data" ON public.sensor_data;

CREATE POLICY "Owners read sensor data"
  ON public.sensor_data
  FOR SELECT
  TO authenticated
  USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

-- Alerts: restrict SELECT to authenticated device owners
DROP POLICY IF EXISTS "Anyone can read alerts" ON public.alerts;

CREATE POLICY "Owners read alerts"
  ON public.alerts
  FOR SELECT
  TO authenticated
  USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
