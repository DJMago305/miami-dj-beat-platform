-- ═══════════════════════════════════════════════════════════════════════════
-- Muro de contención (Postgres): staff = public.is_staff(auth.uid()) desde
-- public.dj_profiles únicamente. HTML/JWT no sustituyen esta verificación.
--
-- 1) dj_profiles: SELECT roster para todo staff (is_staff). UPDATE de filas
--    ajenas: cualquier staff (seller incl.) para moderación; columna `role`
--    solo la puede cambiar is_staff_management (trigger en todo UPDATE).
-- 2) leads: reafirma políticas admin con is_staff() (incl. seller / owner).
-- 3) contracts / payments / billing_settings: staff según tabla existente.
-- Requiere: public.is_staff, public.is_staff_management (migraciones 30300000+).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A) dj_profiles — candado de columna `role` + políticas staff ───────────
CREATE OR REPLACE FUNCTION public.dj_profiles_role_lowercase_and_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  privileged text[] := ARRAY['admin', 'owner', 'manager', 'seller'];
  r text;
BEGIN
  IF NEW.role IS NOT NULL THEN
    NEW.role := lower(trim(NEW.role));
  END IF;

  -- Service role / SQL Editor / sin JWT de usuario final: no bloquear operaciones de plataforma
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  r := lower(trim(coalesce(NEW.role, '')));

  IF TG_OP = 'INSERT' THEN
    IF r = ANY (privileged) THEN
      NEW.role := 'dj';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF lower(trim(coalesce(NEW.role, ''))) IS DISTINCT FROM lower(trim(coalesce(OLD.role, '')))
       AND NOT public.is_staff_management(auth.uid()) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.dj_profiles_role_lowercase_and_guard() IS
  'BEFORE INSERT/UPDATE: normaliza role; INSERT self-service no crea staff; cualquier UPDATE que altere role requiere is_staff_management.';

DROP TRIGGER IF EXISTS trg_dj_profiles_role_lowercase ON public.dj_profiles;
DROP FUNCTION IF EXISTS public.dj_profiles_enforce_role_lowercase();

DROP TRIGGER IF EXISTS trg_dj_profiles_role_lowercase_and_guard ON public.dj_profiles;
CREATE TRIGGER trg_dj_profiles_role_lowercase_and_guard
  BEFORE INSERT OR UPDATE ON public.dj_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.dj_profiles_role_lowercase_and_guard();

ALTER TABLE public.dj_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dj_profiles_staff_select_all" ON public.dj_profiles;
CREATE POLICY "dj_profiles_staff_select_all"
  ON public.dj_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "dj_profiles_staff_update_others" ON public.dj_profiles;
CREATE POLICY "dj_profiles_staff_update_others"
  ON public.dj_profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND user_id IS DISTINCT FROM auth.uid()
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    AND user_id IS DISTINCT FROM auth.uid()
  );

-- ── B) leads — políticas staff alineadas con is_staff() ───────────────────
DO $$
BEGIN
  IF to_regclass('public.leads') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "leads_select_admin" ON public.leads;
  CREATE POLICY "leads_select_admin"
    ON public.leads FOR SELECT TO authenticated
    USING (public.is_staff(auth.uid()));

  DROP POLICY IF EXISTS "leads_update_admin" ON public.leads;
  CREATE POLICY "leads_update_admin"
    ON public.leads FOR UPDATE TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));
END $$;

-- ── C) contracts — staff puede leer/actualizar (además de dueños por email) ─
DO $$
BEGIN
  IF to_regclass('public.contracts') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS contracts_staff_all ON public.contracts;
  DROP POLICY IF EXISTS contracts_staff_select ON public.contracts;
  DROP POLICY IF EXISTS contracts_staff_insert ON public.contracts;
  DROP POLICY IF EXISTS contracts_staff_update ON public.contracts;

  CREATE POLICY contracts_staff_select
    ON public.contracts FOR SELECT TO authenticated
    USING (public.is_staff(auth.uid()));

  CREATE POLICY contracts_staff_insert
    ON public.contracts FOR INSERT TO authenticated
    WITH CHECK (public.is_staff(auth.uid()));

  CREATE POLICY contracts_staff_update
    ON public.contracts FOR UPDATE TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));
END $$;

-- ── D) payments — solo lectura staff (webhooks siguen con service_role) ─────
DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS payments_staff_select ON public.payments;
  CREATE POLICY payments_staff_select
    ON public.payments FOR SELECT TO authenticated
    USING (public.is_staff(auth.uid()));
END $$;

-- ── E) billing_settings — staff lectura soporte / finanzas ─────────────────
DO $$
BEGIN
  IF to_regclass('public.billing_settings') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS billing_settings_staff_select ON public.billing_settings;
  CREATE POLICY billing_settings_staff_select
    ON public.billing_settings FOR SELECT TO authenticated
    USING (public.is_staff(auth.uid()));
END $$;

NOTIFY pgrst, 'reload schema';
