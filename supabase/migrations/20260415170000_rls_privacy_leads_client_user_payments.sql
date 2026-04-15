-- Blindaje RLS — privacidad de “contratos” (datos de reserva en `leads`) y pagos.
-- Nota: no hay tabla `contracts` en el repo; el contrato operativo del cliente vive en `public.leads` (+ notas JSON) y en el portal.
-- `payments`: solo se endurece si la tabla existe (Stripe webhook usa service_role y no depende de RLS).

-- 1) Vincular lead a cuenta registrada (ej. checkout rentals tras login)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_client_user_id ON public.leads (client_user_id)
  WHERE client_user_id IS NOT NULL;

COMMENT ON COLUMN public.leads.client_user_id IS
  'auth.users del cliente cuando la reserva se creó estando logueado (rentals, portal, etc.).';

-- 2) Sustituir políticas de cliente en leads: email JWT O propiedad explícita por user_id
DROP POLICY IF EXISTS "leads_select_client_email" ON public.leads;
CREATE POLICY "leads_select_client_email"
  ON public.leads FOR SELECT TO authenticated
  USING (
    (
      coalesce(trim(email), '') <> ''
      AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
    OR (client_user_id IS NOT NULL AND client_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "leads_update_client_email" ON public.leads;
CREATE POLICY "leads_update_client_email"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    (
      coalesce(trim(email), '') <> ''
      AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
    OR (client_user_id IS NOT NULL AND client_user_id = auth.uid())
  )
  WITH CHECK (
    (
      coalesce(trim(email), '') <> ''
      AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
    OR (client_user_id IS NOT NULL AND client_user_id = auth.uid())
  );

-- 3) payments (si existe y tiene columnas de filtrado): RLS solo entonces — evita bloquear la tabla sin políticas
DO $$
DECLARE pol text;
  has_uid boolean;
  has_cemail boolean;
BEGIN
  IF to_regclass('public.payments') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'user_id'
  ) INTO has_uid;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'customer_email'
  ) INTO has_cemail;

  IF NOT has_uid AND NOT has_cemail THEN
    RETURN;
  END IF;

  ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payments', pol);
  END LOOP;

  IF has_uid THEN
    EXECUTE $p$
      CREATE POLICY "payments_select_own_user_id"
        ON public.payments FOR SELECT TO authenticated
        USING (user_id IS NOT NULL AND user_id = auth.uid())
    $p$;
  END IF;

  IF has_cemail THEN
    EXECUTE $p$
      CREATE POLICY "payments_select_own_customer_email"
        ON public.payments FOR SELECT TO authenticated
        USING (
          lower(trim(coalesce(customer_email, ''))) <> ''
          AND lower(trim(customer_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
    $p$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
