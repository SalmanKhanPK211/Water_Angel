INSERT INTO public.daily_usage (device_id, usage_date, liters_used, percent_used, readings_count, capacity_liters_snapshot)
SELECT 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid, d::date,
       ROUND((70 + random()*45 + CASE WHEN extract(dow from d) IN (0,6) THEN 25 ELSE 0 END)::numeric,1)::float8,
       ROUND(((70 + random()*45)/250*100)::numeric,1)::float8,
       120 + floor(random()*20)::int, 250
FROM generate_series('2026-09-06'::date, '2026-09-09'::date, interval '1 day') d
ON CONFLICT (device_id, usage_date) DO UPDATE
  SET liters_used = EXCLUDED.liters_used,
      percent_used = EXCLUDED.percent_used,
      readings_count = EXCLUDED.readings_count,
      capacity_liters_snapshot = EXCLUDED.capacity_liters_snapshot;