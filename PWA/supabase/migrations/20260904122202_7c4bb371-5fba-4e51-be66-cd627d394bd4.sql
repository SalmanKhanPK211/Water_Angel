CREATE TABLE public.daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  liters_used double precision NOT NULL DEFAULT 0,
  percent_used double precision NOT NULL DEFAULT 0,
  readings_count integer NOT NULL DEFAULT 0,
  capacity_liters_snapshot double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, usage_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_usage TO authenticated;
GRANT ALL ON public.daily_usage TO service_role;

ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can read daily usage"
ON public.daily_usage FOR SELECT TO authenticated
USING (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = daily_usage.device_id AND d.user_id = auth.uid()));

CREATE POLICY "Owners and admins can insert daily usage"
ON public.daily_usage FOR INSERT TO authenticated
WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = daily_usage.device_id AND d.user_id = auth.uid()));

CREATE POLICY "Owners and admins can update daily usage"
ON public.daily_usage FOR UPDATE TO authenticated
USING (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = daily_usage.device_id AND d.user_id = auth.uid()))
WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = daily_usage.device_id AND d.user_id = auth.uid()));

CREATE POLICY "Owners and admins can delete daily usage"
ON public.daily_usage FOR DELETE TO authenticated
USING (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = daily_usage.device_id AND d.user_id = auth.uid()));

CREATE TRIGGER update_daily_usage_updated_at
BEFORE UPDATE ON public.daily_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_daily_usage_device_date ON public.daily_usage (device_id, usage_date DESC);

-- Rollup: sum consecutive water-level drops for a day, convert to litres.
CREATE OR REPLACE FUNCTION public.rollup_daily_usage(p_day date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  WITH stepped AS (
    SELECT
      s.device_id,
      s.water_level,
      LAG(s.water_level) OVER (PARTITION BY s.device_id ORDER BY s.created_at) AS prev_level
    FROM public.sensor_data s
    WHERE s.device_id IS NOT NULL
      AND (s.created_at AT TIME ZONE 'utc')::date = p_day
  ),
  agg AS (
    SELECT
      device_id,
      COALESCE(SUM(GREATEST(prev_level - water_level, 0)), 0) AS percent_used,
      COUNT(*)::int AS readings_count
    FROM stepped
    GROUP BY device_id
  )
  INSERT INTO public.daily_usage
    (device_id, usage_date, liters_used, percent_used, readings_count, capacity_liters_snapshot)
  SELECT
    a.device_id,
    p_day,
    a.percent_used * COALESCE(d.capacity_liters, 0) / 100.0,
    a.percent_used,
    a.readings_count,
    COALESCE(d.capacity_liters, 0)
  FROM agg a
  JOIN public.devices d ON d.id = a.device_id
  ON CONFLICT (device_id, usage_date) DO UPDATE
    SET liters_used = EXCLUDED.liters_used,
        percent_used = EXCLUDED.percent_used,
        readings_count = EXCLUDED.readings_count,
        capacity_liters_snapshot = EXCLUDED.capacity_liters_snapshot,
        updated_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_daily_usage(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rollup_daily_usage(date) TO service_role;

-- Backfill: run the rollup for every day that has telemetry.
CREATE OR REPLACE FUNCTION public.backfill_daily_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d date;
  v_total integer := 0;
BEGIN
  FOR d IN
    SELECT DISTINCT (created_at AT TIME ZONE 'utc')::date AS day
    FROM public.sensor_data
    WHERE device_id IS NOT NULL
    ORDER BY 1
  LOOP
    v_total := v_total + public.rollup_daily_usage(d);
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_daily_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backfill_daily_usage() TO service_role;