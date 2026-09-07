-- ============ SENSOR DATA: remove public read ============
DROP POLICY IF EXISTS "Anyone can read sensor data" ON public.sensor_data;
DROP POLICY IF EXISTS "Service can insert sensor data" ON public.sensor_data;

CREATE POLICY "Owners and admins can read sensor data"
ON public.sensor_data FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = sensor_data.device_id AND d.user_id = auth.uid()
  )
);

-- hardware (anon key) may still push telemetry
CREATE POLICY "Hardware can insert sensor data"
ON public.sensor_data FOR INSERT TO anon, authenticated
WITH CHECK (device_id IS NOT NULL);

-- ============ ALERTS: remove public read ============
DROP POLICY IF EXISTS "Anyone can read alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service can insert alerts" ON public.alerts;

CREATE POLICY "Owners and admins can read alerts"
ON public.alerts FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = alerts.device_id AND d.user_id = auth.uid()
  )
);

-- alerts are written by the SECURITY DEFINER anomaly trigger; keep a narrow path
CREATE POLICY "Hardware path can insert alerts"
ON public.alerts FOR INSERT TO anon, authenticated
WITH CHECK (device_id IS NOT NULL);

REVOKE SELECT ON public.alerts FROM anon;
REVOKE UPDATE, DELETE ON public.alerts FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.sensor_data FROM anon;

-- ============ PUMP SETTINGS: keep anon read, kill anon write ============
DROP POLICY IF EXISTS "Anyone can update pump settings" ON public.pump_settings;
DROP POLICY IF EXISTS "Anyone can insert pump settings" ON public.pump_settings;

CREATE POLICY "Owners and admins can update pump settings"
ON public.pump_settings FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = pump_settings.device_id AND d.user_id = auth.uid())
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = pump_settings.device_id AND d.user_id = auth.uid())
);

CREATE POLICY "Owners and admins can insert pump settings"
ON public.pump_settings FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = pump_settings.device_id AND d.user_id = auth.uid())
);

REVOKE INSERT, UPDATE, DELETE ON public.pump_settings FROM anon;

-- ============ DEVICES: anon may only clear pending_command ============
DROP POLICY IF EXISTS "Anyone can insert devices" ON public.devices;

CREATE POLICY "Signed-in users can register devices"
ON public.devices FOR INSERT TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid() OR public.is_admin());

REVOKE UPDATE, INSERT, DELETE ON public.devices FROM anon;
GRANT UPDATE (pending_command) ON public.devices TO anon;