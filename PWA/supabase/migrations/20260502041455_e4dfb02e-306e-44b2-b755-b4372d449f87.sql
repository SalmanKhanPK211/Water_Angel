-- Public function to check if any admin has been registered yet
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_emails);
$$;

GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

-- Allow the FIRST authenticated user to claim admin (only when table is empty).
-- After that, only existing admins can add more via the existing RLS policy.
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_emails) THEN
    RAISE EXCEPTION 'Admin already registered';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No email on user';
  END IF;

  INSERT INTO public.admin_emails (email) VALUES (lower(v_email));
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;