-- Visibilidad: origen de visita (perfil público vs QR SoundForTips™).

ALTER TABLE public.dj_profile_visits
    ADD COLUMN IF NOT EXISTS visit_source text NOT NULL DEFAULT 'profile';

ALTER TABLE public.dj_profile_visits
    DROP CONSTRAINT IF EXISTS dj_profile_visits_source_check;

ALTER TABLE public.dj_profile_visits
    ADD CONSTRAINT dj_profile_visits_source_check
    CHECK (visit_source IN ('profile', 'sft_qr'));

DROP FUNCTION IF EXISTS public.record_dj_profile_visit(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.record_dj_profile_visit(uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.record_dj_profile_visit(
    p_dj_user_id uuid,
    p_visit_source text DEFAULT 'profile'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source text := lower(trim(coalesce(p_visit_source, 'profile')));
BEGIN
    IF p_dj_user_id IS NULL THEN
        RETURN;
    END IF;
    IF auth.uid() IS NOT NULL AND auth.uid() = p_dj_user_id THEN
        RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dj_profiles dp WHERE dp.user_id = p_dj_user_id) THEN
        RETURN;
    END IF;
    IF v_source NOT IN ('profile', 'sft_qr') THEN
        v_source := 'profile';
    END IF;
    INSERT INTO public.dj_profile_visits (dj_user_id, visited_at, visit_source)
    VALUES (p_dj_user_id, now(), v_source);
END;
$$;

REVOKE ALL ON FUNCTION public.record_dj_profile_visit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_dj_profile_visit(uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION public.record_dj_profile_visit(uuid, text) IS
  'Profile visibility: visit_source profile | sft_qr (QR / ?view=public song request landing). Skips owner.';

NOTIFY pgrst, 'reload schema';
