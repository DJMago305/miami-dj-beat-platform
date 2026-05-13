-- Event sales / cobro staff: columnas en leads, depósito convencional (30% min $150),
-- liberación DJ vía RPC (SECURITY DEFINER → dj_ledger), seller puede escribir producción.

-- ── 1) Columnas de cobro en leads (idempotente) ─────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS balance_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS assigned_dj_id uuid REFERENCES public.dj_profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_dj_name text,
  ADD COLUMN IF NOT EXISTS client_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dj_agreed_payout_usd numeric,
  ADD COLUMN IF NOT EXISTS deposit_required_usd numeric,
  ADD COLUMN IF NOT EXISTS staff_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS event_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_completed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dj_payout_released_at timestamptz;

COMMENT ON COLUMN public.leads.dj_agreed_payout_usd IS
  'Monto acordado al DJ (USD) fijado por staff en venta; liberado con staff_release_event_dj_payout.';
COMMENT ON COLUMN public.leads.deposit_required_usd IS
  'Depósito mínimo exigido (USD). Default: max(30% total, 150).';
COMMENT ON COLUMN public.leads.staff_invoice_id IS
  'Factura manual mdj_staff_manual_invoices vinculada a esta venta.';

-- FK staff_invoice_id (tabla ya existe en installs previos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_staff_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_staff_invoice_id_fkey
      FOREIGN KEY (staff_invoice_id)
      REFERENCES public.mdj_staff_manual_invoices (id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2) Depósito: misma regla que client-portal.js ───────────────────────────
CREATE OR REPLACE FUNCTION public.mdj_event_deposit_required_usd(p_total numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(coalesce(p_total, 0) * 0.30, 150)::numeric;
$$;

COMMENT ON FUNCTION public.mdj_event_deposit_required_usd(numeric) IS
  'Depósito de reserva: max(30% del total, $150 USD). Alineado a web/client-portal.js.';

REVOKE ALL ON FUNCTION public.mdj_event_deposit_required_usd(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_event_deposit_required_usd(numeric) TO authenticated, service_role;

-- ── 3) Liberar pago DJ al marcar evento conforme (staff, incl. seller) ─────
DROP FUNCTION IF EXISTS public.staff_release_event_dj_payout(uuid);

CREATE OR REPLACE FUNCTION public.staff_release_event_dj_payout(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_lead public.leads%ROWTYPE;
  v_dj_user uuid;
  v_payout_cents integer;
  v_dep numeric;
  v_paid numeric;
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

  IF v_lead.dj_payout_released_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'released_at', v_lead.dj_payout_released_at);
  END IF;

  IF v_lead.assigned_dj_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_assigned_dj');
  END IF;

  IF coalesce(v_lead.dj_agreed_payout_usd, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_dj_payout_set');
  END IF;

  v_dep := coalesce(
    v_lead.deposit_required_usd,
    public.mdj_event_deposit_required_usd(v_lead.total_amount)
  );
  v_paid := coalesce(v_lead.balance_paid, 0);

  IF v_paid < v_dep THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'deposit_not_received',
      'required_usd', v_dep,
      'paid_usd', v_paid
    );
  END IF;

  SELECT dj.user_id INTO v_dj_user
  FROM public.dj_profiles dj
  WHERE dj.id = v_lead.assigned_dj_id;

  IF v_dj_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dj_profile_missing');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.dj_ledger lg
    WHERE lg.dj_user_id = v_dj_user
      AND lg.event_id = p_lead_id::text
      AND lg.type = 'income'
      AND coalesce(lg.metadata->>'source', '') = 'event_sale_release'
  ) THEN
    UPDATE public.leads
    SET
      dj_payout_released_at = coalesce(dj_payout_released_at, now()),
      event_completed_at = coalesce(event_completed_at, now()),
      event_completed_by = coalesce(event_completed_by, v_uid)
    WHERE id = p_lead_id;
    RETURN jsonb_build_object('ok', true, 'already', true, 'ledger', true);
  END IF;

  v_payout_cents := greatest(0, round(v_lead.dj_agreed_payout_usd * 100)::integer);

  INSERT INTO public.dj_ledger (dj_user_id, type, amount_cents, status, event_id, metadata)
  VALUES (
    v_dj_user,
    'income',
    v_payout_cents,
    'available',
    p_lead_id::text,
    jsonb_build_object(
      'source', 'event_sale_release',
      'lead_id', p_lead_id,
      'released_by', v_uid,
      'staff_invoice_id', v_lead.staff_invoice_id
    )
  );

  UPDATE public.leads
  SET
    dj_payout_released_at = now(),
    event_completed_at = coalesce(event_completed_at, now()),
    event_completed_by = v_uid,
    status = CASE
      WHEN coalesce(status, '') IN ('NEW', 'MATCHED', 'CONFIRMED', 'OPEN') THEN 'COMPLETED'
      ELSE status
    END
  WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_cents', v_payout_cents,
    'dj_user_id', v_dj_user
  );
END;
$fn$;

COMMENT ON FUNCTION public.staff_release_event_dj_payout(uuid) IS
  'Staff (seller o gestión): tras depósito cobrado, libera dj_agreed_payout_usd al wallet (dj_ledger). Idempotente.';

REVOKE ALL ON FUNCTION public.staff_release_event_dj_payout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_release_event_dj_payout(uuid) TO authenticated, service_role;

-- ── 4) Producción: seller + gestión escriben (como 20260430220000) ──────────
DROP POLICY IF EXISTS mdj_event_flows_staff_read ON public.mdj_event_flows;
DROP POLICY IF EXISTS mdj_event_flows_mgmt_insert ON public.mdj_event_flows;
DROP POLICY IF EXISTS mdj_event_flows_mgmt_update ON public.mdj_event_flows;
DROP POLICY IF EXISTS mdj_event_flows_mgmt_delete ON public.mdj_event_flows;

DROP POLICY IF EXISTS mdj_event_flows_staff_all ON public.mdj_event_flows;
CREATE POLICY mdj_event_flows_staff_all
  ON public.mdj_event_flows FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS mdj_staff_manual_invoices_staff_read ON public.mdj_staff_manual_invoices;
DROP POLICY IF EXISTS mdj_staff_manual_invoices_mgmt_insert ON public.mdj_staff_manual_invoices;
DROP POLICY IF EXISTS mdj_staff_manual_invoices_mgmt_update ON public.mdj_staff_manual_invoices;
DROP POLICY IF EXISTS mdj_staff_manual_invoices_mgmt_delete ON public.mdj_staff_manual_invoices;

DROP POLICY IF EXISTS mdj_staff_manual_invoices_staff_all ON public.mdj_staff_manual_invoices;
CREATE POLICY mdj_staff_manual_invoices_staff_all
  ON public.mdj_staff_manual_invoices FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

NOTIFY pgrst, 'reload schema';
