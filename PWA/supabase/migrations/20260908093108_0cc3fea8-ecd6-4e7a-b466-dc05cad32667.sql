CREATE OR REPLACE FUNCTION public.rollup_daily_usage(p_day date DEFAULT ((now() AT TIME ZONE 'Asia/Karachi')::date))
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      AND (s.created_at AT TIME ZONE 'Asia/Karachi')::date = p_day
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

CREATE OR REPLACE FUNCTION public.backfill_daily_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  v_total integer := 0;
BEGIN
  FOR d IN
    SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Karachi')::date AS day
    FROM public.sensor_data
    WHERE device_id IS NOT NULL
    ORDER BY 1
  LOOP
    v_total := v_total + public.rollup_daily_usage(d);
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_daily_usage(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_daily_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_daily_usage(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_daily_usage() TO service_role;

SELECT cron.unschedule('daily-usage-rollup');
SELECT cron.schedule(
  'daily-usage-rollup',
  '59 18 * * *',
  $$SELECT public.rollup_daily_usage((now() AT TIME ZONE 'Asia/Karachi')::date);$$
);