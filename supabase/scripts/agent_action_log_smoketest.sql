-- Local smoke: R2 / V3 agent_action_log.
-- Does not insert rows (no service_role assumed). Read-only catalog checks.
-- Fail if any of the four n_* columns is not 1, or n_client_write_policies is not 0.

SELECT
  (SELECT count(*)::int
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'agent_action_log'
      AND c.relkind = 'r') AS n_table,
  (SELECT count(*)::int
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'agent_action_log'
      AND c.relrowsecurity) AS n_rls_on,
  (SELECT count(*)::int
     FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'agent_action_log'
      AND p.policyname = 'agent_action_log_select_staff'
      AND p.cmd = 'SELECT'
      AND p.qual ILIKE '%is_staff%') AS n_staff_select,
  (SELECT count(*)::int
     FROM pg_proc f
     JOIN pg_namespace n ON n.oid = f.pronamespace
    WHERE n.nspname = 'public'
      AND f.proname = 'agent_action_log_write') AS n_write_fn,
  (SELECT count(*)::int
     FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'agent_action_log'
      AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE')) AS n_client_write_policies;
