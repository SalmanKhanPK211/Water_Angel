
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Y21uZ3JoaHJ6eWJ1dWNyaHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI0NjUsImV4cCI6MjA4ODUxODQ2NX0.sYgEcuUNfgoBCWocgNYED0L_IkOE7vV-dE9GpWElIdQ'
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
