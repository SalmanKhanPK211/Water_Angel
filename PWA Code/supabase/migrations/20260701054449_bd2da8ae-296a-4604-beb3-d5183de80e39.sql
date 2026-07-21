DROP VIEW IF EXISTS public.device_hardware_status;
CREATE VIEW public.device_hardware_status
WITH (security_invoker = true) AS
SELECT id, system_key, pending_command, tank_height, tank_height_unit, calibration_mode
FROM public.devices;
GRANT SELECT ON public.device_hardware_status TO anon, authenticated;