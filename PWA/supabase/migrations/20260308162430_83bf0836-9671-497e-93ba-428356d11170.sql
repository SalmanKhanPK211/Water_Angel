
-- Create devices table
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_key text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  device_name text DEFAULT 'My Water Angel',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Users can view their own devices
CREATE POLICY "Users can view own devices" ON public.devices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can claim unclaimed devices or update their own
CREATE POLICY "Users can claim devices" ON public.devices
  FOR UPDATE TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);

-- Service/ESP32 can insert devices (for pre-registration)
CREATE POLICY "Anyone can insert devices" ON public.devices
  FOR INSERT WITH CHECK (true);

-- Add device_id to sensor_data
ALTER TABLE public.sensor_data ADD COLUMN device_id uuid REFERENCES public.devices(id);

-- Add device_id to alerts
ALTER TABLE public.alerts ADD COLUMN device_id uuid REFERENCES public.devices(id);

-- Add device_id to pump_settings
ALTER TABLE public.pump_settings ADD COLUMN device_id uuid REFERENCES public.devices(id);

-- Update detect_anomalies to include device_id in alerts
CREATE OR REPLACE FUNCTION public.detect_anomalies()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prev_reading RECORD;
  avg_runtime numeric;
  level_drop numeric;
BEGIN
  SELECT * INTO prev_reading
  FROM public.sensor_data
  WHERE created_at < NEW.created_at
    AND (NEW.device_id IS NULL OR device_id = NEW.device_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF prev_reading IS NOT NULL THEN
    level_drop := prev_reading.water_level - NEW.water_level;
    IF level_drop > 15 THEN
      INSERT INTO public.alerts (alert_type, alert_message, severity, device_id)
      VALUES (
        'water_level',
        'Sudden water level drop detected: ' || round(level_drop, 1) || '% decrease. Possible leak.',
        'critical',
        NEW.device_id
      );
    END IF;
  END IF;

  IF NEW.water_level <= 10 THEN
    INSERT INTO public.alerts (alert_type, alert_message, severity, device_id)
    VALUES ('water_level', 'Critical water level: ' || round(NEW.water_level, 1) || '%. Immediate refill required.', 'critical', NEW.device_id);
  ELSIF NEW.water_level <= 20 THEN
    INSERT INTO public.alerts (alert_type, alert_message, severity, device_id)
    VALUES ('water_level', 'Low water level warning: ' || round(NEW.water_level, 1) || '%. Consider refilling soon.', 'warning', NEW.device_id);
  END IF;

  IF NEW.pump_runtime IS NOT NULL AND NEW.pump_runtime > 0 THEN
    SELECT AVG(pump_runtime) INTO avg_runtime
    FROM (
      SELECT pump_runtime FROM public.sensor_data
      WHERE pump_runtime > 0 AND created_at < NEW.created_at
        AND (NEW.device_id IS NULL OR device_id = NEW.device_id)
      ORDER BY created_at DESC
      LIMIT 20
    ) recent;

    IF avg_runtime IS NOT NULL AND avg_runtime > 0 AND NEW.pump_runtime > avg_runtime * 2 THEN
      INSERT INTO public.alerts (alert_type, alert_message, severity, device_id)
      VALUES ('pump_runtime', 'Abnormal pump runtime: ' || round(NEW.pump_runtime, 1) || ' min (avg: ' || round(avg_runtime, 1) || ' min).', 'warning', NEW.device_id);
    END IF;
  END IF;

  IF NEW.tds_value > 600 THEN
    INSERT INTO public.alerts (alert_type, alert_message, severity, device_id)
    VALUES ('water_quality', 'High TDS: ' || round(NEW.tds_value, 0) || ' ppm. Water quality unsafe.', 'critical', NEW.device_id);
  ELSIF NEW.tds_value > 400 THEN
    INSERT INTO public.alerts (alert_type, alert_message, severity, device_id)
    VALUES ('water_quality', 'Elevated TDS: ' || round(NEW.tds_value, 0) || ' ppm. Monitor quality.', 'warning', NEW.device_id);
  END IF;

  RETURN NEW;
END;
$function$;
