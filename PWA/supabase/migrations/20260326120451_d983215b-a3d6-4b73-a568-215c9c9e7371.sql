ALTER TABLE public.devices ADD COLUMN tank_height numeric DEFAULT NULL;
ALTER TABLE public.devices ADD COLUMN tank_height_unit text DEFAULT 'inches';