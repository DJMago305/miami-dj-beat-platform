-- ════════════════════════════════════════════════════════════════════════════
-- SMOKE TEST · Fase 1 (SSOT + RBAC)   —   SOLO LOCAL
-- ════════════════════════════════════════════════════════════════════════════
-- Prueba los invariantes estructurales con datos de juguete y hace ROLLBACK al
-- final: NO deja residuos. Requiere ≥1 fila en auth.users (en local suele haberla;
-- si no, crea usuarios de prueba desde el panel local antes de correr).
--
--   psql "$LOCAL_DB_URL" -f supabase/scripts/identity_ssot_rbac_phase1_smoketest.sql
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;  -- todo dentro de una transacción que se revierte al final

DO $$
DECLARE
  v_artist uuid;
  v_client uuid;
  v_ok     boolean;
BEGIN
  -- Tomar dos auth.users reales de local para no violar la FK.
  SELECT id INTO v_artist FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_client FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;

  IF v_artist IS NULL THEN
    RAISE NOTICE 'SKIP: no hay auth.users en local. Crea usuarios de prueba y reintenta.';
    RETURN;
  END IF;

  -- 1) Alta de identidades canónicas
  INSERT INTO identity.users (id, account_type) VALUES (v_artist, 'artist')
    ON CONFLICT (id) DO UPDATE SET account_type = EXCLUDED.account_type;

  -- 2) Rol coherente → debe PASAR
  INSERT INTO identity.user_roles (user_id, role) VALUES (v_artist, 'dj')
    ON CONFLICT DO NOTHING;
  RAISE NOTICE 'OK  · rol coherente (artist→dj) aceptado';

  -- 3) Rol incoherente → debe FALLAR (dar 'admin' a un artista)
  v_ok := false;
  BEGIN
    INSERT INTO identity.user_roles (user_id, role) VALUES (v_artist, 'admin');
  EXCEPTION WHEN check_violation THEN
    v_ok := true;
  END;
  IF v_ok THEN
    RAISE NOTICE 'OK  · rol incoherente (artist→admin) RECHAZADO por la BD';
  ELSE
    RAISE EXCEPTION 'FALLO · la BD aceptó un rol imposible (coherencia rota)';
  END IF;

  -- 4) Rol para usuario inexistente en SSOT → debe FALLAR
  v_ok := false;
  BEGIN
    INSERT INTO identity.user_roles (user_id, role)
      VALUES ('00000000-0000-0000-0000-000000000000', 'dj');
  EXCEPTION WHEN foreign_key_violation THEN
    v_ok := true;
  END;
  IF v_ok THEN
    RAISE NOTICE 'OK  · rol sin identidad SSOT RECHAZADO';
  ELSE
    RAISE EXCEPTION 'FALLO · se creó un rol sin identidad canónica';
  END IF;

  RAISE NOTICE '───────────────────────────────────────────';
  RAISE NOTICE 'SMOKE TEST OK — invariantes estructurales verificados';
END$$;

-- Auto-chequeo de seguridad
SELECT * FROM identity.verify_phase1();

ROLLBACK;  -- revierte TODO: el smoke test no deja datos
