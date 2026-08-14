-- ═══════════════════════════════════════════════════════════════════
-- Fase 1 — RLS / confidencialidad de las 13 tablas financial_ (STAFF-ONLY)
--
-- El dominio financiero canónico (financial_*) es OWNER/CORPORATIVO. El artista
-- NUNCA lo consulta directo (su vista es dj_ledger + residency_schedule_secure,
-- ya existentes/separadas). Aquí: solo staff (owner/manager/vendedor, via
-- public.is_staff) lee/escribe estas tablas; anon revocado; service_role (edge
-- functions) conserva su bypass normal.
--
-- SEGURO PARA PRUEBA Y PRODUCCIÓN: el stub de is_staff SOLO se crea si la función
-- no existe (en prod ya existe la real — NO se toca). Correr primero en PRUEBA
-- (mdjb-ensayo); en producción requiere gate explícito del PO.
-- ═══════════════════════════════════════════════════════════════════

-- 1) is_staff — en PRODUCCIÓN ya existe la real (admin/owner/manager/vendedor).
--    En PRUEBA no existe -> stub mínimo (un uuid de "staff de prueba") para verificar.
DO $do$
BEGIN
  IF to_regprocedure('public.is_staff(uuid)') IS NULL THEN
    EXECUTE $q$
      CREATE FUNCTION public.is_staff(uid uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $body$
        SELECT uid = '00000000-0000-0000-0000-000000000001'::uuid
      $body$
    $q$;
  END IF;
END
$do$;

-- 2) RLS staff-only en las 13 tablas
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
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_only', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated ' ||
      'USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))',
      t || '_staff_only', t);
  END LOOP;
END
$do$;

-- 3) VERIFICACIÓN — debe devolver 13 filas: rls_activo = true, politicas = 1
SELECT
  c.relname        AS tabla,
  c.relrowsecurity AS rls_activo,
  (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'financial_%' AND c.relkind = 'r'
ORDER BY c.relname;
