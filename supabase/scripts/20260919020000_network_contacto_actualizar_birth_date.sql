-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: agrega
--   el "carrete" de fecha de nacimiento (Mes/Día/Año, estilo Apple)
--   a la ficha del Network, y ese campo debe guardar de verdad --
--   mismo criterio que ya se aplicó a Teléfono/Email.
-- ============================================================
--
-- Extiende network_contacto_actualizar (20260918180000) con un quinto
-- parámetro p_birth_date. birth_date YA existe como columna real en
-- client_profiles y dj_profiles (confirmado: es la misma columna que
-- ya lee account-settings.html) -- no se inventa nada nuevo, solo se
-- suma al mismo punto de escritura validado + auditado.
--
-- Se DROPea la firma vieja de 4 parámetros porque Postgres identifica
-- funciones por firma completa (nombre + tipos) -- un CREATE OR REPLACE
-- con un parámetro nuevo crearía una función *adicional* en vez de
-- reemplazar la vieja, dejando dos versiones sueltas.

DROP FUNCTION IF EXISTS public.network_contacto_actualizar(text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.network_contacto_actualizar(
    p_fuente     text,          -- 'client' (client_profiles) | 'dj' (dj_profiles)
    p_id         uuid,
    p_phone      text DEFAULT NULL,
    p_email      text DEFAULT NULL,
    p_birth_date date DEFAULT NULL
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
       SET phone      = COALESCE(v_phone, phone),
           email      = COALESCE(v_email, email),
           birth_date = COALESCE(p_birth_date, birth_date)
     WHERE id = p_id;
  ELSE
    SELECT to_jsonb(d) INTO v_antes FROM public.dj_profiles d WHERE d.id = p_id;
    UPDATE public.dj_profiles
       SET phone      = COALESCE(v_phone, phone),
           email      = COALESCE(v_email, email),
           birth_date = COALESCE(p_birth_date, birth_date)
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
      p_antes         => jsonb_build_object('phone', v_antes->>'phone', 'email', v_antes->>'email', 'birth_date', v_antes->>'birth_date'),
      p_despues       => jsonb_build_object('phone', COALESCE(v_phone, v_antes->>'phone'), 'email', COALESCE(v_email, v_antes->>'email'), 'birth_date', COALESCE(p_birth_date::text, v_antes->>'birth_date')),
      p_origen        => 'network'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date) TO authenticated;
COMMENT ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date) IS
  'Staff-only (is_staff): actualiza phone/email/birth_date de un contacto del Network (client_profiles o dj_profiles). Auditado vía mdj_auditar. Extiende la versión de 20260918180000 con birth_date.';

NOTIFY pgrst, 'reload schema';
