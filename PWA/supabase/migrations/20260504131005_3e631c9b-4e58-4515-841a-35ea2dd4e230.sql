CREATE POLICY "Anon can read devices for hardware lookup"
ON public.devices
FOR SELECT
TO anon
USING (true);