-- R9b — assignment → artist_agenda. Idempotent per (lead_id, dj_user_id) when source=assignment.
-- Does not change leads RLS. notify-dj-assignment calls this RPC with service_role.

CREATE UNIQUE INDEX IF NOT EXISTS artist_agenda_assignment_lead_dj
  ON public.artist_agenda (lead_id, dj_user_id)
  WHERE lead_id IS NOT NULL AND source = 'assignment';

COMMENT ON INDEX public.artist_agenda_assignment_lead_dj IS
  'R9b: one assignment block per lead + artist. ELIXIS rows (source=elixis) are not constrained.';

DROP FUNCTION IF EXISTS public.artist_agenda_record_from_assignment(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.artist_agenda_record_from_assignment(
  p_dj_user_id    uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_title         text,
  p_body          text DEFAULT NULL,
  p_lead_id       uuid DEFAULT NULL,
  p_staff_user_id uuid DEFAULT NULL,
  p_agent_id      text DEFAULT 'notify-dj-assignment'
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
  v_agent  text := btrim(COALESCE(p_agent_id, 'notify-dj-assignment'));
BEGIN
  IF p_dj_user_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL
     OR p_staff_user_id IS NULL OR p_lead_id IS NULL THEN
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
    v_agent := 'notify-dj-assignment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dj_profiles WHERE user_id = p_dj_user_id) THEN
    RAISE EXCEPTION 'artist_not_found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'lead_not_found';
  END IF;

  INSERT INTO public.artist_agenda (
    dj_user_id, staff_user_id, starts_at, ends_at, title, body, lead_id, source, agent_id
  ) VALUES (
    p_dj_user_id, p_staff_user_id, p_starts_at, p_ends_at, v_title, v_body, p_lead_id, 'assignment', v_agent
  )
  ON CONFLICT (lead_id, dj_user_id) WHERE lead_id IS NOT NULL AND source = 'assignment'
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
      FROM public.artist_agenda
     WHERE lead_id = p_lead_id
       AND dj_user_id = p_dj_user_id
       AND source = 'assignment'
     LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.artist_agenda_record_from_assignment(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.artist_agenda_record_from_assignment(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.artist_agenda_record_from_assignment(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.artist_agenda_record_from_assignment(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.artist_agenda_record_from_assignment(uuid, timestamptz, timestamptz, text, text, uuid, uuid, text) IS
  'R9b: upsert one assignment block on artist_agenda. Idempotent per (lead_id, dj_user_id). EXECUTE only service_role.';

NOTIFY pgrst, 'reload schema';
