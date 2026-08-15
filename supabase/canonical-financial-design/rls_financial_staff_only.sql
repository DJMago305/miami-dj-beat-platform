-- ═══════════════════════════════════════════════════════════════════
-- RLS / confidencialidad de las 13 tablas financial_ (OWNER + STAFF)
--
-- El dominio financiero canónico (financial_*) es OWNER/CORPORATIVO. Solo
-- owner/admin/manager/vendedor lo leen/escriben; anon revocado; service_role
-- (el motor / edge functions) conserva su bypass. El artista NUNCA lo consulta
-- directo (su vista es dj_ledger + residency_schedule_secure, separadas).
--
-- IMPORTANTE: se usa una función propia `can_read_financial` que INCLUYE owner
-- — el `is_staff` de V1 EXCLUYE al owner, y el owner SÍ debe ver su dominio
-- financiero. Depende de public.dj_profiles (existe en producción).
--
-- Correr en PRODUCCIÓN requiere gate explícito del PO.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Acceso financiero: owner + admin + manager + vendedor (mismo criterio que el motor).
CREATE OR REPLACE FUNCTION public.can_read_financial(p_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dj_profiles d
    WHERE d.user_id = p_uid
      AND lower(trim(coalesce(d.role, ''))) IN ('owner', 'admin', 'manager', 'seller')
  );
$$;

-- 2) RLS en las 13 tablas
DO $do$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'financial_venues','financial_venue_agreements','financial_occurrences',
    'financial_performance_records','financial_venue_receivables','financial_payables',
    'financial_payments','financial_payment_allocations','financial_owner_ledger_entries',
    'financial_reconciliations','financial_domain_events','financial_domain_event_deliveries',
    'financial_command_receipts'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_fin_access', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated ' ||
      'USING (public.can_read_financial(auth.uid())) WITH CHECK (public.can_read_financial(auth.uid()))',
      t || '_fin_access', t);
  END LOOP;
END
$do$;

-- 3) VERIFICACIÓN — 13 filas: rls_activo = true, politicas = 1
SELECT
  c.relname        AS tabla,
  c.relrowsecurity AS rls_activo,
  (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'financial_%' AND c.relkind = 'r'
ORDER BY c.relname;
