-- AI Booth learning foundation (sessions, events, outcomes)
-- Goal: build a reliable feedback loop for closed_won / closed_lost analysis.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_booth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text NOT NULL UNIQUE,
  lead_id uuid NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  source text NULL,
  campaign text NULL,
  intent text NULL,
  customer_interest text NULL,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL DEFAULT 'unknown' CHECK (outcome IN ('unknown', 'closed_won', 'closed_lost', 'follow_up', 'no_show')),
  outcome_reason text NULL,
  outcome_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_booth_sessions_outcome ON public.ai_booth_sessions (outcome, outcome_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_booth_sessions_source_campaign ON public.ai_booth_sessions (source, campaign);
CREATE INDEX IF NOT EXISTS idx_ai_booth_sessions_last_seen ON public.ai_booth_sessions (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_booth_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.ai_booth_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_booth_events_session_time ON public.ai_booth_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_booth_events_type_time ON public.ai_booth_events (event_type, created_at DESC);

ALTER TABLE public.ai_booth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_booth_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.booth_upsert_session(
  p_session_key text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_id uuid;
  v_ctx jsonb;
BEGIN
  v_key := nullif(trim(coalesce(p_session_key, '')), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'p_session_key is required';
  END IF;

  v_ctx := coalesce(p_context, '{}'::jsonb);

  INSERT INTO public.ai_booth_sessions (
    session_key,
    source,
    campaign,
    intent,
    customer_interest,
    utm,
    context,
    first_seen_at,
    last_seen_at,
    updated_at
  )
  VALUES (
    v_key,
    nullif(v_ctx->>'source', ''),
    nullif(v_ctx->>'campaign', ''),
    nullif(v_ctx->>'intent', ''),
    nullif(v_ctx->>'customer_interest', ''),
    jsonb_build_object(
      'utm_source', nullif(v_ctx->>'utm_source', ''),
      'utm_medium', nullif(v_ctx->>'utm_medium', ''),
      'utm_campaign', nullif(v_ctx->>'utm_campaign', ''),
      'utm_content', nullif(v_ctx->>'utm_content', '')
    ),
    v_ctx,
    now(),
    now(),
    now()
  )
  ON CONFLICT (session_key)
  DO UPDATE SET
    last_seen_at = now(),
    updated_at = now(),
    source = coalesce(excluded.source, public.ai_booth_sessions.source),
    campaign = coalesce(excluded.campaign, public.ai_booth_sessions.campaign),
    intent = coalesce(excluded.intent, public.ai_booth_sessions.intent),
    customer_interest = coalesce(excluded.customer_interest, public.ai_booth_sessions.customer_interest),
    utm = CASE
      WHEN excluded.utm = '{}'::jsonb THEN public.ai_booth_sessions.utm
      ELSE excluded.utm
    END,
    context = public.ai_booth_sessions.context || excluded.context
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.booth_track_event(
  p_session_key text,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_session_id uuid;
BEGIN
  v_event := nullif(trim(coalesce(p_event_type, '')), '');
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'p_event_type is required';
  END IF;

  v_session_id := public.booth_upsert_session(
    p_session_key,
    coalesce(p_payload->'context', '{}'::jsonb)
  );

  INSERT INTO public.ai_booth_events (session_id, event_type, payload)
  VALUES (v_session_id, v_event, coalesce(p_payload, '{}'::jsonb));

  UPDATE public.ai_booth_sessions
  SET last_seen_at = now(), updated_at = now()
  WHERE id = v_session_id;

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.booth_set_outcome(
  p_session_key text,
  p_outcome text,
  p_reason text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_outcome text;
BEGIN
  v_outcome := lower(trim(coalesce(p_outcome, '')));
  IF v_outcome NOT IN ('closed_won', 'closed_lost', 'follow_up', 'no_show') THEN
    RAISE EXCEPTION 'Invalid outcome: %', p_outcome;
  END IF;

  v_session_id := public.booth_upsert_session(p_session_key, '{}'::jsonb);

  UPDATE public.ai_booth_sessions
  SET
    outcome = v_outcome,
    outcome_reason = nullif(trim(coalesce(p_reason, '')), ''),
    outcome_at = now(),
    lead_id = coalesce(p_lead_id, lead_id),
    last_seen_at = now(),
    updated_at = now()
  WHERE id = v_session_id;

  INSERT INTO public.ai_booth_events (session_id, event_type, payload)
  VALUES (
    v_session_id,
    'outcome_set',
    jsonb_build_object(
      'outcome', v_outcome,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'lead_id', p_lead_id
    )
  );

  RETURN true;
END;
$$;

-- Session-level training dataset (view). Do NOT use the name ai_booth_learning_examples here —
-- that identifier is reserved for the anonymous lessons TABLE in migration 20260422103000.
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

REVOKE ALL ON FUNCTION public.booth_upsert_session(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booth_track_event(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booth_set_outcome(text, text, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.booth_upsert_session(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booth_track_event(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booth_set_outcome(text, text, text, uuid) TO authenticated;

COMMENT ON TABLE public.ai_booth_sessions IS 'AI Booth session memory for attribution + business outcomes.';
COMMENT ON TABLE public.ai_booth_events IS 'Event stream per AI Booth session (open, form_submit, errors, outcome).';
COMMENT ON VIEW public.ai_booth_session_training IS 'Session + events for training rows (won/lost/follow-up/no_show). Anonymous win/loss table is ai_booth_learning_examples (see later migration).';
