-- Miami DJ Beat LLC — convert event_quotes draft → event_builder_orders.
-- Deposit canonical: 30% of subtotal. Totals recomputed in this RPC.
-- EXECUTE only service_role. Does not call Stripe.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.event_quotes'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.event_quotes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.event_quotes
  ADD CONSTRAINT event_quotes_status_check
  CHECK (status IN ('draft', 'converted', 'expired', 'void'));

ALTER TABLE public.event_quotes
  ADD COLUMN IF NOT EXISTS ebo_id uuid REFERENCES public.event_builder_orders (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_quotes_ebo_id
  ON public.event_quotes (ebo_id)
  WHERE ebo_id IS NOT NULL;

COMMENT ON COLUMN public.event_quotes.ebo_id IS
  'Miami DJ Beat LLC: formal event_builder_orders row created from this quote.';

DROP FUNCTION IF EXISTS public.event_quote_convert_to_order(uuid, uuid);

CREATE OR REPLACE FUNCTION public.event_quote_convert_to_order(
  p_quote_id uuid,
  p_lead_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q          public.event_quotes%ROWTYPE;
  v_lead_user  uuid;
  v_elem       jsonb;
  v_ebo_lines  jsonb := '[]'::jsonb;
  v_qty        numeric;
  v_unit       numeric;
  v_line       numeric(10, 2);
  v_subtotal   numeric(10, 2) := 0;
  v_tax        numeric(10, 2);
  v_deposit    numeric(10, 2);
  v_total      numeric(10, 2);
  v_count      int := 0;
  v_draft_id   text;
  v_ebo_id     uuid;
  v_name       text;
BEGIN
  IF p_quote_id IS NULL OR p_lead_id IS NULL THEN
    RAISE EXCEPTION 'event_quote_convert_invalid_args';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'lead_not_found';
  END IF;

  SELECT * INTO v_q FROM public.event_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote_not_found';
  END IF;
  IF v_q.status IN ('void', 'expired') THEN
    RAISE EXCEPTION 'quote_not_convertible';
  END IF;
  IF v_q.lead_id IS NOT NULL AND v_q.lead_id <> p_lead_id THEN
    RAISE EXCEPTION 'quote_lead_mismatch';
  END IF;

  IF v_q.status = 'converted' AND v_q.ebo_id IS NOT NULL THEN
    PERFORM public.agent_action_log_write(
      'service_role',
      'event_quote_convert_to_order',
      p_quote_id::text,
      'ok:reused:' || v_q.ebo_id::text,
      'quote-checkout'
    );
    RETURN jsonb_build_object(
      'ok', true,
      'reused', true,
      'quote_id', v_q.id,
      'ebo_id', v_q.ebo_id,
      'lead_id', p_lead_id,
      'subtotal_usd', v_q.subtotal_usd,
      'tax_usd', v_q.tax_usd,
      'deposit_usd', v_q.deposit_usd,
      'total_usd', v_q.total_usd
    );
  END IF;
  IF v_q.status <> 'draft' THEN
    RAISE EXCEPTION 'quote_not_convertible';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(COALESCE(v_q.lines, '[]'::jsonb))
  LOOP
    v_count := v_count + 1;
    IF v_count > 20 THEN
      RAISE EXCEPTION 'event_quote_too_many_lines';
    END IF;
    BEGIN
      v_qty := COALESCE((v_elem->>'qty')::numeric, 0);
      v_unit := COALESCE((v_elem->>'unit_usd')::numeric, 0);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'event_quote_invalid_line';
    END;
    IF v_qty <= 0 OR v_unit < 0 THEN
      RAISE EXCEPTION 'event_quote_invalid_line';
    END IF;
    v_line := ROUND(v_qty * v_unit, 2);
    v_subtotal := v_subtotal + v_line;
    v_name := btrim(COALESCE(v_elem->>'name', 'Servicio'));
    v_ebo_lines := v_ebo_lines || jsonb_build_array(jsonb_build_object(
      'name', v_name,
      'qty', v_qty,
      'quantity', v_qty,
      'unit_price_usd', v_unit,
      'line_total_usd', v_line
    ));
  END LOOP;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'event_quote_empty_lines';
  END IF;

  v_tax := ROUND(v_subtotal * 0.07, 2);
  v_deposit := ROUND(v_subtotal * 0.30, 2);
  v_total := ROUND(v_subtotal + v_tax, 2);
  v_draft_id := 'QTE-' || substring(p_quote_id::text, 1, 8);

  SELECT client_user_id INTO v_lead_user FROM public.leads WHERE id = p_lead_id;

  INSERT INTO public.event_builder_orders (
    draft_id, user_id, lead_id, event_name, event_date, lines,
    order_status, staff_notes,
    subtotal_usd, tax_usd, total_usd, deposit_usd,
    amount_paid_usd, payment_status
  ) VALUES (
    v_draft_id, v_lead_user, p_lead_id,
    COALESCE(v_q.event_type, 'Evento'),
    v_q.event_date,
    v_ebo_lines,
    'pending',
    v_q.notes,
    v_subtotal, v_tax, v_total, v_deposit,
    0, 'unpaid'
  )
  RETURNING id INTO v_ebo_id;

  UPDATE public.event_quotes
  SET
    status = 'converted',
    lead_id = p_lead_id,
    ebo_id = v_ebo_id,
    subtotal_usd = v_subtotal,
    tax_usd = v_tax,
    tax_rate = 0.07,
    deposit_usd = v_deposit,
    deposit_rate = 0.30,
    total_usd = v_total
  WHERE id = p_quote_id;

  PERFORM public.agent_action_log_write(
    'service_role',
    'event_quote_convert_to_order',
    p_quote_id::text,
    'ok:' || v_ebo_id::text,
    'quote-checkout'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reused', false,
    'quote_id', p_quote_id,
    'ebo_id', v_ebo_id,
    'draft_id', v_draft_id,
    'lead_id', p_lead_id,
    'subtotal_usd', v_subtotal,
    'tax_usd', v_tax,
    'deposit_usd', v_deposit,
    'total_usd', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.event_quote_convert_to_order(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.event_quote_convert_to_order(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.event_quote_convert_to_order(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.event_quote_convert_to_order(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.event_quote_convert_to_order(uuid, uuid) IS
  'Miami DJ Beat LLC: convert draft quote to event_builder_orders. Deposit = 30% of subtotal. service_role only.';

NOTIFY pgrst, 'reload schema';
