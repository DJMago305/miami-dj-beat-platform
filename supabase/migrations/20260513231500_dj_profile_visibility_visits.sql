-- Visibilidad Flujo de caja: visitas al perfil público del DJ (no cuenta al dueño).
-- Requiere public.mdj_flow_tz_bucket_date (migración rollups Fase A).

CREATE TABLE IF NOT EXISTS public.dj_profile_visits (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visited_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dj_profile_visits_dj_time
    ON public.dj_profile_visits (dj_user_id, visited_at DESC);

COMMENT ON TABLE public.dj_profile_visits IS
  'Public profile page views; aggregated in get_my_profile_visibility_stats for owner dashboard.';

ALTER TABLE public.dj_profile_visits ENABLE ROW LEVEL SECURITY;

-- Sin políticas directas: solo RPC SECURITY DEFINER.

DROP FUNCTION IF EXISTS public.record_dj_profile_visit(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.record_dj_profile_visit(p_dj_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    INSERT INTO public.dj_profile_visits (dj_user_id, visited_at)
    VALUES (p_dj_user_id, now());
END;
$$;

REVOKE ALL ON FUNCTION public.record_dj_profile_visit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_dj_profile_visit(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.record_dj_profile_visit IS
  'Increment profile visit counter (anon or logged-in visitors; skips profile owner).';

DROP FUNCTION IF EXISTS public.get_my_profile_visibility_stats() CASCADE;

CREATE OR REPLACE FUNCTION public.get_my_profile_visibility_stats()
RETURNS TABLE (
    visits_today bigint,
    visits_week  bigint,
    visits_total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH bounds AS (
        SELECT
            public.mdj_flow_tz_bucket_date(now()) AS today_et,
            date_trunc(
                'week',
                public.mdj_flow_tz_bucket_date(now())::timestamp
            )::date AS week_start_et
    )
    SELECT
        COUNT(*) FILTER (
            WHERE public.mdj_flow_tz_bucket_date(v.visited_at) = b.today_et
        )::bigint AS visits_today,
        COUNT(*) FILTER (
            WHERE public.mdj_flow_tz_bucket_date(v.visited_at) >= b.week_start_et
        )::bigint AS visits_week,
        COUNT(*)::bigint AS visits_total
    FROM public.dj_profile_visits v
    CROSS JOIN bounds b
    WHERE v.dj_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile_visibility_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile_visibility_stats() TO authenticated;

COMMENT ON FUNCTION public.get_my_profile_visibility_stats IS
  'Owner dashboard VISIBILIDAD: hoy / semana calendario (lun) / total (America/New_York).';

NOTIFY pgrst, 'reload schema';
