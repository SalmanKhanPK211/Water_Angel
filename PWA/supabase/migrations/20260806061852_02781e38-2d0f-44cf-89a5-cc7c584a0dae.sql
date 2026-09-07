ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS capacity_liters integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'devices_capacity_liters_range'
  ) THEN
    ALTER TABLE public.devices
      ADD CONSTRAINT devices_capacity_liters_range
      CHECK (capacity_liters IS NULL OR (capacity_liters > 0 AND capacity_liters <= 1000000));
  END IF;
END $$;

GRANT SELECT (capacity_liters), UPDATE (capacity_liters) ON public.devices TO authenticated;