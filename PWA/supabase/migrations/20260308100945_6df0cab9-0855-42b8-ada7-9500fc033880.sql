
-- Anomaly detection function that runs on each new sensor_data insert
CREATE OR REPLACE FUNCTION public.detect_anomalies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  prev_reading RECORD;
  avg_runtime numeric;
  level_drop numeric;
BEGIN
  -- Get the previous sensor reading
  SELECT * INTO prev_reading
  FROM public.sensor_data
  WHERE created_at < NEW.created_at
  ORDER BY created_at DESC
  LIMIT 1;

  IF prev_reading IS NOT NULL THEN
    -- Detect sudden water level drop (>15% in one reading interval)
    level_drop := prev_reading.water_level - NEW.water_level;
    IF level_drop > 15 THEN
      INSERT INTO public.alerts (alert_type, alert_message, severity)
      VALUES (
        'water_level',
        'Sudden water level drop detected: ' || round(level_drop, 1) || '% decrease (from ' || round(prev_reading.water_level, 1) || '% to ' || round(NEW.water_level, 1) || '%). Possible leak.',
        'critical'
      );
    END IF;
  END IF;

  -- Detect critical low water level
  IF NEW.water_level <= 10 THEN
    INSERT INTO public.alerts (alert_type, alert_message, severity)
    VALUES (
      'water_level',
      'Critical water level: ' || round(NEW.water_level, 1) || '%. Immediate refill required.',
      'critical'
    );
  ELSIF NEW.water_level <= 20 THEN
    INSERT INTO public.alerts (alert_type, alert_message, severity)
    VALUES (
      'water_level',
      'Low water level warning: ' || round(NEW.water_level, 1) || '%. Consider refilling soon.',
      'warning'
    );
  END IF;

  -- Detect abnormal pump runtime (>2x the average of last 20 readings)
  IF NEW.pump_runtime IS NOT NULL AND NEW.pump_runtime > 0 THEN
    SELECT AVG(pump_runtime) INTO avg_runtime
    FROM (
      SELECT pump_runtime FROM public.sensor_data
      WHERE pump_runtime > 0 AND created_at < NEW.created_at
      ORDER BY created_at DESC
      LIMIT 20
    ) recent;

    IF avg_runtime IS NOT NULL AND avg_runtime > 0 AND NEW.pump_runtime > avg_runtime * 2 THEN
      INSERT INTO public.alerts (alert_type, alert_message, severity)
      VALUES (
        'pump_runtime',
        'Abnormal pump runtime detected: ' || round(NEW.pump_runtime, 1) || ' min (avg: ' || round(avg_runtime, 1) || ' min). Check pump health.',
        'warning'
      );
    END IF;
  END IF;

  -- Detect high TDS
  IF NEW.tds_value > 600 THEN
    INSERT INTO public.alerts (alert_type, alert_message, severity)
    VALUES (
      'water_quality',
      'High TDS detected: ' || round(NEW.tds_value, 0) || ' ppm. Water quality is unsafe.',
      'critical'
    );
  ELSIF NEW.tds_value > 400 THEN
    INSERT INTO public.alerts (alert_type, alert_message, severity)
    VALUES (
      'water_quality',
      'Elevated TDS detected: ' || round(NEW.tds_value, 0) || ' ppm. Monitor water quality.',
      'warning'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on sensor_data inserts
CREATE TRIGGER on_sensor_data_anomaly_check
  AFTER INSERT ON public.sensor_data
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_anomalies();
