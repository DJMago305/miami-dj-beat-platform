-- Miami DJ Beat LLC — public read of a single event_quotes draft.
-- SECURITY DEFINER bypasses staff-only RLS. Returns only client-safe fields.
-- Does not expose staff_user_id, lead_id, hours, source, agent_id, or line internals.

DROP FUNCTION IF EXISTS public.get_public_event_quote(uuid);

CREATE OR REPLACE FUNCTION public.get_public_event_quote(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    public.event_quotes%ROWTYPE;
  v_lines  jsonb := '[]'::jsonb;
  v_elem   jsonb;
  v_ttl    interval := interval '45 days';
BEGIN
  IF p_quote_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_row
  FROM public.event_quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.created_at < (now() - v_ttl) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(COALESCE(v_row.lines, '[]'::jsonb))
  LOOP
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'name', COALESCE(v_elem->>'name', 'Servicio'),
      'qty', COALESCE((v_elem->>'qty')::numeric, 1),
      'unit_usd', COALESCE((v_elem->>'unit_usd')::numeric, 0),
      'line_usd', COALESCE((v_elem->>'line_usd')::numeric, 0)
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'event_type', v_row.event_type,
    'event_date', v_row.event_date,
    'lines', v_lines,
    'subtotal_usd', v_row.subtotal_usd,
    'tax_usd', v_row.tax_usd,
    'tax_rate', v_row.tax_rate,
    'deposit_usd', v_row.deposit_usd,
    'deposit_rate', v_row.deposit_rate,
    'total_usd', v_row.total_usd,
    'status', v_row.status,
    'notes', v_row.notes,
    'created_at', v_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_event_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_quote(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_event_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_quote(uuid) TO service_role;

COMMENT ON FUNCTION public.get_public_event_quote(uuid) IS
  'Miami DJ Beat LLC: public quote card by id. Client-safe columns only. Drafts older than 45 days return expired.';

NOTIFY pgrst, 'reload schema';
