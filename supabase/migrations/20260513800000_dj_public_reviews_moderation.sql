-- Opiniones públicas: 1 por cuenta/cliente por DJ; autor edita la suya; solo gestión oculta (fraude).

DROP POLICY IF EXISTS "dj_public_reviews_select_own" ON public.dj_public_reviews;
CREATE POLICY "dj_public_reviews_select_own"
  ON public.dj_public_reviews FOR SELECT TO authenticated
  USING (reviewer_user_id = auth.uid());

DROP POLICY IF EXISTS "dj_public_reviews_mgmt_select" ON public.dj_public_reviews;
CREATE POLICY "dj_public_reviews_mgmt_select"
  ON public.dj_public_reviews FOR SELECT TO authenticated
  USING (public.is_staff_management(auth.uid()));

DROP FUNCTION IF EXISTS public.get_my_dj_public_review_for_dj(uuid);

CREATE OR REPLACE FUNCTION public.get_my_dj_public_review_for_dj(p_dj_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row jsonb;
BEGIN
  IF v_uid IS NULL OR p_dj_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT to_jsonb(t) INTO v_row
  FROM (
    SELECT id, rating, comment, status, created_at, updated_at
    FROM public.dj_public_reviews
    WHERE dj_user_id = p_dj_user_id
      AND reviewer_user_id = v_uid
    LIMIT 1
  ) t;
  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.get_my_dj_public_review_for_dj(uuid) IS
  'Sesión: reseña propia sobre un DJ (para editar). Incluye hidden para que el autor pueda actualizar.';

GRANT EXECUTE ON FUNCTION public.get_my_dj_public_review_for_dj(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.staff_hide_dj_public_review(uuid);

CREATE OR REPLACE FUNCTION public.staff_hide_dj_public_review(p_review_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_dj uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_session');
  END IF;
  IF NOT public.is_staff_management(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_review_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_id');
  END IF;

  UPDATE public.dj_public_reviews
  SET status = 'hidden', updated_at = now()
  WHERE id = p_review_id
    AND status = 'published'
  RETURNING dj_user_id INTO v_dj;

  IF v_dj IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_already_hidden');
  END IF;

  PERFORM public.refresh_dj_profile_review_rollup(v_dj);

  RETURN jsonb_build_object('ok', true, 'dj_user_id', v_dj);
END;
$$;

COMMENT ON FUNCTION public.staff_hide_dj_public_review(uuid) IS
  'Solo gestión (admin/owner/manager): oculta opinión fraudulenta (status=hidden). Sin DELETE.';

GRANT EXECUTE ON FUNCTION public.staff_hide_dj_public_review(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.staff_list_dj_public_reviews_recent(integer);

CREATE OR REPLACE FUNCTION public.staff_list_dj_public_reviews_recent(p_limit integer DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lim integer;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff_management(v_uid) THEN
    RETURN '[]'::jsonb;
  END IF;
  v_lim := greatest(1, least(coalesce(p_limit, 40), 100));

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.id,
      r.dj_user_id,
      r.reviewer_user_id,
      r.rating,
      NULLIF(btrim(COALESCE(r.comment, '')), '') AS comment,
      r.reviewer_display_name,
      r.status,
      r.created_at,
      coalesce(d.stage_name, d.full_name, d.dj_name) AS dj_label
    FROM public.dj_public_reviews r
    LEFT JOIN public.dj_profiles d ON d.user_id = r.dj_user_id
    WHERE r.status = 'published'
    ORDER BY r.created_at DESC
    LIMIT v_lim
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.staff_list_dj_public_reviews_recent(integer) IS
  'Panel CEO/gestión: últimas opiniones publicadas para moderación (ocultar vía staff_hide_dj_public_review).';

GRANT EXECUTE ON FUNCTION public.staff_list_dj_public_reviews_recent(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
