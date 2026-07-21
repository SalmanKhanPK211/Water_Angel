-- Admin emails table
CREATE TABLE public.admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_emails ae
    JOIN auth.users u ON lower(u.email) = lower(ae.email)
    WHERE u.id = auth.uid()
  );
$$;

-- Admins can read their own admin record (so the client can detect admin)
CREATE POLICY "Admins can read admin_emails"
ON public.admin_emails FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage admin_emails"
ON public.admin_emails FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Add calibration + command columns to devices
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS calibration_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_command text;

-- Admin policies on devices
CREATE POLICY "Admins can view all devices"
ON public.devices FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert devices"
ON public.devices FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update any device"
ON public.devices FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete devices"
ON public.devices FOR DELETE
TO authenticated
USING (public.is_admin());