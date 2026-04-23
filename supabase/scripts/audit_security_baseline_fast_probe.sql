-- ═══════════════════════════════════════════════════════════════════════════
-- Fast probe: una fila. No sustituye a audit_security_baseline.sql
--   (informe unificado, clasifica OK-INTERNAL, etc.); útil en CI/cron.
--
-- Fallo: `n_fast_total` > 0  (estricto: exige `n_open_predicate_anon = 0` o según criterio).
-- Pareja con: identity_audit_contradictions.sql (identidad) + audit_security_baseline.sql (autorización).
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  t.n_public_tables_rls_off,
  t.n_open_predicate_anon,
  t.n_open_predicate_authenticated,
  t.n_routines_execute_public,
  t.n_public_tables_rls_off
  + t.n_open_predicate_anon
  + t.n_open_predicate_authenticated
  + t.n_routines_execute_public
    AS n_fast_total
FROM (
  SELECT
    (SELECT count(*)::bigint
     FROM pg_class c
     JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity = false) AS n_public_tables_rls_off,

    (SELECT count(*)::bigint
     FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND (btrim(COALESCE(p.qual, '')) IN ('true', '(true)')
         OR btrim(COALESCE(p.with_check, '')) IN ('true', '(true)'))
       AND 'anon' = ANY (COALESCE(p.roles, ARRAY[]::name[]))) AS n_open_predicate_anon,

    (SELECT count(*)::bigint
     FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND (btrim(COALESCE(p.qual, '')) IN ('true', '(true)')
         OR btrim(COALESCE(p.with_check, '')) IN ('true', '(true)'))
       AND 'authenticated' = ANY (COALESCE(p.roles, ARRAY[]::name[]))
       AND NOT ('anon' = ANY (COALESCE(p.roles, ARRAY[]::name[])))) AS n_open_predicate_authenticated,
    /* policies abiertas a sesión sin "anon" en el mismo array (quien tiene anon cuenta arriba) */

    (SELECT count(*)::bigint
     FROM information_schema.routine_privileges r
     WHERE r.routine_schema = 'public'
       AND r.privilege_type = 'EXECUTE'
       AND r.grantee = 'PUBLIC') AS n_routines_execute_public
) t
;
