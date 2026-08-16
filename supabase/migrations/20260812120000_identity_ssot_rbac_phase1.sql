-- ════════════════════════════════════════════════════════════════════════════
-- FASE 1 · Núcleo de Identidad (SSOT) + RBAC   —   Bounded Context V2
-- ════════════════════════════════════════════════════════════════════════════
-- SOLO PARA SUPABASE LOCAL / AMBIENTE DE PRUEBA.  NO ejecutar en producción.
--
-- Protocolo (autorizado):
--   • ADITIVO PURO — NO altera public.dj_profiles ni public.client_profiles.
--   • NO redefine public.is_staff() (V1). Crea el equivalente V2 en paralelo.
--   • Todo vive en el esquema dedicado `identity` → aislamiento de bounded
--     context y rollback trivial (ver supabase/scripts/…_ROLLBACK.sql).
--   • Idempotente: puede re-ejecutarse en local sin error.
--
-- Qué resuelve, estructuralmente:
--   1. SSOT      → identity.users: una fila = una identidad (PK garantiza
--                  exclusividad; un user_id NO puede ser dos cosas a la vez).
--   2. RBAC      → identity.roles vía ENUM + puente identity.user_roles.
--   3. Coherencia→ trigger: un rol imposible para el account_type se rechaza
--                  en la BD, no en el frontend.
--   4. Sin fugas → RLS activa; el frontend (authenticated) NO puede escribir
--                  identidad; solo el backend (service_role) lo hace.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 0) Esquema del bounded context ──────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS identity;
COMMENT ON SCHEMA identity IS
  'Bounded Context: Identidad & Acceso (SSOT + RBAC). Fase 1 V2. Fuente única de verdad de "quién es este usuario".';

GRANT USAGE ON SCHEMA identity TO authenticated, service_role;


-- ── 1) ENUMs (discriminador de cuenta + catálogo de roles) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'account_type' AND n.nspname = 'identity'
  ) THEN
    CREATE TYPE identity.account_type AS ENUM ('artist', 'client', 'staff');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'identity'
  ) THEN
    CREATE TYPE identity.app_role AS ENUM (
      'dj', 'performer', 'producer',     -- artista
      'client', 'venue',                 -- cliente
      'owner', 'admin', 'manager', 'seller'  -- staff
    );
  END IF;
END$$;


-- ── 2) Tabla canónica de identidad (SSOT) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS identity.users (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type identity.account_type NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE identity.users IS
  'SSOT. Una fila = una identidad. La PK (= auth.users.id) hace imposible que un usuario tenga dos account_type.';
COMMENT ON COLUMN identity.users.account_type IS
  'Discriminador garantizado por la BD: artist | client | staff.';


-- ── 3) RBAC: puente usuario ↔ roles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity.user_roles (
  user_id    uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  role       identity.app_role NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role)
);
COMMENT ON TABLE identity.user_roles IS
  'RBAC estándar (patrón Okta/Auth0). Un usuario puede portar varios roles sin sobrecargar una columna de texto.';

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON identity.user_roles(role);


-- ── 4) Coherencia rol ↔ account_type (imposibilidad estructural) ────────────
-- Qué roles son legales para cada tipo de cuenta. Inmutable → indexable/seguro.
CREATE OR REPLACE FUNCTION identity.role_allowed(
  p_account identity.account_type,
  p_role    identity.app_role
) RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_account
    WHEN 'artist' THEN p_role IN ('dj', 'performer', 'producer')
    WHEN 'client' THEN p_role IN ('client', 'venue')
    WHEN 'staff'  THEN p_role IN ('owner', 'admin', 'manager', 'seller')
  END;
$$;
COMMENT ON FUNCTION identity.role_allowed(identity.account_type, identity.app_role) IS
  'True si el rol es legal para el account_type. Usado por el trigger de coherencia.';

-- Trigger: rechaza en la BD cualquier rol incoherente (p.ej. dar 'admin' a un cliente).
CREATE OR REPLACE FUNCTION identity.enforce_role_coherence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = identity, public
AS $$
DECLARE
  v_acct identity.account_type;
BEGIN
  SELECT account_type INTO v_acct FROM identity.users WHERE id = NEW.user_id;
  IF v_acct IS NULL THEN
    RAISE EXCEPTION 'Usuario % no existe en identity.users (SSOT)', NEW.user_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT identity.role_allowed(v_acct, NEW.role) THEN
    RAISE EXCEPTION 'Rol "%" no permitido para account_type "%" (coherencia RBAC)', NEW.role, v_acct
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_user_roles_coherence ON identity.user_roles;
CREATE TRIGGER trg_user_roles_coherence
  BEFORE INSERT OR UPDATE ON identity.user_roles
  FOR EACH ROW EXECUTE FUNCTION identity.enforce_role_coherence();


-- ── 5) Funciones de acceso (contrato único; SECURITY DEFINER para uso en RLS) ─
-- Nota: SECURITY DEFINER evita recursión de RLS cuando se llaman dentro de policies.
CREATE OR REPLACE FUNCTION identity.account_type_of(p_uid uuid)
RETURNS identity.account_type
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = identity, public
AS $$ SELECT account_type FROM identity.users WHERE id = p_uid; $$;

CREATE OR REPLACE FUNCTION identity.has_role(p_uid uuid, p_role identity.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = identity, public
AS $$ SELECT EXISTS (SELECT 1 FROM identity.user_roles WHERE user_id = p_uid AND role = p_role); $$;

-- Equivalente V2 de is_staff — NO reemplaza a public.is_staff() (V1) todavía.
CREATE OR REPLACE FUNCTION identity.is_staff(p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = identity, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identity.user_roles
    WHERE user_id = p_uid AND role IN ('owner', 'admin', 'manager', 'seller')
  );
$$;
COMMENT ON FUNCTION identity.is_staff(uuid) IS
  'V2: staff = tiene rol owner/admin/manager/seller en user_roles (RBAC). Coexiste con public.is_staff() de V1 hasta la migración de RLS.';

GRANT EXECUTE ON FUNCTION identity.account_type_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION identity.has_role(uuid, identity.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION identity.is_staff(uuid) TO authenticated, service_role;


-- ── 6) RLS: el frontend NO escribe identidad; solo lee lo suyo ───────────────
ALTER TABLE identity.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.user_roles ENABLE ROW LEVEL SECURITY;

-- SELECT: el usuario ve su propia identidad; el staff ve todo.
DROP POLICY IF EXISTS users_select_self ON identity.users;
CREATE POLICY users_select_self ON identity.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR identity.is_staff(auth.uid()));

DROP POLICY IF EXISTS user_roles_select_self ON identity.user_roles;
CREATE POLICY user_roles_select_self ON identity.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR identity.is_staff(auth.uid()));

-- ESCRITURA: intencionalmente SIN políticas para `authenticated`.
--   → deny-by-default: el frontend no puede INSERT/UPDATE/DELETE identidad.
--   → solo `service_role` (backend/BFF) escribe; service_role bypassa RLS.
--   Esto convierte "el frontend no debería escribir identidad" en imposible.

GRANT SELECT ON identity.users, identity.user_roles TO authenticated;
GRANT ALL    ON identity.users, identity.user_roles TO service_role;


-- ── 7) Función de verificación de seguridad (ENTREGABLE) ─────────────────────
-- Ejecutar en local:  SELECT * FROM identity.verify_phase1();
-- Devuelve una fila por invariante, con PASS/FAIL, para auditar la postura.
CREATE OR REPLACE FUNCTION identity.verify_phase1()
RETURNS TABLE (check_name text, status text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = identity, public
AS $$
BEGIN
  -- (a) RLS activa en ambas tablas
  RETURN QUERY SELECT 'rls_users_enabled',
    CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'identity.users'::regclass)
         THEN 'PASS' ELSE 'FAIL' END,
    'RLS activa en identity.users';

  RETURN QUERY SELECT 'rls_user_roles_enabled',
    CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'identity.user_roles'::regclass)
         THEN 'PASS' ELSE 'FAIL' END,
    'RLS activa en identity.user_roles';

  -- (b) El frontend (authenticated) NO puede escribir identidad
  RETURN QUERY SELECT 'no_authenticated_write',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'identity' AND tablename IN ('users', 'user_roles')
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND 'authenticated' = ANY(roles)
    ) THEN 'PASS' ELSE 'FAIL' END,
    'authenticated no tiene política de escritura (deny-by-default)';

  -- (c) Trigger de coherencia rol↔account_type presente
  RETURN QUERY SELECT 'role_coherence_trigger',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_roles_coherence')
         THEN 'PASS' ELSE 'FAIL' END,
    'Trigger que rechaza roles imposibles para el account_type';

  -- (d) Ningún rol existente contradice su account_type
  RETURN QUERY SELECT 'all_roles_coherent',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM identity.user_roles ur
      JOIN identity.users u ON u.id = ur.user_id
      WHERE NOT identity.role_allowed(u.account_type, ur.role)
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Todos los user_roles son coherentes con su account_type';

  -- (e) SSOT: exclusividad garantizada por PK (informativo)
  RETURN QUERY SELECT 'ssot_unique_identity', 'PASS',
    'La PK identity.users(id) garantiza 1 identidad (1 account_type) por usuario';
END$$;
COMMENT ON FUNCTION identity.verify_phase1() IS
  'Auto-chequeo de seguridad de la Fase 1. SELECT * FROM identity.verify_phase1();';

GRANT EXECUTE ON FUNCTION identity.verify_phase1() TO service_role;


-- ── 8) Vista de reconciliación (SOLO-LECTURA, planificación de Fase 2) ───────
-- Reporta el estado ACTUAL del legado sin modificar nada. Útil para dimensionar
-- el backfill y detectar los solapamientos que hoy existen (dj_profiles ∩ client_profiles).
CREATE OR REPLACE VIEW identity.v_legacy_reconciliation AS
SELECT
  COALESCE(d.user_id, c.user_id)                          AS user_id,
  (d.user_id IS NOT NULL)                                 AS in_dj_profiles,
  (c.user_id IS NOT NULL)                                 AS in_client_profiles,
  CASE
    WHEN d.user_id IS NOT NULL AND c.user_id IS NOT NULL
      THEN 'CONFLICT: en ambas tablas'
    WHEN lower(trim(coalesce(d.role, ''))) IN ('owner', 'admin', 'manager', 'seller')
      THEN 'staff (candidato)'
    WHEN d.user_id IS NOT NULL
      THEN 'artist (candidato)'
    WHEN c.user_id IS NOT NULL
      THEN 'client (candidato)'
  END                                                     AS proposed_account_type
FROM public.dj_profiles d
FULL OUTER JOIN public.client_profiles c ON c.user_id = d.user_id
WHERE COALESCE(d.user_id, c.user_id) IS NOT NULL;

COMMENT ON VIEW identity.v_legacy_reconciliation IS
  'SOLO-LECTURA. Planificación del backfill (Fase 2). No modifica dj_profiles ni client_profiles.';

GRANT SELECT ON identity.v_legacy_reconciliation TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- FIN FASE 1. Verificar en local:  SELECT * FROM identity.verify_phase1();
-- ════════════════════════════════════════════════════════════════════════════
