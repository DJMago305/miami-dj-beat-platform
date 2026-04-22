-- Emergencia staff: reafirmar public.is_staff(uuid) ESTRICTO (solo admin | manager | seller en dj_profiles).
-- NOTA: No usar DROP FUNCTION … CASCADE: borraría políticas RLS que referencian esta función.
-- CREATE OR REPLACE mantiene la firma y las dependencias de políticas intactas.

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
      AND lower(trim(coalesce(d.role, ''))) IN ('admin', 'manager', 'seller')
  );
$$;

COMMENT ON FUNCTION public.is_staff(uuid) IS
  'Estricto: true solo si dj_profiles.role normalizado es admin, manager o seller (staff operativo). Sin CASCADE en migraciones: preserva RLS.';

NOTIFY pgrst, 'reload schema';
