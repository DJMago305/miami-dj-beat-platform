-- R9a / cap-artist-agenda — personal artist calendar blocks.
-- Isolated append-only. Does NOT touch leads RLS, dj_events, or notify-dj-assignment.
-- Writes via service_role RPC only.

CREATE TABLE IF NOT EXISTS public.artist_agenda (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  staff_user_id  uuid        NOT NULL,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  title          text        NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  body           text        CHECK (body IS NULL OR char_length(btrim(body)) BETWEEN 1 AND 2000),
  lead_id        uuid        REFERENCES public.leads (id) ON DELETE SET NULL,
  source         text        NOT NULL DEFAULT 'elixis' CHECK (char_length(btrim(source)) BETWEEN 1 AND 32),
  agent_id       text        NOT NULL DEFAULT 'elixis' CHECK (char_length(btrim(agent_id)) BETWEEN 1 AND 64),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_agenda_range_check CHECK (ends_at > starts_at)
);

COMMENT ON TABLE public.artist_agenda IS
  'R9a: personal calendar blocks for an artist. Append-only. No client writes. Assignment auto-write is a later ticket.';

CREATE INDEX IF NOT EXISTS idx_artist_agenda_dj_starts
  ON public.artist_agenda (dj_user_id, starts_at);

ALTER TABLE public.artist_agenda ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.artist_agenda FROM PUBLIC;
REVOKE ALL ON TABLE public.artist_agenda FROM anon;
REVOKE ALL ON TABLE public.artist_agenda FROM authenticated;

GRANT SELECT ON TABLE public.artist_agenda TO authenticated;
GRANT ALL ON TABLE public.artist_agenda TO service_role;

DROP POLICY IF EXISTS artist_agenda_select_staff ON public.artist_agenda;
CREATE POLICY artist_agenda_select_staff
  ON public.artist_agenda
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

COMMENT ON POLICY artist_agenda_select_staff ON public.artist_agenda IS
  'Staff may read all artist_agenda rows. No client INSERT/UPDATE/DELETE.';

DROP POLICY IF EXISTS artist_agenda_select_own_dj ON public.artist_agenda;
CREATE POLICY artist_agenda_select_own_dj
  ON public.artist_agenda
  FOR SELECT
  TO authenticated
  USING (dj_user_id = auth.uid());

COMMENT ON POLICY artist_agenda_select_own_dj ON public.artist_agenda IS
  'An artist may read only their own calendar blocks.';

DROP FUNCTION IF EXISTS public.artist_agenda_record(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.artist_agenda_record(
  p_dj_user_id    uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_title         text,
  p_body          text DEFAULT NULL,
  p_lead_id       uuid DEFAULT NULL,
  p_staff_user_id uuid DEFAULT NULL,
  p_agent_id      text DEFAULT 'elixis'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_title  text := btrim(p_title);
  v_body   text := NULLIF(btrim(COALESCE(p_body, '')), '');
  v_agent  text := btrim(COALESCE(p_agent_id, 'elixis'));
BEGIN
  IF p_dj_user_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL OR p_staff_user_id IS NULL THEN
    RAISE EXCEPTION 'artist_agenda_invalid_args';
  END IF;
  IF v_title = '' OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'artist_agenda_invalid_title';
  END IF;
  IF v_body IS NOT NULL AND char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'artist_agenda_invalid_body';
  END IF;
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'artist_agenda_invalid_range';
  END IF;
  IF v_agent = '' THEN
    v_agent := 'elixis';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dj_profiles WHERE user_id = p_dj_user_id) THEN
    RAISE EXCEPTION 'artist_not_found';
  END IF;
  IF p_lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'lead_not_found';
  END IF;

  INSERT INTO public.artist_agenda (
    dj_user_id, staff_user_id, starts_at, ends_at, title, body, lead_id, source, agent_id
  ) VALUES (
    p_dj_user_id, p_staff_user_id, p_starts_at, p_ends_at, v_title, v_body, p_lead_id, 'elixis', v_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.artist_agenda_record(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.artist_agenda_record(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.artist_agenda_record(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.artist_agenda_record(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.artist_agenda_record(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) IS
  'R9a: append one artist_agenda row. EXECUTE only service_role. Does not mutate leads or dj_events.';

NOTIFY pgrst, 'reload schema';
