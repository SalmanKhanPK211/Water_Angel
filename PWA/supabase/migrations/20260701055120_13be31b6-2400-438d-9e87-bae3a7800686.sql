
-- Fix pump_settings_hardware view: make it security_invoker so RLS applies, and revoke anon access
DROP VIEW IF EXISTS public.pump_settings_hardware;

CREATE VIEW public.pump_settings_hardware
WITH (security_invoker = true) AS
SELECT device_id, pump_mode, pump_status, upper_threshold, lower_threshold, critical_threshold, updated_at
FROM public.pump_settings;

REVOKE ALL ON public.pump_settings_hardware FROM anon;
GRANT SELECT ON public.pump_settings_hardware TO authenticated;

-- Fix push trigger: include internal_secret in body so send-push edge function authorizes the call
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
  v_internal_secret constant text := 'wa_push_3f9a8c2e1b7d4f6a9c5e8b2d7f1a4c6e';
BEGIN
  IF NEW.device_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM public.devices WHERE id = NEW.device_id;
  END IF;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF v_profile IS NOT NULL THEN
    CASE NEW.alert_type
      WHEN 'water_level'   THEN v_should_send := COALESCE(v_profile.low_water_alerts, true);
      WHEN 'water_quality' THEN v_should_send := COALESCE(v_profile.high_tds_alerts, true);
      WHEN 'pump_runtime'  THEN v_should_send := COALESCE(v_profile.pump_status_alerts, true);
      ELSE                       v_should_send := COALESCE(v_profile.anomaly_alerts, true);
    END CASE;
  END IF;
  IF NOT v_should_send THEN RETURN NEW; END IF;

  v_title := CASE
    WHEN NEW.severity = 'critical' THEN '🚨 Critical Water Alert'
    WHEN NEW.severity = 'warning'  THEN '⚠️ Water Angel Warning'
    ELSE '💧 Water Angel Alert'
  END;

  PERFORM extensions.net.http_post(
    url     := 'https://pucmngrhhrzybuucrhuk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'user_id', v_user_id,
      'title',   v_title,
      'body',    NEW.alert_message,
      'url',     '/alerts',
      'internal_secret', v_internal_secret
    )::text,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$function$;
