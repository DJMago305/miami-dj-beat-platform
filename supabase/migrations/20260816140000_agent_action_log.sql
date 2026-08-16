-- R2 / V3 — audit trail for agent actions (Road Master Map).
-- Append-only. No write tools are wired in this PR (that is R5).
-- Requires: public.is_staff(uuid).

CREATE TABLE IF NOT EXISTS public.agent_action_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_at   timestamptz NOT NULL DEFAULT now(),
  actor       text        NOT NULL CHECK (char_length(btrim(actor)) BETWEEN 1 AND 128),
  action      text        NOT NULL CHECK (char_length(btrim(action)) BETWEEN 1 AND 128),
  target      text        CHECK (target IS NULL OR char_length(target) <= 512),
  result      text        CHECK (result IS NULL OR char_length(result) <= 2000),
  agent_id    text        CHECK (agent_id IS NULL OR char_length(btrim(agent_id)) <= 64)
);

COMMENT ON TABLE public.agent_action_log IS
  'V3/R2: actor, action, target, result, timestamp (logged_at). Append-only. Insert via service_role or agent_action_log_write.';

COMMENT ON COLUMN public.agent_action_log.logged_at IS
  'V3 timestamp. Named logged_at to avoid the reserved word timestamp.';

CREATE INDEX IF NOT EXISTS idx_agent_action_log_logged_at
  ON public.agent_action_log (logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_action_log_agent_id
  ON public.agent_action_log (agent_id, logged_at DESC);

ALTER TABLE public.agent_action_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_action_log FROM PUBLIC;
REVOKE ALL ON TABLE public.agent_action_log FROM anon;
REVOKE ALL ON TABLE public.agent_action_log FROM authenticated;

GRANT SELECT ON TABLE public.agent_action_log TO authenticated;
GRANT ALL ON TABLE public.agent_action_log TO service_role;

DROP POLICY IF EXISTS agent_action_log_select_staff ON public.agent_action_log;
CREATE POLICY agent_action_log_select_staff
  ON public.agent_action_log
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

COMMENT ON POLICY agent_action_log_select_staff ON public.agent_action_log IS
  'Staff (is_staff) may read agent actions. No client INSERT/UPDATE/DELETE policies — append-only.';

DROP FUNCTION IF EXISTS public.agent_action_log_write(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.agent_action_log_write(
  p_actor    text,
  p_action   text,
  p_target   text DEFAULT NULL,
  p_result   text DEFAULT NULL,
  p_agent_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.agent_action_log (actor, action, target, result, agent_id)
  VALUES (
    btrim(p_actor),
    btrim(p_action),
    NULLIF(btrim(COALESCE(p_target, '')), ''),
    NULLIF(btrim(COALESCE(p_result, '')), ''),
    NULLIF(btrim(COALESCE(p_agent_id, '')), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_action_log_write(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_action_log_write(text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.agent_action_log_write(text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.agent_action_log_write(text, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.agent_action_log_write(text, text, text, text, text) IS
  'R2: append one agent_action_log row. EXECUTE granted only to service_role. Not a write tool for ELIXIS (R5).';

NOTIFY pgrst, 'reload schema';
