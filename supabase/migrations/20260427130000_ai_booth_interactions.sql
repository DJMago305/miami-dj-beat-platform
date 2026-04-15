-- AI Booth: persistencia de interacción (Radar + resumen + outcome + lecciones).
-- Inserts vía RPC SECURITY DEFINER (anon puede cerrar sesión sin exponer service_role).

CREATE TABLE IF NOT EXISTS public.ai_booth_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  lead_id uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  session_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  chat_summary text NULL,
  outcome text NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('won', 'lost', 'pending')),
  ai_lessons text NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_booth_interactions_lead ON public.ai_booth_interactions (lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_booth_interactions_created ON public.ai_booth_interactions (created_at DESC);

COMMENT ON TABLE public.ai_booth_interactions IS 'Cierre de conversación Booth: radar en session_context, resumen negociación, outcome, reflexión IA.';
COMMENT ON COLUMN public.ai_booth_interactions.session_context IS 'JSON: intent, source, campaign (+ opcional customer_interest, utm).';
COMMENT ON COLUMN public.ai_booth_interactions.outcome IS 'won | lost | pending';
COMMENT ON COLUMN public.ai_booth_interactions.ai_lessons IS 'Texto IA: hipótesis de por qué no cerró (sin PII).';

ALTER TABLE public.ai_booth_interactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.booth_save_ai_interaction(
  p_lead_id uuid DEFAULT NULL,
  p_session_context jsonb DEFAULT '{}'::jsonb,
  p_chat_summary text DEFAULT NULL,
  p_outcome text DEFAULT 'pending',
  p_ai_lessons text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out text;
  v_new uuid;
BEGIN
  v_out := lower(trim(coalesce(p_outcome, 'pending')));
  IF v_out NOT IN ('won', 'lost', 'pending') THEN
    RAISE EXCEPTION 'Invalid outcome: %', p_outcome;
  END IF;

  INSERT INTO public.ai_booth_interactions (
    lead_id,
    session_context,
    chat_summary,
    outcome,
    ai_lessons
  )
  VALUES (
    p_lead_id,
    coalesce(p_session_context, '{}'::jsonb),
    nullif(left(trim(coalesce(p_chat_summary, '')), 12000), ''),
    v_out,
    nullif(left(trim(coalesce(p_ai_lessons, '')), 12000), '')
  )
  RETURNING id INTO v_new;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.booth_save_ai_interaction(uuid, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booth_save_ai_interaction(uuid, jsonb, text, text, text) TO anon, authenticated;
