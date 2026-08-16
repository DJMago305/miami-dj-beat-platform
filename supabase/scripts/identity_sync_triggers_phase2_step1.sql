-- ════════════════════════════════════════════════════════════════════════════
-- FASE DE CONEXIÓN · PASO 1 · Triggers de sincronización (versión BEFORE)
-- ════════════════════════════════════════════════════════════════════════════
-- Cuando entra un perfil nuevo → crea su identidad canónica ANTES de insertar la
-- fila, para que el enlace FK (Fase 2c) la encuentre y no rechace el registro.
--
-- ⚠️ HALLAZGO DEL ENSAYO (2026-08-12, sandbox mdjb-ensayo):
--   La versión AFTER INSERT + FK ROMPE todos los registros nuevos:
--     ERROR 23503: ... violates foreign key constraint "fk_dj_identity"
--   Porque el FK se revisa ANTES de que un trigger AFTER cree la identidad.
--   FIX validado: usar BEFORE INSERT → la identidad se crea primero, el FK pasa.
--   Re-probado en sandbox: registro nuevo entró y su identidad se creó sola. ✅
--
-- CONSECUENCIA DE DISEÑO: con el FK activo, la identidad es OBLIGATORIA para que
--   exista un perfil. Por eso aquí NO se "traga" el error (a diferencia de la
--   idea AFTER previa): la creación de identidad es un insert trivial que forma
--   parte de la transacción del registro. Si de verdad fallara, el registro
--   falla — que es lo correcto cuando el FK exige identidad.
--
-- ORDEN DE APLICACIÓN EN PROD (manual, supervisado):
--   1) Estos triggers (BEFORE)  →  2) reconciliar huérfanos  →  3) FK (2c).
-- ════════════════════════════════════════════════════════════════════════════


-- ── dj_profiles → identity (BEFORE INSERT) ──────────────────────────────────
CREATE OR REPLACE FUNCTION identity.sync_from_dj_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = identity, public
AS $$
DECLARE v_type identity.account_type;
BEGIN
  v_type := CASE
    WHEN lower(trim(coalesce(NEW.role, ''))) IN ('owner','admin','manager','seller')
      THEN 'staff'::identity.account_type
      ELSE 'artist'::identity.account_type
  END;

  INSERT INTO identity.users (id, account_type)
  VALUES (NEW.user_id, v_type)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO identity.user_roles (user_id, role)
  VALUES (
    NEW.user_id,
    CASE WHEN v_type = 'staff'
         THEN lower(trim(NEW.role))::identity.app_role
         ELSE 'dj'::identity.app_role END
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_sync_identity_dj ON public.dj_profiles;
CREATE TRIGGER trg_sync_identity_dj
  BEFORE INSERT ON public.dj_profiles
  FOR EACH ROW EXECUTE FUNCTION identity.sync_from_dj_profile();


-- ── client_profiles → identity (BEFORE INSERT; solo si no está en dj_profiles) ─
CREATE OR REPLACE FUNCTION identity.sync_from_client_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = identity, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dj_profiles d WHERE d.user_id = NEW.user_id) THEN
    INSERT INTO identity.users (id, account_type)
    VALUES (NEW.user_id, 'client')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO identity.user_roles (user_id, role)
    VALUES (NEW.user_id, 'client')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_sync_identity_client ON public.client_profiles;
CREATE TRIGGER trg_sync_identity_client
  BEFORE INSERT ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION identity.sync_from_client_profile();


-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_sync_identity_dj     ON public.dj_profiles;
-- DROP TRIGGER IF EXISTS trg_sync_identity_client ON public.client_profiles;
-- DROP FUNCTION IF EXISTS identity.sync_from_dj_profile();
-- DROP FUNCTION IF EXISTS identity.sync_from_client_profile();
-- ════════════════════════════════════════════════════════════════════════════
