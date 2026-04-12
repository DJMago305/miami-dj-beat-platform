-- SOUNDFORTIPS: solo DJs con plan PRO activo (alineado a mdbProfileIsVipPro + plan_expires_at).

CREATE OR REPLACE FUNCTION public.dj_soundfortips_plan_ok(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dj_profiles d
    WHERE d.user_id = uid
      AND (d.plan_expires_at IS NULL OR d.plan_expires_at > now())
      AND (
        d.is_premium IS TRUE
        OR (
          lower(coalesce(d.plan_status, 'active')) = 'active'
          AND (
            d.plan IN ('PRO', 'ELITE')
            OR coalesce(d.plan_type, '') IN ('pro_monthly', 'pro_annual')
            OR lower(coalesce(d.subscription_status, '')) IN ('active', 'trialing')
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_soundfortips_night_log(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  sender_label text,
  song text,
  artist text,
  tip_usd numeric,
  poster_url text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.id, fr.sender_label, fr.song, fr.artist, fr.tip_usd, fr.poster_url, fr.status, fr.created_at
  FROM public.soundfortips_fan_requests fr
  WHERE fr.dj_user_id = (SELECT auth.uid())
    AND public.dj_soundfortips_plan_ok((SELECT auth.uid()))
    AND (p_since IS NULL OR fr.created_at >= p_since)
  ORDER BY fr.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_soundfortips_night_log(p_since timestamptz DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.dj_soundfortips_plan_ok((SELECT auth.uid())) THEN
    RETURN 0;
  END IF;
  DELETE FROM public.soundfortips_fan_requests
  WHERE dj_user_id = (SELECT auth.uid())
    AND (p_since IS NULL OR created_at >= p_since);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.dj_soundfortips_plan_ok IS 'True if DJ may use SOUNDFORTIPS (PRO tier, not expired).';

REVOKE ALL ON FUNCTION public.dj_soundfortips_plan_ok(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dj_soundfortips_plan_ok(uuid) TO service_role;
