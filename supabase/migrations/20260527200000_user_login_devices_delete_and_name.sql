-- user_login_devices: añade DELETE propio + columna device_name editable.
-- Requiere: migración 20260430160000_security_known_devices_login.sql aplicada.

-- ── Columna device_name (etiqueta editable por el usuario, ej. "Mi MacBook") ──
ALTER TABLE public.user_login_devices
  ADD COLUMN IF NOT EXISTS device_name text;

COMMENT ON COLUMN public.user_login_devices.device_name IS
  'Nombre editable por el usuario para identificar el dispositivo.';

-- ── Política DELETE: el usuario solo puede eliminar sus propias filas ─────────
DROP POLICY IF EXISTS "user_login_devices_delete_own" ON public.user_login_devices;
CREATE POLICY "user_login_devices_delete_own"
  ON public.user_login_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT DELETE ON public.user_login_devices TO authenticated;

-- ── RPC conveniente: eliminar dispositivo por fingerprint propio ──────────────
CREATE OR REPLACE FUNCTION public.mdj_remove_login_device(p_device_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.user_login_devices
  WHERE id = p_device_id AND user_id = uid;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mdj_remove_login_device(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_remove_login_device(uuid) TO authenticated;

COMMENT ON FUNCTION public.mdj_remove_login_device(uuid) IS
  'Elimina un dispositivo registrado de auth.uid(). Protección: solo puede borrar filas propias.';

NOTIFY pgrst, 'reload schema';
