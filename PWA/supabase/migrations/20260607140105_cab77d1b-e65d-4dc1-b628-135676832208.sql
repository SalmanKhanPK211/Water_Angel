-- 1. Tighten anon UPDATE on devices: only allow clearing pending_command (set to NULL)
DROP POLICY IF EXISTS "Device can ack pending command" ON public.devices;
CREATE POLICY "Device can ack pending command"
  ON public.devices
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (pending_command IS NULL);

-- (Column-level GRANT UPDATE (pending_command, tank_height, tank_height_unit)
--  on public.devices to anon remains in place from the previous migration —
--  PostgREST will reject writes to any other column.)

-- 2. Restrict profiles INSERT to authenticated role
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Update trigger_push_on_alert to call send-push with the service role key
--    (so we can require auth on the edge function)
CREATE OR REPLACE FUNCTION public.trigger_push_on_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_title text;
  v_profile RECORD;
  v_should_send boolean := true;
BEGIN
  IF NEW.device_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.devices
    WHERE id = NEW.device_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_profile IS NOT NULL THEN
    CASE NEW.alert_type
      WHEN 'water_level' THEN
        v_should_send := COALESCE(v_profile.low_water_alerts, true);
      WHEN 'water_quality' THEN
        v_should_send := COALESCE(v_profile.high_tds_alerts, true);
      WHEN 'pump_runtime' THEN
        v_should_send := COALESCE(v_profile.pump_status_alerts, true);
      ELSE
        v_should_send := COALESCE(v_profile.anomaly_alerts, true);
    END CASE;
  END IF;

  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  v_title := CASE
    WHEN NEW.severity = 'critical' THEN '🚨 Critical Water Alert'
    WHEN NEW.severity = 'warning'  THEN '⚠️ Water Angel Warning'
    ELSE '💧 Water Angel Alert'
  END;

  PERFORM extensions.net.http_post(
    url     := 'https://pucmngrhhrzybuucrhuk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'x-internal-call', 'true'
    ),
    body    := jsonb_build_object(
      'user_id', v_user_id,
      'title',   v_title,
      'body',    NEW.alert_message,
      'url',     '/alerts'
    )::text,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$function$;
