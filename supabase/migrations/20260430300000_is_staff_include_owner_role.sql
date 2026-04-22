-- Rol `owner` (dueño) alineado con web/mdj-shared-header.js: mismo staff operativo que admin/manager/seller.
-- is_staff_management: dueño cuenta como gestión (con admin/manager), no vendedor.

CREATE OR REPLACE FUNCTION public.is_staff(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dj_profiles d
    WHERE d.user_id = p_uid
      AND lower(trim(coalesce(d.role, ''))) IN ('admin', 'owner', 'manager', 'seller')
  );
$$;

COMMENT ON FUNCTION public.is_staff(uuid) IS
  'Staff operativo: admin | owner (dueño) | manager | seller (dj_profiles, normalizado).';

CREATE OR REPLACE FUNCTION public.is_staff_management(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dj_profiles d
    WHERE d.user_id = p_uid
      AND lower(trim(coalesce(d.role, ''))) IN ('admin', 'owner', 'manager')
  );
$$;

COMMENT ON FUNCTION public.is_staff_management(uuid) IS
  'Gestión / dueño: admin | owner | manager en dj_profiles (sin seller). Monitoreo Booth y cierres IA.';

NOTIFY pgrst, 'reload schema';
