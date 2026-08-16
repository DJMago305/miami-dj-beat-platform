-- R10 / IA rule 7 — agent observability KPIs.
-- Counters for approval-gate allow/deny and consultar_finanzas ok/error.
-- No write tools. ELIXIS records via service_role RPC (fail-soft at the caller).
-- Requires: public.is_staff(uuid).

CREATE TABLE IF NOT EXISTS public.ai_kpi (
  agent_id            text        PRIMARY KEY CHECK (char_length(btrim(agent_id)) BETWEEN 1 AND 64),
  missions_completed  bigint      NOT NULL DEFAULT 0 CHECK (missions_completed >= 0),
  gate_allow_count    bigint      NOT NULL DEFAULT 0 CHECK (gate_allow_count >= 0),
  gate_deny_count     bigint      NOT NULL DEFAULT 0 CHECK (gate_deny_count >= 0),
  tool_error_count    bigint      NOT NULL DEFAULT 0 CHECK (tool_error_count >= 0),
  exception_rate      numeric(8,6) NOT NULL DEFAULT 0 CHECK (exception_rate >= 0 AND exception_rate <= 1),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_kpi IS
  'R10: per-agent KPI rollup. missions_completed = successful allowed tool runs; exception_rate = tool_error_count / (missions_completed + tool_error_count).';

ALTER TABLE public.ai_kpi ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_kpi FROM PUBLIC;
REVOKE ALL ON TABLE public.ai_kpi FROM anon;
REVOKE ALL ON TABLE public.ai_kpi FROM authenticated;

GRANT SELECT ON TABLE public.ai_kpi TO authenticated;
GRANT ALL ON TABLE public.ai_kpi TO service_role;

DROP POLICY IF EXISTS ai_kpi_select_staff ON public.ai_kpi;
CREATE POLICY ai_kpi_select_staff
  ON public.ai_kpi
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

COMMENT ON POLICY ai_kpi_select_staff ON public.ai_kpi IS
  'Staff may read KPI rollups. No client INSERT/UPDATE/DELETE.';

DROP FUNCTION IF EXISTS public.ai_kpi_record(text, text);

CREATE OR REPLACE FUNCTION public.ai_kpi_record(
  p_agent_id text,
  p_event    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent text := btrim(p_agent_id);
  v_event text := btrim(p_event);
  v_ok    bigint;
  v_err   bigint;
BEGIN
  IF v_agent = '' OR v_event = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.ai_kpi (agent_id)
  VALUES (v_agent)
  ON CONFLICT (agent_id) DO NOTHING;

  IF v_event = 'gate_allow' THEN
    UPDATE public.ai_kpi
       SET gate_allow_count = gate_allow_count + 1,
           updated_at = now()
     WHERE agent_id = v_agent;
  ELSIF v_event = 'gate_deny' THEN
    UPDATE public.ai_kpi
       SET gate_deny_count = gate_deny_count + 1,
           updated_at = now()
     WHERE agent_id = v_agent;
  ELSIF v_event = 'tool_ok' THEN
    UPDATE public.ai_kpi
       SET missions_completed = missions_completed + 1,
           updated_at = now()
     WHERE agent_id = v_agent;
  ELSIF v_event = 'tool_error' THEN
    UPDATE public.ai_kpi
       SET tool_error_count = tool_error_count + 1,
           updated_at = now()
     WHERE agent_id = v_agent;
  ELSE
    RETURN;
  END IF;

  SELECT missions_completed, tool_error_count
    INTO v_ok, v_err
    FROM public.ai_kpi
   WHERE agent_id = v_agent;

  UPDATE public.ai_kpi
     SET exception_rate = CASE
           WHEN (COALESCE(v_ok, 0) + COALESCE(v_err, 0)) = 0 THEN 0
           ELSE ROUND(COALESCE(v_err, 0)::numeric / (v_ok + v_err), 6)
         END,
         updated_at = now()
   WHERE agent_id = v_agent;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_kpi_record(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_kpi_record(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.ai_kpi_record(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ai_kpi_record(text, text) TO service_role;

COMMENT ON FUNCTION public.ai_kpi_record(text, text) IS
  'R10: increment ai_kpi for gate_allow|gate_deny|tool_ok|tool_error. EXECUTE only service_role.';

NOTIFY pgrst, 'reload schema';
