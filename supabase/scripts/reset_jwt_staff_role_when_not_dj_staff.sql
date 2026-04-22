-- ── ONE-OFF (ejecutar manualmente en SQL Editor como postgres) ─────────────────
-- Corrige fugas históricas: app_metadata.role = admin|manager|seller en JWT pero
-- public.dj_profiles.role NO es staff → fuerza role en raw_app_meta_data a 'client'.
--
-- 1) Audita primero:
-- SELECT u.id, u.email,
--        u.raw_app_meta_data->>'role' AS jwt_role,
--        d.role AS dj_role
-- FROM auth.users u
-- LEFT JOIN public.dj_profiles d ON d.user_id = u.id
-- WHERE lower(trim(coalesce(u.raw_app_meta_data->>'role', ''))) IN ('admin', 'owner', 'manager', 'seller');
--
-- 2) Opcional: excluir correos corporativos (descomenta y edita):
-- AND lower(u.email) NOT IN ('miamidjbeat@gmail.com', 'djmago305@gmail.com')

UPDATE auth.users AS u
SET raw_app_meta_data = jsonb_set(
    COALESCE(u.raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"client"'::jsonb,
    true
)
WHERE lower(trim(coalesce(u.raw_app_meta_data->>'role', ''))) IN ('admin', 'owner', 'manager', 'seller')
  AND NOT EXISTS (
    SELECT 1
    FROM public.dj_profiles AS d
    WHERE d.user_id = u.id
      AND lower(trim(coalesce(d.role, ''))) IN ('admin', 'owner', 'manager', 'seller')
  );

-- Tras ejecutar: los usuarios deben cerrar sesión y volver a entrar (nuevo JWT).
