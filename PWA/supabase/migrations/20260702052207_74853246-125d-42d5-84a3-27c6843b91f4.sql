
-- ============ SENSOR_DATA ============
DROP POLICY IF EXISTS "Anyone can read sensor data" ON public.sensor_data;
DROP POLICY IF EXISTS "Users can view own device sensor data" ON public.sensor_data;
DROP POLICY IF EXISTS "Admins can view all sensor data" ON public.sensor_data;

CREATE POLICY "Users can view own device sensor data"
ON public.sensor_data FOR SELECT TO authenticated
USING (
  device_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = sensor_data.device_id AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all sensor data"
ON public.sensor_data FOR SELECT TO authenticated
USING (public.is_admin());

-- ============ ALERTS ============
DROP POLICY IF EXISTS "Anyone can read alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can view own device alerts" ON public.alerts;
DROP POLICY IF EXISTS "Admins can view all alerts" ON public.alerts;

CREATE POLICY "Users can view own device alerts"
ON public.alerts FOR SELECT TO authenticated
USING (
  device_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = alerts.device_id AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all alerts"
ON public.alerts FOR SELECT TO authenticated
USING (public.is_admin());

-- ============ PUMP_SETTINGS ============
DROP POLICY IF EXISTS "Anyone can read pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Anyone can insert pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Anyone can update pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Users can view own device pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Users can insert own device pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Users can update own device pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Admins can view all pump settings" ON public.pump_settings;

CREATE POLICY "Users can view own device pump settings"
ON public.pump_settings FOR SELECT TO authenticated
USING (
  device_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = pump_settings.device_id AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own device pump settings"
ON public.pump_settings FOR INSERT TO authenticated
WITH CHECK (
  device_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = pump_settings.device_id AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own device pump settings"
ON public.pump_settings FOR UPDATE TO authenticated
USING (
  device_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = pump_settings.device_id AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  device_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = pump_settings.device_id AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all pump settings"
ON public.pump_settings FOR SELECT TO authenticated
USING (public.is_admin());

-- ============ DEVICES ============
DROP POLICY IF EXISTS "Anon can read devices for hardware lookup" ON public.devices;
DROP POLICY IF EXISTS "Anyone can insert devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated can insert devices" ON public.devices;

CREATE POLICY "Authenticated can insert devices"
ON public.devices FOR INSERT TO authenticated
WITH CHECK (true);

-- ============ HARDWARE RPC FUNCTIONS ============
-- These are the only anon-callable way to read device/pump data, and require the system_key.

CREATE OR REPLACE FUNCTION public.hardware_lookup_device(_system_key text)
RETURNS TABLE (
  id uuid,
  system_key text,
  pending_command text,
  calibration_mode boolean,
  tank_height numeric,
  tank_height_unit text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.system_key, d.pending_command, d.calibration_mode, d.tank_height, d.tank_height_unit
  FROM public.devices d
  WHERE d.system_key = _system_key
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.hardware_get_pump_settings(_system_key text)
RETURNS TABLE (
  device_id uuid,
  pump_mode text,
  pump_status text,
  upper_threshold numeric,
  lower_threshold numeric,
  critical_threshold numeric,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.device_id, ps.pump_mode, ps.pump_status,
         ps.upper_threshold, ps.lower_threshold, ps.critical_threshold, ps.updated_at
  FROM public.pump_settings ps
  JOIN public.devices d ON d.id = ps.device_id
  WHERE d.system_key = _system_key
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.hardware_lookup_device(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hardware_get_pump_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hardware_lookup_device(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hardware_get_pump_settings(text) TO anon, authenticated;
