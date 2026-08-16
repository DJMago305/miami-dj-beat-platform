-- Miami DJ Beat LLC — event_quotes (ELIXIS commercial draft quotes).
-- Append-only drafts. Totals are computed in this RPC, never trusted from the caller.
-- Does NOT write event_builder_orders, leads amounts, or client invoices.

CREATE TABLE IF NOT EXISTS public.event_quotes (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id  uuid           NOT NULL,
  lead_id        uuid           REFERENCES public.leads (id) ON DELETE SET NULL,
  event_date     date,
  event_type     text           CHECK (event_type IS NULL OR char_length(btrim(event_type)) BETWEEN 1 AND 64),
  hours          numeric(6, 2)  CHECK (hours IS NULL OR (hours >= 1 AND hours <= 16)),
  lines          jsonb          NOT NULL DEFAULT '[]'::jsonb,
  subtotal_usd   numeric(10, 2) NOT NULL,
  tax_usd        numeric(10, 2) NOT NULL,
  tax_rate       numeric(6, 4)  NOT NULL DEFAULT 0.07,
  deposit_usd    numeric(10, 2) NOT NULL,
  deposit_rate   numeric(6, 4)  NOT NULL DEFAULT 0.30,
  total_usd      numeric(10, 2) NOT NULL,
  currency       text           NOT NULL DEFAULT 'USD',
  status         text           NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  source         text           NOT NULL DEFAULT 'elixis' CHECK (char_length(btrim(source)) BETWEEN 1 AND 32),
  agent_id       text           NOT NULL DEFAULT 'elixis' CHECK (char_length(btrim(agent_id)) BETWEEN 1 AND 64),
  notes          text           CHECK (notes IS NULL OR char_length(btrim(notes)) BETWEEN 1 AND 2000),
  created_at     timestamptz    NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_quotes IS
  'Miami DJ Beat LLC: ELIXIS draft quotes. Append-only. No client writes. Totals computed by event_quote_record.';

CREATE INDEX IF NOT EXISTS idx_event_quotes_staff_created
  ON public.event_quotes (staff_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_quotes_lead
  ON public.event_quotes (lead_id)
  WHERE lead_id IS NOT NULL;

ALTER TABLE public.event_quotes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_quotes FROM PUBLIC;
REVOKE ALL ON TABLE public.event_quotes FROM anon;
REVOKE ALL ON TABLE public.event_quotes FROM authenticated;

GRANT SELECT ON TABLE public.event_quotes TO authenticated;
GRANT ALL ON TABLE public.event_quotes TO service_role;

DROP POLICY IF EXISTS event_quotes_select_staff ON public.event_quotes;
CREATE POLICY event_quotes_select_staff
  ON public.event_quotes
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

COMMENT ON POLICY event_quotes_select_staff ON public.event_quotes IS
  'Miami DJ Beat LLC staff may read event_quotes. No authenticated INSERT/UPDATE/DELETE.';

DROP FUNCTION IF EXISTS public.event_quote_record(uuid, jsonb, uuid, date, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.event_quote_record(
  p_staff_user_id uuid,
  p_lines         jsonb,
  p_lead_id       uuid DEFAULT NULL,
  p_event_date    date DEFAULT NULL,
  p_event_type    text DEFAULT NULL,
  p_hours         numeric DEFAULT NULL,
  p_notes         text DEFAULT NULL,
  p_agent_id      text DEFAULT 'elixis'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id        uuid;
  v_elem      jsonb;
  v_norm      jsonb := '[]'::jsonb;
  v_sku       text;
  v_name      text;
  v_qty       numeric;
  v_unit      numeric;
  v_line      numeric(10, 2);
  v_subtotal  numeric(10, 2) := 0;
  v_tax       numeric(10, 2);
  v_deposit   numeric(10, 2);
  v_total     numeric(10, 2);
  v_type      text := NULLIF(btrim(COALESCE(p_event_type, '')), '');
  v_notes     text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_agent     text := btrim(COALESCE(p_agent_id, 'elixis'));
  v_count     int := 0;
BEGIN
  IF p_staff_user_id IS NULL THEN
    RAISE EXCEPTION 'event_quote_invalid_args';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'event_quote_invalid_lines';
  END IF;
  IF v_type IS NOT NULL AND char_length(v_type) > 64 THEN
    RAISE EXCEPTION 'event_quote_invalid_event_type';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 2000 THEN
    RAISE EXCEPTION 'event_quote_invalid_notes';
  END IF;
  IF p_hours IS NOT NULL AND (p_hours < 1 OR p_hours > 16) THEN
    RAISE EXCEPTION 'event_quote_invalid_hours';
  END IF;
  IF v_agent = '' THEN
    v_agent := 'elixis';
  END IF;
  IF p_lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'lead_not_found';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_count := v_count + 1;
    IF v_count > 20 THEN
      RAISE EXCEPTION 'event_quote_too_many_lines';
    END IF;
    v_sku := btrim(COALESCE(v_elem->>'sku', ''));
    v_name := btrim(COALESCE(NULLIF(v_elem->>'name', ''), v_sku));
    BEGIN
      v_qty := (v_elem->>'qty')::numeric;
      v_unit := (v_elem->>'unit_usd')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'event_quote_invalid_line';
    END;
    IF v_sku = '' OR char_length(v_sku) > 64 OR v_qty IS NULL OR v_qty <= 0 OR v_qty > 99
       OR v_unit IS NULL OR v_unit < 0 OR v_unit > 99999 THEN
      RAISE EXCEPTION 'event_quote_invalid_line';
    END IF;
    v_line := ROUND(v_qty * v_unit, 2);
    v_subtotal := v_subtotal + v_line;
    v_norm := v_norm || jsonb_build_array(jsonb_build_object(
      'sku', v_sku,
      'name', v_name,
      'qty', v_qty,
      'unit_usd', v_unit,
      'line_usd', v_line,
      'bucket', COALESCE(v_elem->>'bucket', ''),
      'price_source', COALESCE(v_elem->>'price_source', 'fallback')
    ));
  END LOOP;

  IF v_count < 1 THEN
    RAISE EXCEPTION 'event_quote_empty_lines';
  END IF;

  v_tax := ROUND(v_subtotal * 0.07, 2);
  v_deposit := ROUND(v_subtotal * 0.30, 2);
  v_total := ROUND(v_subtotal + v_tax, 2);

  INSERT INTO public.event_quotes (
    staff_user_id, lead_id, event_date, event_type, hours, lines,
    subtotal_usd, tax_usd, tax_rate, deposit_usd, deposit_rate, total_usd,
    source, agent_id, notes
  ) VALUES (
    p_staff_user_id, p_lead_id, p_event_date, v_type, p_hours, v_norm,
    v_subtotal, v_tax, 0.07, v_deposit, 0.30, v_total,
    'elixis', v_agent, v_notes
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.event_quote_record(uuid, jsonb, uuid, date, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.event_quote_record(uuid, jsonb, uuid, date, text, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.event_quote_record(uuid, jsonb, uuid, date, text, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.event_quote_record(uuid, jsonb, uuid, date, text, numeric, text, text) TO service_role;

COMMENT ON FUNCTION public.event_quote_record(uuid, jsonb, uuid, date, text, numeric, text, text) IS
  'Miami DJ Beat LLC: append one event_quotes draft. Recomputes line/tax/deposit/total. EXECUTE only service_role.';

NOTIFY pgrst, 'reload schema';
