CREATE OR REPLACE FUNCTION public.referral_code_exists(_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE referral_code = upper(_code)
  );
$$;

REVOKE ALL ON FUNCTION public.referral_code_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_code_exists(TEXT) TO anon, authenticated, service_role;