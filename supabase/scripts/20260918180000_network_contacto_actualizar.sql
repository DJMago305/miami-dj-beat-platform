-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-18
-- Autor: Hilo Maestro (Claude), continuando el trabajo de Network
--   ("faltan algunos cambios lógicos, cableado" -- PO al aprobar el
--   modelo inicial en PR #421) mientras el PO atendía otras cosas.
-- ============================================================
--
-- Guardado REAL de teléfono/email desde el panel de detalle del
-- Network (hoy ese panel es de solo lectura -- este script es el paso
-- "aparte" que ya se había anotado como pendiente en ESTADO_MAESTRO.md).
--
-- Por qué un RPC y no un UPDATE directo desde el navegador: las
-- políticas RLS de client_profiles/dj_profiles YA permiten que staff
-- actualice cualquier fila (client_profiles_staff_update_all,
-- dj_profiles_staff_update_others) -- un .update() directo funcionaría
-- hoy mismo sin este script. Se construye igual el RPC, siguiendo el
-- mismo criterio que ya se usó en mdj_assign_staff_to_lead/
-- find_or_create_master_client: un solo punto de escritura validado
-- (normaliza teléfono/email, nunca deja pisar la fila equivocada) y
-- con rastro de auditoría real vía mdj_auditar -- no un acceso directo
-- sin control desde el cliente.
--
-- Se reutiliza is_staff(auth.uid()) -- MISMA función que ya protege
-- las políticas RLS de ambas tablas, no una nueva regla de acceso.

CREATE OR REPLACE FUNCTION public.network_contacto_actualizar(
    p_fuente text,          -- 'client' (client_profiles) | 'dj' (dj_profiles)
    p_id     uuid,
    p_phone  text DEFAULT NULL,
    p_email  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes   jsonb;
  v_tabla   text;
  v_phone   text := NULLIF(trim(p_phone), '');
  v_email   text := NULLIF(trim(p_email), '');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;

  IF p_fuente NOT IN ('client', 'dj') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fuente_invalida');
  END IF;

  -- Validación mínima de formato -- rechazar basura evidente, sin
  -- inventar reglas de negocio que no existían (mismo email/teléfono
  -- libre que ya aceptan los formularios de registro reales).
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalido');
  END IF;

  v_tabla := CASE WHEN p_fuente = 'client' THEN 'client_profiles' ELSE 'dj_profiles' END;

  IF p_fuente = 'client' THEN
    SELECT to_jsonb(c) INTO v_antes FROM public.client_profiles c WHERE c.id = p_id;
    UPDATE public.client_profiles
       SET phone = COALESCE(v_phone, phone),
           email = COALESCE(v_email, email)
     WHERE id = p_id;
  ELSE
    SELECT to_jsonb(d) INTO v_antes FROM public.dj_profiles d WHERE d.id = p_id;
    UPDATE public.dj_profiles
       SET phone = COALESCE(v_phone, phone),
           email = COALESCE(v_email, email)
     WHERE id = p_id;
  END IF;

  IF v_antes IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contacto_no_encontrado');
  END IF;

  -- Auditoría real -- nunca bloquea el guardado si por algo falla.
  BEGIN
    PERFORM public.mdj_auditar(
      p_accion        => 'network_contacto_actualizar',
      p_recurso_tabla => v_tabla,
      p_recurso_id    => p_id::text,
      p_antes         => jsonb_build_object('phone', v_antes->>'phone', 'email', v_antes->>'email'),
      p_despues       => jsonb_build_object('phone', COALESCE(v_phone, v_antes->>'phone'), 'email', COALESCE(v_email, v_antes->>'email')),
      p_origen        => 'network'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text) TO authenticated;
COMMENT ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text) IS
  'Staff-only (is_staff): actualiza phone/email de un contacto del Network (client_profiles o dj_profiles). Auditado vía mdj_auditar. Parte del guardado real pendiente de PR #421.';

NOTIFY pgrst, 'reload schema';
