-- Event deposit via Zelle (manual): cliente marca envío; staff confirma y acredita balance_paid.

DROP FUNCTION IF EXISTS public.client_mark_event_zelle_sent(uuid);
DROP FUNCTION IF EXISTS public.staff_confirm_event_zelle_deposit(uuid, numeric);

CREATE OR REPLACE FUNCTION public.client_mark_event_zelle_sent(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_lead public.leads%ROWTYPE;
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_session');
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found');
  END IF;

  IF NOT (
    (v_lead.client_user_id IS NOT NULL AND v_lead.client_user_id = v_uid)
    OR (
      v_email <> ''
      AND lower(trim(coalesce(v_lead.email, ''))) = v_email
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF coalesce(v_lead.payment_status, '') = 'PAID' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_paid');
  END IF;

  UPDATE public.leads
  SET payment_status = 'PENDING_ZELLE'
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('ok', true, 'payment_status', 'PENDING_ZELLE');
END;
$fn$;

COMMENT ON FUNCTION public.client_mark_event_zelle_sent(uuid) IS
  'Cliente del lead: indica que envió depósito por Zelle; staff verifica y acredita con staff_confirm_event_zelle_deposit.';

CREATE OR REPLACE FUNCTION public.staff_confirm_event_zelle_deposit(
  p_lead_id uuid,
  p_amount_usd numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_lead public.leads%ROWTYPE;
  v_dep numeric;
  v_amount numeric;
  v_prev numeric;
  v_new_paid numeric;
  v_total numeric;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_session');
  END IF;
  IF NOT public.is_staff(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found');
  END IF;

  v_dep := coalesce(
    v_lead.deposit_required_usd,
    public.mdj_event_deposit_required_usd(v_lead.total_amount)
  );
  v_amount := coalesce(nullif(p_amount_usd, 0), v_dep);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  v_prev := coalesce(v_lead.balance_paid, 0);
  v_new_paid := v_prev + v_amount;
  v_total := coalesce(v_lead.total_amount, 0);
  v_status := CASE WHEN v_total > 0 AND v_new_paid >= v_total THEN 'PAID' ELSE 'PARTIAL' END;

  UPDATE public.leads
  SET
    balance_paid = v_new_paid,
    payment_status = v_status,
    status = CASE
      WHEN v_status = 'PAID' THEN 'CONFIRMED'
      WHEN coalesce(status, '') IN ('NEW', 'OPEN') THEN 'MATCHED'
      ELSE status
    END
  WHERE id = p_lead_id;

  IF v_lead.staff_invoice_id IS NOT NULL AND v_status = 'PAID' THEN
    UPDATE public.mdj_staff_manual_invoices
    SET status = 'paid'
    WHERE id = v_lead.staff_invoice_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_status', v_status,
    'balance_paid', v_new_paid,
    'credited_usd', v_amount
  );
END;
$fn$;

COMMENT ON FUNCTION public.staff_confirm_event_zelle_deposit(uuid, numeric) IS
  'Staff: acredita depósito Zelle manual al lead (suma a balance_paid). Monto default = deposit_required_usd.';

REVOKE ALL ON FUNCTION public.client_mark_event_zelle_sent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_mark_event_zelle_sent(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_confirm_event_zelle_deposit(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_confirm_event_zelle_deposit(uuid, numeric) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
