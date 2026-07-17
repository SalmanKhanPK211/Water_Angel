
-- Drop the devices table (not used by frontend)
DROP TABLE IF EXISTS public.devices;

-- Remove device_id column from sensor_data
ALTER TABLE public.sensor_data DROP COLUMN IF EXISTS device_id;

-- Remove device_id column from alerts
ALTER TABLE public.alerts DROP COLUMN IF EXISTS device_id;

-- Remove device_id column from pump_settings
ALTER TABLE public.pump_settings DROP COLUMN IF EXISTS device_id;
