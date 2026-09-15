-- PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Ejecutar manualmente en Supabase SQL Editor.
-- Bloqueado por el clasificador de auto-mode de Claude Code.
--
-- Cierre de la lista "🟢 descuido menor" de la auditoría de 211 advertencias
-- de seguridad. Las 6 funciones ya tienen guardas internas correctas
-- (auth.uid() + is_staff()/is_staff_management()/is_platform_owner,
-- verificado vía pg_get_functiondef) -- esto es higiene de buenas prácticas,
-- ninguna es explotable hoy. Ningún llamador legítimo usa `anon` en ninguna
-- de las 6 (grep confirmó: staff_confirm_event_zelle_deposit se usa desde
-- production-module.js; staff_hide_dj_public_review y
-- staff_list_dj_public_reviews_recent desde admin-dashboard.html y
-- staff-admin.html; mdj_assign_staff_to_lead e is_platform_owner y
-- mdj_owner_save_rental_catalog_overrides no tienen ningún call site en el
-- código -- ver nota aparte sobre estas 2 últimas, que además no tienen
-- migración en git ni en el historial de Supabase).

-- 1) is_platform_owner: sin migración registrada -- nunca se restringió el
--    grant. Helper interno sin llamadores directos en el código. Se revoca
--    por completo (queda solo para uso interno/owner).
revoke all on function public.is_platform_owner(uuid) from public, anon, authenticated;

-- 2) mdj_assign_staff_to_lead: migración 20260601120000 otorga EXECUTE solo a
--    authenticated. Live: anon también tiene EXECUTE (drift). Se mantiene
--    authenticated aunque hoy no tenga call site (feature construida, sin UI).
revoke execute on function public.mdj_assign_staff_to_lead(uuid, uuid, text) from anon;

-- 3) mdj_owner_save_rental_catalog_overrides: sin migración registrada.
--    Requiere auth.uid() (sesión real) para funcionar -- se mantiene
--    authenticated, se revoca anon y PUBLIC.
revoke all on function public.mdj_owner_save_rental_catalog_overrides(jsonb) from public, anon;

-- 4) staff_confirm_event_zelle_deposit: migración 20260513900000 otorga
--    EXECUTE a authenticated + service_role (no anon). Live: anon también
--    tiene EXECUTE (drift).
revoke execute on function public.staff_confirm_event_zelle_deposit(uuid, numeric) from anon;

-- 5) staff_hide_dj_public_review: migración 20260513800000 otorga EXECUTE
--    solo a authenticated. Live: anon también tiene EXECUTE (drift).
revoke execute on function public.staff_hide_dj_public_review(uuid) from anon;

-- 6) staff_list_dj_public_reviews_recent: migración 20260513800000 otorga
--    EXECUTE solo a authenticated. Live: anon también tiene EXECUTE (drift).
revoke execute on function public.staff_list_dj_public_reviews_recent(integer) from anon;

-- Verificación sugerida después de ejecutar:
-- select p.proname,
--   has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
--   has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
-- and p.proname in ('is_platform_owner','mdj_assign_staff_to_lead','mdj_owner_save_rental_catalog_overrides','staff_confirm_event_zelle_deposit','staff_hide_dj_public_review','staff_list_dj_public_reviews_recent');
-- Esperado: is_platform_owner -> anon_exec=false, auth_exec=false
--           las otras 5 -> anon_exec=false, auth_exec=true
