-- DATA-SHIELD: si existe tabla public.contracts en producción, RLS por propietario (email o user_id).
-- Si la tabla no existe, este archivo no hace cambios de esquema.
-- leads + payments: ver migraciones 20260415160000 y 20260415170000.

DO $$
DECLARE pol text;
  has_email boolean;
  has_client_email boolean;
  has_user_id boolean;
  has_client_uid boolean;
BEGIN
  IF to_regclass('public.contracts') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'email'
  ) INTO has_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'client_email'
  ) INTO has_client_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'user_id'
  ) INTO has_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'client_user_id'
  ) INTO has_client_uid;

  IF NOT has_email AND NOT has_client_email AND NOT has_user_id AND NOT has_client_uid THEN
    RETURN;
  END IF;

  ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contracts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contracts', pol);
  END LOOP;

  IF has_user_id THEN
    EXECUTE $p$
      CREATE POLICY "contracts_select_own_user_id"
        ON public.contracts FOR SELECT TO authenticated
        USING (user_id IS NOT NULL AND user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "contracts_update_own_user_id"
        ON public.contracts FOR UPDATE TO authenticated
        USING (user_id IS NOT NULL AND user_id = auth.uid())
        WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid())
    $p$;
  END IF;

  IF has_client_uid THEN
    EXECUTE $p$
      CREATE POLICY "contracts_select_own_client_user_id"
        ON public.contracts FOR SELECT TO authenticated
        USING (client_user_id IS NOT NULL AND client_user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "contracts_update_own_client_user_id"
        ON public.contracts FOR UPDATE TO authenticated
        USING (client_user_id IS NOT NULL AND client_user_id = auth.uid())
        WITH CHECK (client_user_id IS NOT NULL AND client_user_id = auth.uid())
    $p$;
  END IF;

  IF has_email THEN
    EXECUTE $p$
      CREATE POLICY "contracts_select_own_email"
        ON public.contracts FOR SELECT TO authenticated
        USING (
          lower(trim(coalesce(email, ''))) <> ''
          AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "contracts_update_own_email"
        ON public.contracts FOR UPDATE TO authenticated
        USING (
          lower(trim(coalesce(email, ''))) <> ''
          AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
        WITH CHECK (
          lower(trim(coalesce(email, ''))) <> ''
          AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
    $p$;
  END IF;

  IF has_client_email THEN
    EXECUTE $p$
      CREATE POLICY "contracts_select_own_client_email"
        ON public.contracts FOR SELECT TO authenticated
        USING (
          lower(trim(coalesce(client_email, ''))) <> ''
          AND lower(trim(client_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "contracts_update_own_client_email"
        ON public.contracts FOR UPDATE TO authenticated
        USING (
          lower(trim(coalesce(client_email, ''))) <> ''
          AND lower(trim(client_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
        WITH CHECK (
          lower(trim(coalesce(client_email, ''))) <> ''
          AND lower(trim(client_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
    $p$;
  END IF;

  -- Formularios internos / staff: ajustar según producto si hace falta INSERT anon
END $$;

-- payments: políticas UPDATE para el mismo dueño que SELECT (inserts siguen vía service_role / webhook)
DO $$
DECLARE has_uid boolean;
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

  IF has_uid THEN
    DROP POLICY IF EXISTS "payments_update_own_user_id" ON public.payments;
    EXECUTE $p$
      CREATE POLICY "payments_update_own_user_id"
        ON public.payments FOR UPDATE TO authenticated
        USING (user_id IS NOT NULL AND user_id = auth.uid())
        WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid())
    $p$;
  END IF;

  IF has_cemail THEN
    DROP POLICY IF EXISTS "payments_update_own_customer_email" ON public.payments;
    EXECUTE $p$
      CREATE POLICY "payments_update_own_customer_email"
        ON public.payments FOR UPDATE TO authenticated
        USING (
          lower(trim(coalesce(customer_email, ''))) <> ''
          AND lower(trim(customer_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
        WITH CHECK (
          lower(trim(coalesce(customer_email, ''))) <> ''
          AND lower(trim(customer_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
    $p$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
