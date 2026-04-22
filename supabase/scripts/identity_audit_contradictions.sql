-- ═══════════════════════════════════════════════════════════════════════════
-- Auditoría: identidades contradictorias (JWT vs dj_profiles)
-- Ejecutar en Supabase SQL Editor como postgres / solo lectura salvo el UPDATE
-- de limpieza en reset_jwt_staff_role_when_not_dj_staff.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- A) JWT declara staff (app_metadata.role) pero dj_profiles NO es staff
--    (riesgo: cliente/DJ con metadata de pruebas)
SELECT
  u.id,
  u.email,
  lower(trim(coalesce(u.raw_app_meta_data->>'role', ''))) AS jwt_app_role,
  lower(trim(coalesce(d.role, ''))) AS dj_profiles_role
FROM auth.users u
LEFT JOIN public.dj_profiles d ON d.user_id = u.id
WHERE lower(trim(coalesce(u.raw_app_meta_data->>'role', '')))
      IN ('admin', 'owner', 'manager', 'seller')
  AND NOT EXISTS (
    SELECT 1
    FROM public.dj_profiles d2
    WHERE d2.user_id = u.id
      AND lower(trim(coalesce(d2.role, ''))) IN ('admin', 'owner', 'manager', 'seller')
  )
ORDER BY u.email;

-- B) dj_profiles es staff pero JWT app role no coincide (informativo; redirect en web usa DB)
SELECT
  u.id,
  u.email,
  lower(trim(coalesce(u.raw_app_meta_data->>'role', ''))) AS jwt_app_role,
  lower(trim(coalesce(d.role, ''))) AS dj_profiles_role
FROM public.dj_profiles d
JOIN auth.users u ON u.id = d.user_id
WHERE lower(trim(coalesce(d.role, ''))) IN ('admin', 'owner', 'manager', 'seller')
  AND lower(trim(coalesce(u.raw_app_meta_data->>'role', ''))) IS DISTINCT FROM lower(trim(coalesce(d.role, '')))
ORDER BY u.email;

-- C) user_metadata.user_type vs dj_profiles (talento vs staff mezclado)
SELECT
  u.id,
  u.email,
  lower(trim(coalesce(u.raw_user_meta_data->>'user_type', ''))) AS jwt_user_type,
  lower(trim(coalesce(d.role, ''))) AS dj_profiles_role
FROM auth.users u
LEFT JOIN public.dj_profiles d ON d.user_id = u.id
WHERE lower(trim(coalesce(u.raw_user_meta_data->>'user_type', ''))) IN ('admin', 'owner', 'manager', 'seller')
  AND NOT EXISTS (
    SELECT 1 FROM public.dj_profiles d2
    WHERE d2.user_id = u.id
      AND lower(trim(coalesce(d2.role, ''))) IN ('admin', 'owner', 'manager', 'seller')
  )
ORDER BY u.email;

-- Limpieza sugerida para (A) y (C) mal configurados:
--   supabase/scripts/reset_jwt_staff_role_when_not_dj_staff.sql
-- Luego: signOut + login en cada cuenta afectada para renovar JWT.
