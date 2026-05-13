-- Public DJ reviews: persisted ratings for fan profile (hero stars + carousel).
-- Syncs dj_profiles.rating / review_count for roster and public_dj_profiles view.

ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS rating numeric(4, 2),
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.dj_public_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reviewer_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  reviewer_display_name text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dj_public_reviews_one_per_reviewer UNIQUE (dj_user_id, reviewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_dj_public_reviews_dj_published
  ON public.dj_public_reviews (dj_user_id, created_at DESC)
  WHERE status = 'published';

COMMENT ON TABLE public.dj_public_reviews IS
  'Verified client reviews shown on dj-profile fan view; rollup updates dj_profiles.rating/review_count.';

ALTER TABLE public.dj_public_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dj_public_reviews_select_published" ON public.dj_public_reviews;
CREATE POLICY "dj_public_reviews_select_published"
  ON public.dj_public_reviews
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "dj_public_reviews_insert_own" ON public.dj_public_reviews;
CREATE POLICY "dj_public_reviews_insert_own"
  ON public.dj_public_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_user_id = auth.uid()
    AND dj_user_id IS DISTINCT FROM auth.uid()
  );

DROP POLICY IF EXISTS "dj_public_reviews_update_own" ON public.dj_public_reviews;
CREATE POLICY "dj_public_reviews_update_own"
  ON public.dj_public_reviews
  FOR UPDATE
  TO authenticated
  USING (reviewer_user_id = auth.uid())
  WITH CHECK (reviewer_user_id = auth.uid() AND dj_user_id IS DISTINCT FROM auth.uid());

-- ── Rollup into dj_profiles ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_dj_profile_review_rollup(p_dj_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_avg numeric;
BEGIN
  IF p_dj_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::integer, round(avg(rating)::numeric, 2)
  INTO v_count, v_avg
  FROM public.dj_public_reviews
  WHERE dj_user_id = p_dj_user_id
    AND status = 'published';

  UPDATE public.dj_profiles
  SET
    review_count = COALESCE(v_count, 0),
    rating = CASE WHEN COALESCE(v_count, 0) > 0 THEN v_avg ELSE NULL END
  WHERE user_id = p_dj_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_dj_public_reviews_refresh_rollup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_dj_profile_review_rollup(OLD.dj_user_id);
    RETURN OLD;
  END IF;
  PERFORM public.refresh_dj_profile_review_rollup(NEW.dj_user_id);
  IF TG_OP = 'UPDATE' AND NEW.dj_user_id IS DISTINCT FROM OLD.dj_user_id THEN
    PERFORM public.refresh_dj_profile_review_rollup(OLD.dj_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dj_public_reviews_refresh_rollup ON public.dj_public_reviews;
CREATE TRIGGER trg_dj_public_reviews_refresh_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.dj_public_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_dj_public_reviews_refresh_rollup();

-- ── Public read bundle (fan profile) ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_dj_public_review_bundle(uuid);

CREATE OR REPLACE FUNCTION public.get_dj_public_review_bundle(p_dj_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_avg numeric;
  v_rows jsonb;
BEGIN
  IF p_dj_user_id IS NULL THEN
    RETURN jsonb_build_object('avg_rating', null, 'review_count', 0, 'reviews', '[]'::jsonb);
  END IF;

  SELECT count(*)::integer, round(avg(rating)::numeric, 2)
  INTO v_count, v_avg
  FROM public.dj_public_reviews
  WHERE dj_user_id = p_dj_user_id
    AND status = 'published';

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.id,
      r.rating,
      NULLIF(btrim(COALESCE(r.comment, '')), '') AS comment,
      COALESCE(
        NULLIF(btrim(r.reviewer_display_name), ''),
        NULLIF(btrim(cp.full_name), ''),
        'Verified client'
      ) AS reviewer_display_name,
      r.created_at
    FROM public.dj_public_reviews r
    LEFT JOIN public.client_profiles cp ON cp.user_id = r.reviewer_user_id
    WHERE r.dj_user_id = p_dj_user_id
      AND r.status = 'published'
    ORDER BY r.created_at DESC
    LIMIT 24
  ) t;

  RETURN jsonb_build_object(
    'avg_rating', CASE WHEN COALESCE(v_count, 0) > 0 THEN v_avg ELSE null END,
    'review_count', COALESCE(v_count, 0),
    'reviews', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dj_public_review_bundle(uuid) TO anon, authenticated;

-- ── Submit / update own review (authenticated client) ─────────────────────
DROP FUNCTION IF EXISTS public.submit_dj_public_review(uuid, smallint, text);

CREATE OR REPLACE FUNCTION public.submit_dj_public_review(
  p_dj_user_id uuid,
  p_rating smallint,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_row public.dj_public_reviews%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_dj_user_id IS NULL OR p_dj_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot review your own profile';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dj_profiles d WHERE d.user_id = p_dj_user_id) THEN
    RAISE EXCEPTION 'DJ profile not found';
  END IF;

  SELECT NULLIF(btrim(cp.full_name), '')
  INTO v_name
  FROM public.client_profiles cp
  WHERE cp.user_id = v_uid;

  IF v_name IS NULL THEN
    SELECT NULLIF(btrim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), '')
    INTO v_name
    FROM auth.users u
    WHERE u.id = v_uid;
  END IF;

  INSERT INTO public.dj_public_reviews (
    dj_user_id, reviewer_user_id, rating, comment, reviewer_display_name, status, updated_at
  )
  VALUES (
    p_dj_user_id, v_uid, p_rating, NULLIF(btrim(COALESCE(p_comment, '')), ''), COALESCE(v_name, 'Verified client'), 'published', now()
  )
  ON CONFLICT (dj_user_id, reviewer_user_id) DO UPDATE
  SET
    rating = EXCLUDED.rating,
    comment = COALESCE(EXCLUDED.comment, public.dj_public_reviews.comment),
    reviewer_display_name = COALESCE(EXCLUDED.reviewer_display_name, public.dj_public_reviews.reviewer_display_name),
    status = 'published',
    updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.refresh_dj_profile_review_rollup(p_dj_user_id);

  RETURN public.get_dj_public_review_bundle(p_dj_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_dj_public_review(uuid, smallint, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
