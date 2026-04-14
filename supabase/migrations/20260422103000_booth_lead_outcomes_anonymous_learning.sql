-- Lead sales outcomes + anonymous learning examples (PII-safe).
-- Replaces view ai_booth_learning_examples with a real table of the same name;
-- previous view is preserved as ai_booth_session_training.
--
-- Run AFTER: 20260422093000_booth_learning_foundation.sql (needs ai_booth_sessions).
-- Re-runs: DROP VIEW only if the name is still a view (after first apply it is a TABLE).

-- 1) Preserve the old "session + events" reporting shape under a new view name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ai_booth_learning_examples'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.ai_booth_learning_examples CASCADE';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.ai_booth_session_training AS
SELECT
  s.id AS session_id,
  s.session_key,
  s.outcome,
  s.outcome_reason,
  s.outcome_at,
  s.source,
  s.campaign,
  s.intent,
  s.customer_interest,
  s.utm,
  s.context,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'event_type', e.event_type,
        'created_at', e.created_at,
        'payload', e.payload
      )
      ORDER BY e.created_at
    )
    FROM public.ai_booth_events e
    WHERE e.session_id = s.id
  ) AS events
FROM public.ai_booth_sessions s
WHERE s.outcome <> 'unknown';

COMMENT ON VIEW public.ai_booth_session_training IS
  'Session-level training rows with full event stream (internal; may reference lead_id on session).';

-- 2) Lead pipeline outcome (admin / manager).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_outcome text NOT NULL DEFAULT 'open'
    CHECK (lead_outcome IN ('open', 'closed_won', 'closed_lost', 'follow_up', 'no_show'));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_outcome_reason text NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_outcome_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_leads_lead_outcome ON public.leads (lead_outcome, lead_outcome_at DESC);

COMMENT ON COLUMN public.leads.lead_outcome IS 'Sales outcome: won/lost/follow-up (no PII in this column).';
COMMENT ON COLUMN public.leads.lead_outcome_reason IS 'Optional short reason for learning (avoid personal data).';

-- 3) Anonymous examples table (no email/phone/name stored here).
CREATE TABLE IF NOT EXISTS public.ai_booth_learning_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('closed_won', 'closed_lost')),
  reason_category text NULL,
  lesson_summary text NULL,
  context_tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  session_id uuid NULL REFERENCES public.ai_booth_sessions(id) ON DELETE SET NULL,
  lead_status_snapshot text NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_booth_learning_examples_outcome_time
  ON public.ai_booth_learning_examples (outcome, created_at DESC);

COMMENT ON TABLE public.ai_booth_learning_examples IS
  'Anonymous win/loss lessons for weekly intelligence and prompt tuning — no PII.';

-- 4) Derive safe context from leads.notes JSON + public columns (never copy email/phone).
CREATE OR REPLACE FUNCTION public._lead_notes_booth_context(p_notes text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  j jsonb;
BEGIN
  IF p_notes IS NULL OR btrim(p_notes) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  BEGIN
    j := p_notes::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
  END;
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'intent', to_jsonb(nullif(trim(j->'booth_attribution'->>'intent'), '')),
    'source', to_jsonb(nullif(trim(j->'booth_attribution'->>'source'), '')),
    'campaign', to_jsonb(nullif(trim(j->'booth_attribution'->>'campaign'), '')),
    'customer_interest', to_jsonb(nullif(trim(j->'booth_attribution'->>'customer_interest'), '')),
    'utm_campaign', to_jsonb(nullif(trim(j->'booth_attribution'->'utm'->>'utm_campaign'), '')),
    'utm_source', to_jsonb(nullif(trim(j->'booth_attribution'->'utm'->>'utm_source'), ''))
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.leads_record_anonymous_booth_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outcome text;
  v_reason text;
  v_session uuid;
  v_tags jsonb;
  v_summary text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_outcome := NEW.lead_outcome;
  IF v_outcome IS NULL OR v_outcome NOT IN ('closed_won', 'closed_lost') THEN
    RETURN NEW;
  END IF;
  IF OLD.lead_outcome IS NOT DISTINCT FROM NEW.lead_outcome THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_session
  FROM public.ai_booth_sessions
  WHERE lead_id = NEW.id
  ORDER BY last_seen_at DESC NULLS LAST
  LIMIT 1;

  v_tags := public._lead_notes_booth_context(NEW.notes)
    || jsonb_build_object(
      'event_type', to_jsonb(nullif(btrim(coalesce(NEW.event_type, '')), '')),
      'location_region', to_jsonb(nullif(btrim(coalesce(NEW.location, '')), '')),
      'source_channel', to_jsonb(nullif(btrim(coalesce(NEW.source, '')), ''))
    );

  v_reason := nullif(btrim(coalesce(NEW.lead_outcome_reason, '')), '');
  v_summary := CASE
    WHEN v_reason IS NOT NULL THEN left(v_reason, 2000)
    ELSE NULL
  END;

  INSERT INTO public.ai_booth_learning_examples (
    outcome,
    reason_category,
    lesson_summary,
    context_tags,
    session_id,
    lead_status_snapshot
  )
  VALUES (
    v_outcome,
    NULL,
    v_summary,
    coalesce(v_tags, '{}'::jsonb),
    v_session,
    nullif(btrim(coalesce(NEW.status, '')), '')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_anonymous_booth_lesson ON public.leads;
CREATE TRIGGER trg_leads_anonymous_booth_lesson
  AFTER UPDATE OF lead_outcome, lead_outcome_reason, notes, status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_record_anonymous_booth_lesson();

COMMENT ON FUNCTION public.leads_record_anonymous_booth_lesson() IS
  'On lead_outcome -> closed_won/closed_lost, append one anonymous lesson row (no PII).';

ALTER TABLE public.ai_booth_learning_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_booth_learning_examples_select_manager ON public.ai_booth_learning_examples;

-- Managers: read-only on anonymous examples (writes only via trigger).
CREATE POLICY ai_booth_learning_examples_select_manager
  ON public.ai_booth_learning_examples
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dj_profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'MANAGER'
    )
  );

GRANT SELECT ON public.ai_booth_learning_examples TO authenticated;
