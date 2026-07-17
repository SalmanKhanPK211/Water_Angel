
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Function to send push notification when a new alert is inserted
CREATE OR REPLACE FUNCTION public.trigger_push_on_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title text;
BEGIN
  -- Get user_id from device_id
  IF NEW.device_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.devices
    WHERE id = NEW.device_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build notification title based on severity
  v_title := CASE
    WHEN NEW.severity = 'critical' THEN '🚨 Critical Water Alert'
    WHEN NEW.severity = 'warning'  THEN '⚠️ Water Angel Warning'
    ELSE '💧 Water Angel Alert'
  END;

  -- Call edge function via pg_net (fire and forget)
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
    -- Never block the alert insert even if push fails
    RETURN NEW;
END;
$$;

-- Attach trigger to alerts table
DROP TRIGGER IF EXISTS on_alert_inserted ON public.alerts;
CREATE TRIGGER on_alert_inserted
  AFTER INSERT ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_alert();
