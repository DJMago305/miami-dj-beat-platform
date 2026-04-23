-- Módulo Producción: Event Flow (hojas de ruta) + facturas/cotizaciones manuales staff → visibles en portal cliente.
-- Requiere public.is_staff(uuid) (20260430180000).

-- ── Event Flow (bloques JSON + plantilla por tipo de evento) ─────────────────
CREATE TABLE IF NOT EXISTS public.mdj_event_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  client_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'custom'
    CHECK (event_type IN ('wedding', 'quinceanera', 'runway', 'live_show', 'custom')),
  title text NOT NULL DEFAULT '',
  venue text NULL,
  event_date date NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'sent', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_mdj_event_flows_client ON public.mdj_event_flows (client_user_id);
CREATE INDEX IF NOT EXISTS idx_mdj_event_flows_lead ON public.mdj_event_flows (lead_id);
CREATE INDEX IF NOT EXISTS idx_mdj_event_flows_created ON public.mdj_event_flows (created_at DESC);

COMMENT ON TABLE public.mdj_event_flows IS
  'Hoja de ruta / timeline de producción (A4). blocks = [{id, start, end, title, actions, notes}].';

ALTER TABLE public.mdj_event_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mdj_event_flows_staff_all ON public.mdj_event_flows;
CREATE POLICY mdj_event_flows_staff_all
  ON public.mdj_event_flows FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS mdj_event_flows_client_select ON public.mdj_event_flows;
CREATE POLICY mdj_event_flows_client_select
  ON public.mdj_event_flows FOR SELECT TO authenticated
  USING (client_user_id IS NOT NULL AND client_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdj_event_flows TO authenticated;

-- ── Facturas / cotizaciones manuales (staff → client_user_id para Mi Portal) ─
CREATE TABLE IF NOT EXISTS public.mdj_staff_manual_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  client_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  doc_kind text NOT NULL DEFAULT 'quote'
    CHECK (doc_kind IN ('quote', 'invoice')),
  client_label text NULL,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents integer NOT NULL DEFAULT 0,
  tax_pct numeric(8, 3) NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'void'))
);

CREATE INDEX IF NOT EXISTS idx_mdj_staff_invoices_client ON public.mdj_staff_manual_invoices (client_user_id);
CREATE INDEX IF NOT EXISTS idx_mdj_staff_invoices_lead ON public.mdj_staff_manual_invoices (lead_id);
CREATE INDEX IF NOT EXISTS idx_mdj_staff_invoices_created ON public.mdj_staff_manual_invoices (created_at DESC);

COMMENT ON TABLE public.mdj_staff_manual_invoices IS
  'Cotización/factura manual creada por staff; line_items = [{desc, qty, unit_cents}]. total_cents en USD centavos.';

ALTER TABLE public.mdj_staff_manual_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mdj_staff_manual_invoices_staff_all ON public.mdj_staff_manual_invoices;
CREATE POLICY mdj_staff_manual_invoices_staff_all
  ON public.mdj_staff_manual_invoices FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS mdj_staff_manual_invoices_client_select ON public.mdj_staff_manual_invoices;
CREATE POLICY mdj_staff_manual_invoices_client_select
  ON public.mdj_staff_manual_invoices FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdj_staff_manual_invoices TO authenticated;

NOTIFY pgrst, 'reload schema';
