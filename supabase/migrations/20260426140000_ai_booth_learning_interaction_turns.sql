-- Interaction turns → ai_booth_learning_examples (row_kind = interaction_turn).
-- Radar (intent, source, campaign) se guarda en `radar` + upsert de sesión vía booth_upsert_session.
-- Requiere: 20260422103000_booth_lead_outcomes_anonymous_learning.sql (tabla ai_booth_learning_examples).

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_catalog.pg_constraint con
  INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'ai_booth_learning_examples'
    AND con.contype = 'c'
    AND pg_catalog.pg_get_constraintdef(con.oid, true) ILIKE '%outcome%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ai_booth_learning_examples DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.ai_booth_learning_examples
  ADD COLUMN IF NOT EXISTS row_kind text;

UPDATE public.ai_booth_learning_examples SET row_kind = 'outcome_lesson' WHERE row_kind IS NULL;

ALTER TABLE public.ai_booth_learning_examples
  ALTER COLUMN row_kind SET DEFAULT 'outcome_lesson';

ALTER TABLE public.ai_booth_learning_examples
  ALTER COLUMN row_kind SET NOT NULL;

ALTER TABLE public.ai_booth_learning_examples
  DROP CONSTRAINT IF EXISTS ai_booth_learning_examples_row_kind_check;

ALTER TABLE public.ai_booth_learning_examples
  ADD CONSTRAINT ai_booth_learning_examples_row_kind_check
  CHECK (row_kind IN ('outcome_lesson', 'interaction_turn'));

ALTER TABLE public.ai_booth_learning_examples
  ALTER COLUMN outcome DROP NOT NULL;

ALTER TABLE public.ai_booth_learning_examples
  DROP CONSTRAINT IF EXISTS ai_booth_learning_examples_outcome_by_kind;

ALTER TABLE public.ai_booth_learning_examples
  ADD CONSTRAINT ai_booth_learning_examples_outcome_by_kind CHECK (
    (row_kind = 'outcome_lesson' AND outcome IS NOT NULL AND outcome IN ('closed_won', 'closed_lost'))
    OR (row_kind = 'interaction_turn' AND outcome IS NULL)
  );

ALTER TABLE public.ai_booth_learning_examples
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.ai_booth_learning_examples
  ADD COLUMN IF NOT EXISTS radar jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ai_booth_learning_examples
  ADD COLUMN IF NOT EXISTS exchange jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_booth_learning_examples_row_kind_time
  ON public.ai_booth_learning_examples (row_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_booth_learning_examples_lead
  ON public.ai_booth_learning_examples (lead_id)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN public.ai_booth_learning_examples.row_kind IS 'outcome_lesson = cierre anónimo (trigger leads); interaction_turn = turno Booth (sin PII en exchange).';
COMMENT ON COLUMN public.ai_booth_learning_examples.radar IS 'Intent / source / campaign (atribución Crystal o URL).';
COMMENT ON COLUMN public.ai_booth_learning_examples.exchange IS 'Excerpts user/assistant + meta; sin email/teléfono.';

CREATE OR REPLACE FUNCTION public.booth_log_learning_interaction(
  p_session_key text,
  p_lead_id uuid DEFAULT NULL,
  p_user_excerpt text DEFAULT NULL,
  p_assistant_excerpt text DEFAULT NULL,
  p_extra jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_sid uuid;
  v_extra jsonb;
  v_radar jsonb;
  v_new_id uuid;
BEGIN
  v_key := nullif(trim(coalesce(p_session_key, '')), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'p_session_key is required';
  END IF;

  v_extra := coalesce(p_extra, '{}'::jsonb);

  v_sid := public.booth_upsert_session(v_key, v_extra);

  IF p_lead_id IS NOT NULL THEN
    UPDATE public.ai_booth_sessions
    SET lead_id = coalesce(p_lead_id, lead_id), updated_at = now(), last_seen_at = now()
    WHERE id = v_sid;
  END IF;

  v_radar := jsonb_strip_nulls(jsonb_build_object(
    'intent', nullif(trim(coalesce(v_extra->>'intent', '')), ''),
    'source', nullif(trim(coalesce(v_extra->>'source', '')), ''),
    'campaign', nullif(trim(coalesce(v_extra->>'campaign', '')), '')
  ));

  INSERT INTO public.ai_booth_learning_examples (
    row_kind,
    outcome,
    reason_category,
    lesson_summary,
    context_tags,
    session_id,
    lead_id,
    lead_status_snapshot,
    radar,
    exchange
  )
  VALUES (
    'interaction_turn',
    NULL,
    NULL,
    NULL,
    v_extra,
    v_sid,
    p_lead_id,
    NULL,
    coalesce(v_radar, '{}'::jsonb),
    jsonb_strip_nulls(jsonb_build_object(
      'user_excerpt', nullif(left(trim(coalesce(p_user_excerpt, '')), 4000), ''),
      'assistant_excerpt', nullif(left(trim(coalesce(p_assistant_excerpt, '')), 4000), ''),
      'recorded_at', to_jsonb(now())
    ))
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.booth_log_learning_interaction(text, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booth_log_learning_interaction(text, uuid, text, text, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.booth_log_learning_interaction(text, uuid, text, text, jsonb) IS
  'Registra un turno de aprendizaje (PII-safe) con radar + lead opcional; usa SECURITY DEFINER.';
