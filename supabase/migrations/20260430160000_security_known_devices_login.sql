-- Known login devices (fingerprint + UA) + RPC for post-password-login.
-- Staff UIs: select explicit lead columns (omit stripe_customer_id) in web admin + client-portal.

CREATE TABLE IF NOT EXISTS public.user_login_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  user_agent text,
  platform_label text,
  approximate_tz text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_login_devices_user_fp_key UNIQUE (user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_user_login_devices_user_id ON public.user_login_devices (user_id);

COMMENT ON TABLE public.user_login_devices IS
  'Fingerprint-based known devices per auth user; used for new-device security emails.';

GRANT SELECT, INSERT, UPDATE ON public.user_login_devices TO authenticated;

ALTER TABLE public.user_login_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_login_devices_select_own" ON public.user_login_devices;
CREATE POLICY "user_login_devices_select_own"
  ON public.user_login_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_login_devices_insert_own" ON public.user_login_devices;
CREATE POLICY "user_login_devices_insert_own"
  ON public.user_login_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_login_devices_update_own" ON public.user_login_devices;
CREATE POLICY "user_login_devices_update_own"
  ON public.user_login_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mdj_record_login_device(
  p_fingerprint text,
  p_user_agent text,
  p_platform_label text DEFAULT NULL,
  p_approx_tz text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  fp text := lower(trim(coalesce(p_fingerprint, '')));
  existed boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(fp) < 16 THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_login_devices d
    WHERE d.user_id = uid AND d.device_fingerprint = fp
  ) INTO existed;

  IF existed THEN
    UPDATE public.user_login_devices
    SET
      last_seen_at = now(),
      user_agent = left(coalesce(p_user_agent, user_agent), 500),
      platform_label = coalesce(nullif(trim(p_platform_label), ''), platform_label),
      approximate_tz = coalesce(nullif(trim(p_approx_tz), ''), approximate_tz)
    WHERE user_id = uid AND device_fingerprint = fp;
    RETURN false;
  END IF;

  INSERT INTO public.user_login_devices (
    user_id, device_fingerprint, user_agent, platform_label, approximate_tz
  ) VALUES (
    uid,
    fp,
    left(coalesce(p_user_agent, ''), 500),
    left(nullif(trim(p_platform_label), ''), 120),
    left(nullif(trim(p_approx_tz), ''), 120)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mdj_record_login_device(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_record_login_device(text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.mdj_record_login_device(text, text, text, text) IS
  'Returns true if this device fingerprint is new for auth.uid(); updates last_seen if known.';

NOTIFY pgrst, 'reload schema';
