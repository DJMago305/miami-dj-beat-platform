-- ═══════════════════════════════════════════════════════════════════════════
-- MDJ — Auditoría de autorización (solo lectura), salida normalizada para informe/CI
--
-- Complementa identidad: supabase/scripts/identity_audit_contradictions.sql
--   (identidad: quién es el usuario vs perfiles) + (este script: RLS, policies, permisos)
--
-- Uso: SQL Editor de Supabase, o: psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f audit_security_baseline.sql
-- CI (rápido, conteos):  supabase/scripts/audit_security_baseline_fast_probe.sql
-- ═══════════════════════════════════════════════════════════════════════════

WITH
  no_rls AS (
    SELECT
      'no_rls'::text AS check_type,
      n.nspname     AS schema_name,
      c.relname::text AS object_name,
      NULL::text    AS sub_object_name,
      'REVIEW'::text AS risk_code,
      2            AS severity_rank, -- 0=CRITICAL, 1=HIGH, 2=REVIEW, 3=OK/INFO
      'Tabla en public con RLS desactivo (revisar si se expone por la Data API).'::text AS details
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
  ),
  open_policies AS (
    SELECT
      pol.schemaname,
      pol.tablename,
      pol.policyname,
      pol.cmd,
      pol.roles,
      pol.qual,
      pol.with_check
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND (
        btrim(COALESCE(pol.qual, '')) IN ('true', '(true)')
        OR btrim(COALESCE(pol.with_check, '')) IN ('true', '(true)')
      )
  ),
  open_policies_classified AS (
    SELECT
      'open_predicate_policy'::text AS check_type,
      p.schemaname                  AS schema_name,
      p.tablename::text             AS object_name,
      p.policyname::text            AS sub_object_name,
      CASE
        WHEN 'anon' = ANY (COALESCE(p.roles, ARRAY[]::name[]))
          THEN 'CRITICAL'::text
        WHEN 'authenticated' = ANY (COALESCE(p.roles, ARRAY[]::name[]))
          THEN 'HIGH'::text
        WHEN coalesce(p.roles, ARRAY[]::name[]) = ARRAY[]::name[]
          THEN 'REVIEW'::text
        WHEN
          COALESCE(p.roles, ARRAY[]::name[]) <@ ARRAY[
            'service_role',
            'supabase_admin',
            'supabase_service_role',
            'supabase_replication_admin',
            'dashboard_user',
            'postgres'
          ]::name[]
          AND COALESCE(p.roles, ARRAY[]::name[]) <> ARRAY[]::name[]
          AND 'authenticated' <> ANY (COALESCE(p.roles, ARRAY[]::name[]))
          AND 'anon' <> ANY (COALESCE(p.roles, ARRAY[]::name[]))
          THEN 'OK'::text
        ELSE 'REVIEW'::text
      END AS risk_code,
      CASE
        WHEN 'anon' = ANY (COALESCE(p.roles, ARRAY[]::name[]))
          THEN 0
        WHEN 'authenticated' = ANY (COALESCE(p.roles, ARRAY[]::name[]))
          THEN 1
        WHEN coalesce(p.roles, ARRAY[]::name[]) = ARRAY[]::name[] THEN 2
        WHEN
          COALESCE(p.roles, ARRAY[]::name[]) <@ ARRAY[
            'service_role',
            'supabase_admin',
            'supabase_service_role',
            'supabase_replication_admin',
            'dashboard_user',
            'postgres'
          ]::name[]
          AND COALESCE(p.roles, ARRAY[]::name[]) <> ARRAY[]::name[]
          AND 'authenticated' <> ANY (COALESCE(p.roles, ARRAY[]::name[]))
          AND 'anon' <> ANY (COALESCE(p.roles, ARRAY[]::name[]))
          THEN 3
        ELSE 2
      END AS severity_rank,
      format(
        'open predicate (using/with_check true) cmd=%s roles=%s',
        p.cmd,
        p.roles
      ) AS details
    FROM open_policies p
  ),
  security_def AS (
    SELECT
      'security_definer'::text AS check_type,
      n.nspname     AS schema_name,
      p.proname::text
      || '('
      || pg_get_function_identity_arguments(p.oid)
      || ')'     AS object_name,
      NULL::text AS sub_object_name,
      'REVIEW'::text AS risk_code,
      2          AS severity_rank,
      'SECURITY DEFINER en public: revisar EXECUTE, search_path, cuerpo y grants.'::text AS details
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  ),
  exec_public AS (
    SELECT
      'execute_public'::text AS check_type,
      r.routine_schema::text  AS schema_name,
      (r.routine_name || ' (' || r.specific_name || ')')::text AS object_name,
      NULL::text         AS sub_object_name,
      'REVIEW'::text     AS risk_code,
      2                 AS severity_rank,
      'EXECUTE concedido a PUBLIC: revisar si la rutina expone lógica sensible.'::text AS details
    FROM information_schema.routine_privileges r
    WHERE r.routine_schema = 'public'
      AND r.privilege_type = 'EXECUTE'
      AND r.grantee = 'PUBLIC'
  )
SELECT
  u.check_type,
  u.schema_name,
  u.object_name,
  u.sub_object_name,
  u.risk_code,
  u.severity_rank,
  CASE
    WHEN u.risk_code = 'CRITICAL' THEN '0-blocker'
    WHEN u.risk_code = 'HIGH'     THEN '1-urgent'
    WHEN u.risk_code = 'REVIEW'  THEN '2-review'
    WHEN u.risk_code = 'OK'     THEN '3-ok-internal'
    ELSE '4-info'
  END AS gate_bucket,
  u.fails_default_gate,
  u.details
FROM (
  SELECT
    check_type,
    schema_name,
    object_name,
    sub_object_name,
    risk_code,
    severity_rank,
    (risk_code IN ('CRITICAL', 'HIGH', 'REVIEW')) AS fails_default_gate,
    details
  FROM no_rls
  UNION ALL
  SELECT
    check_type,
    schema_name,
    object_name,
    sub_object_name,
    risk_code,
    severity_rank,
    (risk_code IN ('CRITICAL', 'HIGH', 'REVIEW')) AS fails_default_gate,
    details
  FROM open_policies_classified
  UNION ALL
  SELECT
    check_type,
    schema_name,
    object_name,
    sub_object_name,
    risk_code,
    severity_rank,
    (risk_code IN ('CRITICAL', 'HIGH', 'REVIEW')) AS fails_default_gate,
    details
  FROM security_def
  UNION ALL
  SELECT
    check_type,
    schema_name,
    object_name,
    sub_object_name,
    risk_code,
    severity_rank,
    (risk_code IN ('CRITICAL', 'HIGH', 'REVIEW')) AS fails_default_gate,
    details
  FROM exec_public
) u
ORDER BY
  u.severity_rank,
  u.check_type,
  u.object_name,
  u.sub_object_name;