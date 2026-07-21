
-- 1) Replace always-true INSERT policy on sensor_data with a scoped one
DROP POLICY IF EXISTS "Service can insert sensor data" ON public.sensor_data;
CREATE POLICY "Anon hardware can insert sensor data for existing devices"
ON public.sensor_data
FOR INSERT
TO anon, authenticated
WITH CHECK (device_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.devices d WHERE d.id = sensor_data.device_id));

-- 2) Remove the always-true alerts INSERT policy. Alerts are inserted by
--    detect_anomalies (SECURITY DEFINER trigger), which bypasses RLS, so
--    no policy is needed for direct client inserts.
DROP POLICY IF EXISTS "Service can insert alerts" ON public.alerts;

-- 3) Tighten the device "ack pending command" policy so USING isn't just true
DROP POLICY IF EXISTS "Device can ack pending command" ON public.devices;
CREATE POLICY "Device can ack pending command"
ON public.devices
FOR UPDATE
TO anon
USING (pending_command IS NOT NULL)
WITH CHECK (pending_command IS NULL);

-- 4) Lock down SECURITY DEFINER function EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.detect_anomalies()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_push_on_alert()   FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_first_admin()       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_first_admin()       TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin()                FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin()                TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_exists()            FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_exists()            TO anon, authenticated;

-- 5) Enable RLS on realtime.messages and block direct broadcast/presence.
--    postgres_changes subscriptions still enforce RLS on the underlying
--    public tables (sensor_data, alerts, pump_settings), which are already
--    scoped to device owners.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block direct realtime broadcast" ON realtime.messages;
CREATE POLICY "Block direct realtime broadcast"
ON realtime.messages
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
