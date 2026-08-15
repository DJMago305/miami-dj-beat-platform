-- V1: Staff offline payment recording (cash / check / wire / ach) — management only.
-- Ticket: TICKET-V1-STAFF-OFFLINE-PAYMENT-RECORD-001
-- Does NOT modify Zelle, Stripe, or dj_ledger.

DROP FUNCTION IF EXISTS public.staff_record_lead_offline_payment(uuid, numeric, text, uuid, date, text, text);

CREATE TABLE IF NOT EXISTS public.lead_offline_payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                  uuid NOT NULL REFERENCES public.leads (id) ON DELETE RESTRICT,
  amount_usd               numeric(12, 2) NOT NULL,
  payment_method           text NOT NULL,
  payment_date             date NOT NULL,
  reference_number         text NULL,
  notes                    text NULL,
  recorded_by              uuid NOT NULL REFERENCES auth.users (id),
  idempotency_key          uuid NOT NULL,
  total_amount_snapshot    numeric(12, 2) NOT NULL,
  previous_balance_paid    numeric(12, 2) NOT NULL,
  resulting_balance_paid   numeric(12, 2) NOT NULL,
  resulting_balance_due    numeric(12, 2) NOT NULL,
  resulting_payment_status text NOT NULL,
  resulting_lead_status    text NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_offline_payments_amount_positive
    CHECK (amount_usd > 0),
  CONSTRAINT lead_offline_payments_method_check
    CHECK (payment_method IN ('cash', 'check', 'wire', 'ach')),
  CONSTRAINT lead_offline_payments_idempotency_unique
    UNIQUE (idempotency_key),
  CONSTRAINT lead_offline_payments_prev_nonneg
    CHECK (previous_balance_paid >= 0),
  CONSTRAINT lead_offline_payments_result_nonneg
    CHECK (resulting_balance_paid >= 0),
  CONSTRAINT lead_offline_payments_due_nonneg
    CHECK (resulting_balance_due >= 0),
  CONSTRAINT lead_offline_payments_reference_rules
    CHECK (
      (payment_method = 'cash')
      OR (reference_number IS NOT NULL AND btrim(reference_number) <> '')
    )
);

CREATE INDEX IF NOT EXISTS idx_lead_offline_payments_lead_created
  ON public.lead_offline_payments (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_offline_payments_recorded_by
  ON public.lead_offline_payments (recorded_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_offline_payments_lead_reference
  ON public.lead_offline_payments (lead_id, reference_number)
  WHERE reference_number IS NOT NULL;

COMMENT ON TABLE public.lead_offline_payments IS
  'Append-only audit of staff-recorded offline client payments against leads (cash/check/wire/ach).';

ALTER TABLE public.lead_offline_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_offline_payments_mgmt_select ON public.lead_offline_payments;
CREATE POLICY lead_offline_payments_mgmt_select
  ON public.lead_offline_payments FOR SELECT TO authenticated
  USING (public.is_staff_management(auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.lead_offline_payments FROM authenticated;
GRANT SELECT ON public.lead_offline_payments TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_record_lead_offline_payment(
  p_lead_id uuid,
  p_amount_usd numeric,
  p_payment_method text,
  p_idempotency_key uuid,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.lead_offline_payments%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_method text;
  v_amount numeric;
  v_total numeric;
  v_prev numeric;
  v_due numeric;
  v_new_paid numeric;
  v_new_due numeric;
  v_status text;
  v_lead_status text;
  v_ref text;
  v_notes text;
  v_miami_today date;
  v_payment_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_session');
  END IF;

  IF NOT public.is_staff_management(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_idempotency_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_idempotency_key');
  END IF;

  v_method := lower(trim(coalesce(p_payment_method, '')));
  IF v_method NOT IN ('cash', 'check', 'wire', 'ach') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payment_method');
  END IF;

  v_amount := p_amount_usd;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;
  IF v_amount <> round(v_amount, 2) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount_precision');
  END IF;

  IF p_payment_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payment_date');
  END IF;

  v_miami_today := (now() AT TIME ZONE 'America/New_York')::date;
  IF p_payment_date > v_miami_today THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payment_date');
  END IF;

  IF p_reference_number IS NULL OR btrim(p_reference_number) = '' THEN
    v_ref := NULL;
  ELSE
    v_ref := btrim(p_reference_number);
    IF char_length(v_ref) > 128 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_reference_number');
    END IF;
  END IF;

  IF v_method <> 'cash' AND v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reference_required');
  END IF;

  IF p_notes IS NULL OR btrim(p_notes) = '' THEN
    v_notes := NULL;
  ELSE
    v_notes := btrim(p_notes);
    IF char_length(v_notes) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_notes');
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.lead_offline_payments
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.lead_id = p_lead_id
      AND v_existing.amount_usd = round(v_amount, 2)
      AND v_existing.payment_method = v_method
      AND v_existing.payment_date = p_payment_date
      AND coalesce(v_existing.reference_number, '') = coalesce(v_ref, '')
      AND coalesce(v_existing.notes, '') = coalesce(v_notes, '')
    THEN
      RETURN jsonb_build_object(
        'ok', true,
        'already_recorded', true,
        'payment_id', v_existing.id,
        'lead_id', v_existing.lead_id,
        'credited_usd', v_existing.amount_usd,
        'total_amount', v_existing.total_amount_snapshot,
        'balance_paid', v_existing.resulting_balance_paid,
        'balance_due', v_existing.resulting_balance_due,
        'payment_status', v_existing.resulting_payment_status,
        'lead_status', v_existing.resulting_lead_status,
        'payment_method', v_existing.payment_method,
        'payment_date', v_existing.payment_date,
        'reference_number', v_existing.reference_number,
        'notes', v_existing.notes,
        'recorded_by', v_existing.recorded_by,
        'created_at', v_existing.created_at
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found');
  END IF;

  v_total := coalesce(v_lead.total_amount, 0);
  IF v_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_lead_total');
  END IF;

  v_prev := round(coalesce(v_lead.balance_paid, 0), 2);
  v_due := round(greatest(v_total - v_prev, 0), 2);

  IF v_due <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_already_paid');
  END IF;

  IF v_amount > v_due THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'amount_exceeds_balance_due',
      'balance_due', v_due
    );
  END IF;

  v_new_paid := round(v_prev + v_amount, 2);
  v_new_due := round(greatest(v_total - v_new_paid, 0), 2);
  v_status := CASE WHEN v_new_paid >= v_total THEN 'PAID' ELSE 'PARTIAL' END;
  v_lead_status := CASE
    WHEN v_status = 'PAID' THEN 'CONFIRMED'
    WHEN coalesce(v_lead.status, '') IN ('NEW', 'OPEN') THEN 'MATCHED'
    ELSE coalesce(v_lead.status, '')
  END;

  BEGIN
    INSERT INTO public.lead_offline_payments (
      lead_id,
      amount_usd,
      payment_method,
      payment_date,
      reference_number,
      notes,
      recorded_by,
      idempotency_key,
      total_amount_snapshot,
      previous_balance_paid,
      resulting_balance_paid,
      resulting_balance_due,
      resulting_payment_status,
      resulting_lead_status
    )
    VALUES (
      p_lead_id,
      round(v_amount, 2),
      v_method,
      p_payment_date,
      v_ref,
      v_notes,
      v_uid,
      p_idempotency_key,
      round(v_total, 2),
      v_prev,
      v_new_paid,
      v_new_due,
      v_status,
      v_lead_status
    )
    RETURNING id INTO v_payment_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_existing
      FROM public.lead_offline_payments
      WHERE idempotency_key = p_idempotency_key;

      IF NOT FOUND THEN
        RAISE;
      END IF;

      IF v_existing.lead_id = p_lead_id
        AND v_existing.amount_usd = round(v_amount, 2)
        AND v_existing.payment_method = v_method
        AND v_existing.payment_date = p_payment_date
        AND coalesce(v_existing.reference_number, '') = coalesce(v_ref, '')
        AND coalesce(v_existing.notes, '') = coalesce(v_notes, '')
      THEN
        RETURN jsonb_build_object(
          'ok', true,
          'already_recorded', true,
          'payment_id', v_existing.id,
          'lead_id', v_existing.lead_id,
          'credited_usd', v_existing.amount_usd,
          'total_amount', v_existing.total_amount_snapshot,
          'balance_paid', v_existing.resulting_balance_paid,
          'balance_due', v_existing.resulting_balance_due,
          'payment_status', v_existing.resulting_payment_status,
          'lead_status', v_existing.resulting_lead_status,
          'payment_method', v_existing.payment_method,
          'payment_date', v_existing.payment_date,
          'reference_number', v_existing.reference_number,
          'notes', v_existing.notes,
          'recorded_by', v_existing.recorded_by,
          'created_at', v_existing.created_at
        );
      END IF;

      RETURN jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
  END;

  UPDATE public.leads
  SET
    balance_paid = v_new_paid,
    payment_status = v_status,
    status = v_lead_status
  WHERE id = p_lead_id;

  IF v_lead.staff_invoice_id IS NOT NULL AND v_status = 'PAID' THEN
    UPDATE public.mdj_staff_manual_invoices
    SET status = 'paid', updated_at = now()
    WHERE id = v_lead.staff_invoice_id
      AND status <> 'paid';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_recorded', false,
    'payment_id', v_payment_id,
    'lead_id', p_lead_id,
    'credited_usd', round(v_amount, 2),
    'total_amount', round(v_total, 2),
    'balance_paid', v_new_paid,
    'balance_due', v_new_due,
    'payment_status', v_status,
    'lead_status', v_lead_status,
    'payment_method', v_method,
    'payment_date', p_payment_date,
    'reference_number', v_ref,
    'notes', v_notes,
    'recorded_by', v_uid,
    'created_at', now()
  );
END;
$fn$;

COMMENT ON FUNCTION public.staff_record_lead_offline_payment(uuid, numeric, text, uuid, date, text, text) IS
  'Management staff: record offline client payment (cash/check/wire/ach) against a lead. Idempotent by idempotency_key.';

REVOKE ALL ON FUNCTION public.staff_record_lead_offline_payment(uuid, numeric, text, uuid, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_record_lead_offline_payment(uuid, numeric, text, uuid, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_record_lead_offline_payment(uuid, numeric, text, uuid, date, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
