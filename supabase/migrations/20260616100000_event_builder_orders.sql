-- EVENT BUILDER ORDERS TABLE
-- Persists Event Builder cart snapshots as named orders.
-- draft_id is the shared key between client cart (localStorage) and staff view.
-- Linked to leads.id for full CRM context.

CREATE TABLE IF NOT EXISTS public.event_builder_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        TEXT NOT NULL UNIQUE,          -- ORDEN # identifier (client ↔ staff)
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  event_name      TEXT,
  event_date      DATE,
  lines           JSONB NOT NULL DEFAULT '[]',   -- snapshot of state.lines with line_status
  order_status    TEXT NOT NULL DEFAULT 'pending',  -- pending / in_review / confirmed / cancelled
  staff_notes     TEXT,
  -- Financials
  subtotal_usd    NUMERIC(10,2),
  tax_usd         NUMERIC(10,2),
  total_usd       NUMERIC(10,2),
  deposit_usd     NUMERIC(10,2),                 -- 30% of total
  amount_paid_usd NUMERIC(10,2) DEFAULT 0,
  payment_status  TEXT DEFAULT 'unpaid',         -- unpaid / deposit_paid / paid_full
  stripe_pi_id    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.ebo_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ebo_updated_at_trigger ON public.event_builder_orders;
CREATE TRIGGER ebo_updated_at_trigger
  BEFORE UPDATE ON public.event_builder_orders
  FOR EACH ROW EXECUTE FUNCTION public.ebo_set_updated_at();

-- Staff enriched view (joins client data)
DROP VIEW IF EXISTS public.event_builder_orders_staff CASCADE;
CREATE VIEW public.event_builder_orders_staff
WITH (security_invoker = false)
AS
SELECT
  o.*,
  o.total_usd - COALESCE(o.amount_paid_usd, 0) AS balance_usd,
  cp.full_name   AS client_name,
  cp.phone       AS client_phone,
  cp.city        AS client_city,
  u.email        AS client_email
FROM public.event_builder_orders o
LEFT JOIN public.client_profiles cp ON cp.user_id = o.user_id
LEFT JOIN auth.users u ON u.id = o.user_id;

-- RLS
ALTER TABLE public.event_builder_orders ENABLE ROW LEVEL SECURITY;

-- Owner can read/write their own orders
DROP POLICY IF EXISTS "ebo_owner_rw" ON public.event_builder_orders;
CREATE POLICY "ebo_owner_rw"
  ON public.event_builder_orders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Staff (is_staff) can read all orders
DROP POLICY IF EXISTS "ebo_staff_read" ON public.event_builder_orders;
CREATE POLICY "ebo_staff_read"
  ON public.event_builder_orders
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Staff management can update any order (status, staff_notes, payment)
DROP POLICY IF EXISTS "ebo_staff_mgmt_update" ON public.event_builder_orders;
CREATE POLICY "ebo_staff_mgmt_update"
  ON public.event_builder_orders
  FOR UPDATE
  TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

GRANT SELECT ON public.event_builder_orders_staff TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.event_builder_orders TO authenticated;

NOTIFY pgrst, 'reload schema';
