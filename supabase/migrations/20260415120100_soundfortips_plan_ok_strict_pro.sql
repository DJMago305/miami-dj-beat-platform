-- SoundForTips™: solo MDJPRO de pago (PRO/ELITE, plan_type pro_*, o is_premium).
-- La versión anterior permitía `subscription_status` activo sin plan PRO explícito (riesgo LITE).
-- Mantener alineado con `mdbProfileSoundForTipsEligible` en web/dj-profile.html.

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
        d.is_premium IS TRUE
        OR d.plan IN ('PRO', 'ELITE')
        OR lower(coalesce(d.plan_type, '')) IN ('pro_monthly', 'pro_annual')
      )
  );
$$;

COMMENT ON FUNCTION public.dj_soundfortips_plan_ok IS 'True if DJ may use SOUNDFORTIPS: paid MDJPRO (PRO/ELITE or pro_* plan_type or is_premium), active plan_status, not expired.';
