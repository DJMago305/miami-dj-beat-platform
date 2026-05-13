-- ═══════════════════════════════════════════════════════════════════════════
-- MDJ — event_notes: verificación estructural + protocolo RLS (post-migración)
--
-- Migración: supabase/migrations/20260513120000_event_notes_operational_inbox.sql
-- Aplicar migración ANTES de las pruebas funcionales (5 escenarios).
--
-- Parte 1 (este bloque): ejecutar en SQL Editor como postgres / service context.
-- Parte 2: pruebas con JWT real (management, DJ A, DJ B) vía app o REST — no impersonan auth.uid() en SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Resumen estructural (una sola tabla) ─────────────────────────────────
WITH
  tbl AS (
    SELECT to_regclass('public.event_notes') IS NOT NULL AS ok
  ),
  rls AS (
    SELECT COALESCE(c.relrowsecurity, false) AS ok
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'event_notes'
  ),
  pol AS (
    SELECT COUNT(*)::int AS cnt
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_notes'
  ),
  trg AS (
    SELECT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'event_notes'
        AND NOT t.tgisinternal
        AND t.tgname = 'trg_event_notes_enforce_dj_update_scope'
    ) AS ok
  ),
  fn AS (
    SELECT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'event_notes_enforce_dj_update_scope'
    ) AS ok
  ),
  rt AS (
    SELECT EXISTS (
      SELECT 1
      FROM pg_publication_tables pt
      WHERE pt.pubname = 'supabase_realtime'
        AND pt.schemaname = 'public'
        AND pt.tablename = 'event_notes'
    ) AS ok
  )
SELECT check_id, status, detail
FROM (
  SELECT
    1 AS ord,
    'event_notes_table' AS check_id,
    CASE WHEN (SELECT ok FROM tbl) THEN 'OK' ELSE 'FAIL' END AS status,
    'public.event_notes'::text AS detail
  UNION ALL
  SELECT
    2,
    'rls_enabled',
    CASE WHEN (SELECT ok FROM rls) THEN 'OK' ELSE 'FAIL' END,
    CASE WHEN (SELECT ok FROM rls) THEN 'ROW LEVEL SECURITY activo' ELSE 'RLS desactivado' END
  UNION ALL
  SELECT
    3,
    'policies_count',
    CASE WHEN (SELECT cnt FROM pol) = 5 THEN 'OK' ELSE 'FAIL' END,
    (SELECT cnt::text FROM pol) || ' políticas — ' || COALESCE((
      SELECT string_agg(policyname, ', ' ORDER BY policyname)
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'event_notes'
    ), '(ninguna)') || ' (esperado: 5 canónicas)'
  UNION ALL
  SELECT
    4,
    'trigger_exists',
    CASE WHEN (SELECT ok FROM trg) THEN 'OK' ELSE 'FAIL' END,
    'trg_event_notes_enforce_dj_update_scope'
  UNION ALL
  SELECT
    5,
    'function_exists',
    CASE WHEN (SELECT ok FROM fn) THEN 'OK' ELSE 'FAIL' END,
    'event_notes_enforce_dj_update_scope()'
  UNION ALL
  SELECT
    6,
    'realtime_publication',
    CASE WHEN (SELECT ok FROM rt) THEN 'OK' ELSE 'PENDING' END,
    CASE
      WHEN (SELECT ok FROM rt) THEN 'supabase_realtime incluye public.event_notes'
      ELSE 'Ejecutar: ALTER PUBLICATION supabase_realtime ADD TABLE public.event_notes;'
    END
) summary
ORDER BY ord;

-- ── 2) Detalle opcional (políticas) ─────────────────────────────────────────
-- Legacy a eliminar si policies_count > 5:
--   DROP POLICY IF EXISTS "DJs can view their own event notes" ON public.event_notes;
--   DROP POLICY IF EXISTS "DJs can update their own event notes" ON public.event_notes;
-- Repair completo: supabase/scripts/repair_event_notes_rls_policies.sql

-- ═══════════════════════════════════════════════════════════════════════════
-- PROTOCOLO MANUAL — 5 pruebas (después de apply)
-- Sustituir UUIDs de ejemplo por filas reales de tu proyecto.
--
--   :mgmt_user_id     → auth.users.id de owner/manager (is_staff_management = true)
--   :dj_a_user_id     → auth.users.id del DJ destinatario (dj_profiles.user_id)
--   :dj_b_user_id     → auth.users.id de OTRO DJ
--   :lead_or_flow_id  → leads.id o mdj_event_flows.id (Ticket B)
--
-- Todas las llamadas REST usan header:
--   Authorization: Bearer <access_token del usuario bajo prueba>
--   apikey: <SUPABASE_ANON_KEY>
--   Content-Type: application/json
-- ═══════════════════════════════════════════════════════════════════════════

/*
── TEST 1: Management INSERT ───────────────────────────────────────────────
Sesión: usuario gestión (owner/manager/admin).

POST /rest/v1/event_notes
Body:
{
  "event_id": "<lead_or_flow_id>",
  "dj_uuid": "<dj_a_user_id>",
  "type": "manager",
  "title": "RLS probe insert",
  "body": "Nota de prueba post-migración",
  "priority": "normal"
}

Esperado: HTTP 201 + fila creada.
Seller (is_staff sin gestión): HTTP 403 / policy violation.

── TEST 2: DJ correcto SELECT ────────────────────────────────────────────
Sesión: DJ A (dj_uuid de la nota).

GET /rest/v1/event_notes?event_id=eq.<lead_or_flow_id>&select=id,title,body,is_read

Esperado: HTTP 200, array con la nota (dj_uuid = auth.uid()).

── TEST 3: Otro DJ no lee ────────────────────────────────────────────────
Sesión: DJ B (distinto de dj_uuid).

GET /rest/v1/event_notes?event_id=eq.<lead_or_flow_id>&select=id

Esperado: HTTP 200, array vacío [] (RLS oculta filas ajenas).

── TEST 4: DJ marca is_read ──────────────────────────────────────────────
Sesión: DJ A.

PATCH /rest/v1/event_notes?id=eq.<note_id>
Body: { "is_read": true }

Esperado: HTTP 204/200, is_read = true.

── TEST 5: DJ no edita title/body ────────────────────────────────────────
Sesión: DJ A.

PATCH /rest/v1/event_notes?id=eq.<note_id>
Body: { "title": "Hackeado por DJ" }

Esperado: error (trigger: event_notes: DJ solo puede marcar is_read).

Gestión PATCH title/body: debe permitir (is_staff_management + trigger bypass).
*/

-- ── 4) Limpieza opcional (solo filas de prueba, service_role / SQL Editor) ─
-- DELETE FROM public.event_notes WHERE title = 'RLS probe insert';

NOTIFY pgrst, 'reload schema';
