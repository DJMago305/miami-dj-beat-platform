-- R5 — first ELIXIS write tool: crear_nota_lead.
-- Isolated append-only notes. Does NOT touch public.leads RLS, leads.notes JSON, or event_notes.
-- Writes via service_role RPC only.

CREATE TABLE IF NOT EXISTS public.agent_lead_notes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid        NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  staff_user_id  uuid        NOT NULL,
  body           text        NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  agent_id       text        NOT NULL DEFAULT 'elixis' CHECK (char_length(btrim(agent_id)) BETWEEN 1 AND 64),
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_lead_notes IS
  'R5: staff notes created by an agent on an existing lead. Append-only. No client writes.';

CREATE INDEX IF NOT EXISTS idx_agent_lead_notes_lead_id
  ON public.agent_lead_notes (lead_id, created_at DESC);

ALTER TABLE public.agent_lead_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_lead_notes FROM PUBLIC;
REVOKE ALL ON TABLE public.agent_lead_notes FROM anon;
REVOKE ALL ON TABLE public.agent_lead_notes FROM authenticated;

GRANT SELECT ON TABLE public.agent_lead_notes TO authenticated;
GRANT ALL ON TABLE public.agent_lead_notes TO service_role;

DROP POLICY IF EXISTS agent_lead_notes_select_staff ON public.agent_lead_notes;
CREATE POLICY agent_lead_notes_select_staff
  ON public.agent_lead_notes
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

COMMENT ON POLICY agent_lead_notes_select_staff ON public.agent_lead_notes IS
  'Staff may read agent lead notes. No client INSERT/UPDATE/DELETE.';

DROP FUNCTION IF EXISTS public.agent_lead_note_create(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.agent_lead_note_create(
  p_lead_id       uuid,
  p_staff_user_id uuid,
  p_body          text,
  p_agent_id      text DEFAULT 'elixis'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_body text := btrim(p_body);
  v_agent text := btrim(COALESCE(p_agent_id, 'elixis'));
BEGIN
  IF p_lead_id IS NULL OR p_staff_user_id IS NULL THEN
    RAISE EXCEPTION 'lead_note_invalid_args';
  END IF;
  IF v_body = '' OR char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'lead_note_invalid_body';
  END IF;
  IF v_agent = '' THEN
    v_agent := 'elixis';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'lead_not_found';
  END IF;

  INSERT INTO public.agent_lead_notes (lead_id, staff_user_id, body, agent_id)
  VALUES (p_lead_id, p_staff_user_id, v_body, v_agent)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_lead_note_create(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_lead_note_create(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.agent_lead_note_create(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.agent_lead_note_create(uuid, uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.agent_lead_note_create(uuid, uuid, text, text) IS
  'R5: append one agent_lead_notes row. EXECUTE only service_role. Does not mutate leads columns.';

NOTIFY pgrst, 'reload schema';
