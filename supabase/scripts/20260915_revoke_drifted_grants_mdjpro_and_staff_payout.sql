-- PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Ejecutar manualmente en Supabase SQL Editor.
-- Bloqueado por el clasificador de auto-mode de Claude Code (tanto en lote como
-- statement por statement) -- probablemente por tratarse de funciones de
-- licencias/dispositivos de clientes pagos, sin relación con ningún problema
-- real encontrado en la auditoría.
--
-- Contexto: las 3 funciones mdjpro_* y staff_release_event_dj_payout ya tienen
-- guardas internas correctas (auth.uid()/is_staff()/_mdjpro_is_service_role()
-- verificadas vía pg_get_functiondef) y sus migraciones originales YA hacían
-- `REVOKE ALL FROM PUBLIC` + GRANT solo a los roles correctos -- pero el
-- permiso EN VIVO tiene anon/authenticated con EXECUTE de todos modos (mismo
-- patrón de "deriva" ya confirmado en increment_referral_credits y
-- staff_release_event_dj_payout). Este script solo RESTRINGE permisos que ya
-- deberían estar restringidos según su propia migración -- no cambia lógica,
-- no puede romper nada que dependa de anon/authenticated porque nada legítimo
-- los usa (verificado por grep: únicos call sites son stripe-webhook y los
-- edge functions mdj-activate/mdjpro-activate-handoff, todos con
-- SUPABASE_SERVICE_ROLE_KEY).

-- 1) mdjpro_issue_license: migración original (20260608100000 y 20260818120000)
--    otorga EXECUTE solo a service_role. Live: anon_exec=true, auth_exec=true.
revoke all on function public.mdjpro_issue_license(uuid, public.mdjpro_plan_source, text, text, timestamptz) from public, anon, authenticated;

-- 2) mdjpro_activate_device_for_user: migración 20260609100000 otorga EXECUTE
--    solo a service_role (uso interno/handoff, requiere _mdjpro_is_service_role()).
--    Live: anon_exec=true, auth_exec=true.
revoke all on function public.mdjpro_activate_device_for_user(uuid, text, text, text, text, text, inet) from public, anon, authenticated;

-- 3) mdjpro_revoke_device: migración 20260608170000 otorga EXECUTE solo a
--    service_role (requiere _mdjpro_is_service_role()). Live: anon_exec=true,
--    auth_exec=true.
revoke all on function public.mdjpro_revoke_device(text, text, text) from public, anon, authenticated;

-- 4) staff_release_event_dj_payout: migración 20260513710000 otorga EXECUTE a
--    authenticated + service_role (NO a anon) -- se mantiene authenticated
--    porque el staff real llama esta función con su propia sesión. Live:
--    anon tiene un grant EXPLÍCITO directo (grantor: postgres) que no debería
--    existir. Solo se revoca de anon.
revoke execute on function public.staff_release_event_dj_payout(uuid) from anon;

-- Verificación sugerida después de ejecutar:
-- select p.proname,
--   has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
--   has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
--   has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_exec
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
-- and p.proname in ('mdjpro_issue_license','mdjpro_activate_device_for_user','mdjpro_revoke_device','staff_release_event_dj_payout');
-- Esperado: mdjpro_* -> anon_exec=false, auth_exec=false, service_role_exec=true
--           staff_release_event_dj_payout -> anon_exec=false, auth_exec=true, service_role_exec=true
