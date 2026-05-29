-- SoundForTips™: owner (dueño plataforma) may use cabina without paid MDJPRO row.
-- Keep aligned with mdbProfileSoundForTipsEligible in web/dj-profile.html.

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
      AND lower(coalesce(d.plan_status, 'active')) = 'active'
      AND (
        lower(coalesce(d.role, '')) = 'owner'
        OR d.is_premium IS TRUE
        OR d.plan IN ('PRO', 'ELITE')
        OR lower(coalesce(d.plan_type, '')) IN ('pro_monthly', 'pro_annual')
      )
  );
$$;

COMMENT ON FUNCTION public.dj_soundfortips_plan_ok IS
  'SOUNDFORTIPS: paid MDJPRO (PRO/ELITE, pro_* plan_type, is_premium) OR dj_profiles.role=owner (platform owner).';
