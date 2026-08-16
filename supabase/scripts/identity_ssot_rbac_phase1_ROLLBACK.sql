-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK · Fase 1 (Núcleo de Identidad SSOT + RBAC)
-- ════════════════════════════════════════════════════════════════════════════
-- SOLO LOCAL. Ejecutar MANUALMENTE (no vive en migrations/ a propósito).
-- Deshace por completo la migración 20260812120000_identity_ssot_rbac_phase1.sql.
-- No toca public.dj_profiles ni public.client_profiles (la Fase 1 nunca los alteró).
--
--   psql "$LOCAL_DB_URL" -f supabase/scripts/identity_ssot_rbac_phase1_ROLLBACK.sql
-- ════════════════════════════════════════════════════════════════════════════

DROP VIEW     IF EXISTS identity.v_legacy_reconciliation;
DROP SCHEMA   IF EXISTS identity CASCADE;   -- tablas, tipos, funciones, triggers

-- Verificación: no debe devolver filas.
SELECT n.nspname
FROM pg_namespace n
WHERE n.nspname = 'identity';
