
-- Allow authenticated users to SELECT unclaimed devices (for pairing lookup)
CREATE POLICY "Users can view unclaimed devices" ON public.devices
  FOR SELECT TO authenticated USING (user_id IS NULL);
