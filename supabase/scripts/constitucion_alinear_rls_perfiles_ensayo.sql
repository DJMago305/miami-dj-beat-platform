-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo                                          ║
-- ║  NO EJECUTAR EN PRODUCCIÓN — allí estas políticas YA EXISTEN              ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  ALINEACIÓN DE RLS EN LAS TABLAS DE PERFIL                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- POR QUÉ HACE FALTA
--   Diagnóstico del 2026-08-17 en mdjb-ensayo:
--
--     dj_profiles        rls_activo=true   políticas=0   puede_select=true
--     client_profiles    rls_activo=true   políticas=0   puede_select=true
--
--   RLS activo con CERO políticas = denegar todo. El permiso de tabla estaba
--   concedido, pero ninguna fila era visible para el rol `authenticated`. Por
--   eso el control positivo de la suite de aislamiento daba 0: no era
--   aislamiento, era denegación universal.
--
--   Ensayo nunca recibió el historial de migraciones, así que estas tablas son
--   cascarones con la puerta cerrada. Producción sí tiene estas políticas.
--
-- QUÉ HACE
--   Replica las políticas de acceso PROPIO tal y como están definidas en el
--   historial del repositorio. Nada inventado; cada una lleva su origen.
--
-- QUÉ NO HACE, Y POR QUÉ
--   No replica las políticas de STAFF (`dj_profiles_staff_select_all`,
--   `client_profiles_staff_select_all`, `..._update_others`). Todas dependen de
--   `public.is_staff(uuid)`, que pertenece a otra cadena de migraciones que
--   ensayo tampoco tiene. Se añaden solas si esa función aparece algún día;
--   mientras tanto, su ausencia NO afecta a la suite de aislamiento, que mide
--   artista contra artista, no staff contra artista.

BEGIN;

-- ── dj_profiles ────────────────────────────────────────────────────────────
ALTER TABLE public.dj_profiles ENABLE ROW LEVEL SECURITY;

-- origen: 20260430170000_dj_profiles_select_own_rls.sql
DROP POLICY IF EXISTS "DJs select own dj_profiles" ON public.dj_profiles;
CREATE POLICY "DJs select own dj_profiles"
  ON public.dj_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- origen: 20260415190000_dj_profiles_insert_own_row_signup.sql
DROP POLICY IF EXISTS "DJs can insert their own profile" ON public.dj_profiles;
CREATE POLICY "DJs can insert their own profile"
  ON public.dj_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- origen: 20260412140000_dj_profiles_bio_columns_and_update_rls.sql
DROP POLICY IF EXISTS "DJs update own dj_profiles" ON public.dj_profiles;
CREATE POLICY "DJs update own dj_profiles"
  ON public.dj_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── client_profiles ────────────────────────────────────────────────────────
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- origen: 20260430230000_client_profiles_staff_crm_rls.sql
--   En producción esta política es `auth.uid() = user_id OR is_staff(auth.uid())`.
--   Aquí se replica solo la mitad propia; la mitad de staff se añade abajo si
--   is_staff() existe.
DROP POLICY IF EXISTS "client_profiles_select_own" ON public.client_profiles;
CREATE POLICY "client_profiles_select_own"
  ON public.client_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- origen: 20260428140000_client_profiles_insert_and_avatar.sql
DROP POLICY IF EXISTS "Users can insert their own client profile" ON public.client_profiles;
CREATE POLICY "Users can insert their own client profile"
  ON public.client_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- OBSERVACIÓN, NO CORRECCIÓN:
--   En el historial de producción NO existe ninguna política que permita a un
--   cliente ACTUALIZAR su propia fila. La única de UPDATE sobre client_profiles
--   es `client_profiles_staff_update_all`, con USING (is_staff(auth.uid())).
--   Es decir: sobre el papel, un cliente no puede editar su propio perfil sin
--   pasar por staff o por una función SECURITY DEFINER. Puede ser deliberado o
--   puede ser un hueco. NO se añade nada aquí: replicar producción significa
--   replicarla también donde incomoda. Queda anotado para decidirlo aparte.


-- ── políticas de staff, solo si is_staff() existe ──────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.is_staff(uuid)') IS NULL THEN
    RAISE NOTICE 'is_staff(uuid) no existe en este proyecto: se omiten las políticas de staff. No afecta a la suite de aislamiento.';
    RETURN;
  END IF;

  EXECUTE $p$
    DROP POLICY IF EXISTS "dj_profiles_staff_select_all" ON public.dj_profiles;
    CREATE POLICY "dj_profiles_staff_select_all"
      ON public.dj_profiles FOR SELECT TO authenticated
      USING (public.is_staff(auth.uid()));
  $p$;

  EXECUTE $p$
    DROP POLICY IF EXISTS "client_profiles_staff_select_all" ON public.client_profiles;
    CREATE POLICY "client_profiles_staff_select_all"
      ON public.client_profiles FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
  $p$;

  RAISE NOTICE 'Políticas de staff aplicadas.';
END $$;

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN — ejecutar después                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
--   SELECT c.relname, c.relrowsecurity AS rls_activo,
--          (SELECT count(*) FROM pg_policies p
--            WHERE p.schemaname='public' AND p.tablename=c.relname) AS politicas
--     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--    WHERE n.nspname='public'
--      AND c.relname IN ('dj_profiles','client_profiles');
--
--   ESPERADO: dj_profiles ≥ 3 políticas, client_profiles ≥ 2.
--             Antes de este script: 0 y 0.
