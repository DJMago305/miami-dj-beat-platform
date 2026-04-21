-- Ataque rápido (fase 2): JWT + trigger — evita MANAGER/MANAGER vs manager en Portal y RLS.
-- Requiere haber aplicado 20260430180000_staff_roles_unify_is_staff.sql (is_staff + dj_profiles UPDATE).

-- ── 1) auth.users: app_metadata.role en minúsculas (JWT que ve el cliente) ──
-- Columnas reales en Supabase: raw_app_meta_data, raw_user_meta_data (sufijo _data).
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(lower(trim(raw_app_meta_data->>'role')))
  )
WHERE raw_app_meta_data ? 'role'
  AND trim(coalesce(raw_app_meta_data->>'role', '')) <> ''
  AND lower(trim(raw_app_meta_data->>'role')) IS DISTINCT FROM raw_app_meta_data->>'role';

-- Legacy: "sales" / "SALES" en app_metadata → rol formal "seller"
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb('seller'::text)
  )
WHERE raw_app_meta_data ? 'role'
  AND lower(trim(raw_app_meta_data->>'role')) IN ('sales', 'sale');

-- user_metadata.user_type staff (menos frecuente; solo si coincide con staff)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{user_type}',
    to_jsonb(lower(trim(raw_user_meta_data->>'user_type')))
  )
WHERE raw_user_meta_data ? 'user_type'
  AND lower(trim(raw_user_meta_data->>'user_type')) IN ('admin', 'manager', 'seller', 'sales')
  AND lower(trim(raw_user_meta_data->>'user_type')) IS DISTINCT FROM raw_user_meta_data->>'user_type';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{user_type}',
    to_jsonb('seller'::text)
  )
WHERE raw_user_meta_data ? 'user_type'
  AND lower(trim(raw_user_meta_data->>'user_type')) = 'sales';

-- ── 2) Trigger: nuevas filas/updates en dj_profiles.role siempre minúsculas ──
CREATE OR REPLACE FUNCTION public.dj_profiles_enforce_role_lowercase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NOT NULL THEN
    NEW.role := lower(trim(NEW.role));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dj_profiles_role_lowercase ON public.dj_profiles;
CREATE TRIGGER trg_dj_profiles_role_lowercase
  BEFORE INSERT OR UPDATE OF role ON public.dj_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.dj_profiles_enforce_role_lowercase();

COMMENT ON FUNCTION public.dj_profiles_enforce_role_lowercase() IS
  'Fuerza dj_profiles.role en minúsculas en cada escritura; evita regresión MANAGER/manager.';

NOTIFY pgrst, 'reload schema';
