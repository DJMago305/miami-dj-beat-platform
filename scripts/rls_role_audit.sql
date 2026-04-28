-- ═══════════════════════════════════════════════════════════════════════════
-- Auditoría RLS (solo lectura): roles staff vs gestión vs DJ
-- Ejecutar en Supabase → SQL como postgres (o usuario con permiso).
-- No modifica datos.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Definición vigente de helpers (debe coincidir con migraciones)
SELECT proname, pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('is_staff', 'is_staff_management')
ORDER BY proname;

-- 2) Políticas en tablas sensibles (filtra por nombre si la lista es larga)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('dj_ledger', 'dj_profiles', 'leads', 'billing_settings')
ORDER BY tablename, policyname;

-- 3) Resumen esperado (referencia; validar en tu proyecto):
--    is_staff():          admin | owner | manager | seller  (dj_profiles)
--    is_staff_management(): admin | owner | manager (sin seller)
--    dj_ledger:  OR entre "DJs can view own ledger" (SELECT propio)
--                y políticas "Staff * dj_ledger" (staff)
--    leads:      staff vía is_staff() en leads_select/update_admin
--    seller:     NO is_staff_management → sin delete invasivo en módulos 3033*
