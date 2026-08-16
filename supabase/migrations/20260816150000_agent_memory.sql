-- R6 / IA rule 5 — persistent agent memory (key-value per agent + staff).
-- Schema only. ELIXIS is not wired to read/write this table in this PR.
-- Requires: public.is_staff(uuid), public.is_staff_management(uuid).

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       text        NOT NULL CHECK (char_length(btrim(agent_id)) BETWEEN 1 AND 64),
  staff_user_id  uuid        NOT NULL,
  mem_key        text        NOT NULL CHECK (char_length(btrim(mem_key)) BETWEEN 1 AND 128),
  mem_value      text        NOT NULL CHECK (char_length(mem_value) BETWEEN 1 AND 4000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_memory_agent_staff_key UNIQUE (agent_id, staff_user_id, mem_key)
);

COMMENT ON TABLE public.agent_memory IS
  'R6: persistent contextual memory. One value per (agent_id, staff_user_id, mem_key). Writes via service_role or agent_memory_upsert.';

CREATE INDEX IF NOT EXISTS idx_agent_memory_staff
  ON public.agent_memory (staff_user_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_memory_updated_at
  ON public.agent_memory (updated_at DESC);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_memory FROM PUBLIC;
REVOKE ALL ON TABLE public.agent_memory FROM anon;
REVOKE ALL ON TABLE public.agent_memory FROM authenticated;

GRANT SELECT ON TABLE public.agent_memory TO authenticated;
GRANT ALL ON TABLE public.agent_memory TO service_role;

DROP POLICY IF EXISTS agent_memory_select_own_staff ON public.agent_memory;
CREATE POLICY agent_memory_select_own_staff
  ON public.agent_memory
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND staff_user_id = auth.uid()
  );

COMMENT ON POLICY agent_memory_select_own_staff ON public.agent_memory IS
  'Staff may read only their own memory rows. No client INSERT/UPDATE/DELETE.';

DROP POLICY IF EXISTS agent_memory_select_management ON public.agent_memory;
CREATE POLICY agent_memory_select_management
  ON public.agent_memory
  FOR SELECT
  TO authenticated
  USING (public.is_staff_management(auth.uid()));

COMMENT ON POLICY agent_memory_select_management ON public.agent_memory IS
  'Management may read all agent_memory rows (audit). No client writes.';

DROP FUNCTION IF EXISTS public.agent_memory_upsert(text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.agent_memory_upsert(
  p_agent_id      text,
  p_staff_user_id uuid,
  p_mem_key       text,
  p_mem_value     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.agent_memory (agent_id, staff_user_id, mem_key, mem_value)
  VALUES (
    btrim(p_agent_id),
    p_staff_user_id,
    btrim(p_mem_key),
    p_mem_value
  )
  ON CONFLICT (agent_id, staff_user_id, mem_key)
  DO UPDATE SET
    mem_value  = EXCLUDED.mem_value,
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_memory_upsert(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_memory_upsert(text, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.agent_memory_upsert(text, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.agent_memory_upsert(text, uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.agent_memory_upsert(text, uuid, text, text) IS
  'R6: upsert one agent_memory row. EXECUTE granted only to service_role. Not wired to ELIXIS in this PR.';

NOTIFY pgrst, 'reload schema';
