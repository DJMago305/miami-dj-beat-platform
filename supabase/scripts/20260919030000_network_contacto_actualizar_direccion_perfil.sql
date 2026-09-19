-- ============================================================
-- SUPERADO -- nunca se aplicó tal cual (el DROP FUNCTION de abajo no
-- coincide con ninguna firma que haya existido en producción) y quedó
-- huérfano cuando aniversario/redes_sociales llegaron como jsonb
-- genéricos más tarde en la misma sesión del 2026-09-19. Se conserva
-- solo como registro histórico de la idea original -- la versión real
-- que sí se aplicó a producción es
-- 20260919170000_network_direccion_fisica.sql (p_direccion jsonb).
-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: referencia
--   directa a la app nativa de Contactos (Dirección, URL/Perfil,
--   Aniversario) con el patrón de botón "+" que revela el campo.
-- ============================================================
--
-- Extiende network_contacto_actualizar (20260919020000) con Dirección,
-- Perfil/URL (solo dj_profiles -- client_profiles no tiene columnas de
-- redes sociales) y Aniversario (solo client_profiles -- dj_profiles
-- no tiene un segundo campo de fecha). Todas las columnas usadas aquí
-- YA EXISTEN (confirmado vía information_schema.columns) -- ninguna
-- se inventa.
--
-- Direcciones tienen forma distinta en cada tabla: client_profiles
-- separa street/city/state/zip; dj_profiles solo tiene un campo
-- `address` de texto libre + `city`/`region`. Se mandan ambos grupos
-- de parámetros y cada rama de fuente usa solo los que le
-- corresponden (los del otro grupo llegan NULL y no hacen nada).

DROP FUNCTION IF EXISTS public.network_contacto_actualizar(text, uuid, text, text, date);

CREATE OR REPLACE FUNCTION public.network_contacto_actualizar(
    p_fuente               text,
    p_id                   uuid,
    p_phone                text DEFAULT NULL,
    p_email                text DEFAULT NULL,
    p_birth_date           date DEFAULT NULL,
    p_address_street       text DEFAULT NULL,  -- client_profiles
    p_address_city         text DEFAULT NULL,  -- client_profiles (columna real: city)
    p_address_state        text DEFAULT NULL,  -- client_profiles
    p_address_zip          text DEFAULT NULL,  -- client_profiles
    p_address              text DEFAULT NULL,  -- dj_profiles (campo único de texto libre)
    p_region               text DEFAULT NULL,  -- dj_profiles
    p_website_url          text DEFAULT NULL,  -- dj_profiles
    p_social_instagram     text DEFAULT NULL,  -- dj_profiles
    p_wedding_anniversary  date DEFAULT NULL   -- client_profiles
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

  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalido');
  END IF;

  v_tabla := CASE WHEN p_fuente = 'client' THEN 'client_profiles' ELSE 'dj_profiles' END;

  IF p_fuente = 'client' THEN
    SELECT to_jsonb(c) INTO v_antes FROM public.client_profiles c WHERE c.id = p_id;
    UPDATE public.client_profiles
       SET phone               = COALESCE(v_phone, phone),
           email               = COALESCE(v_email, email),
           birth_date          = COALESCE(p_birth_date, birth_date),
           address_street      = COALESCE(p_address_street, address_street),
           city                = COALESCE(p_address_city, city),
           address_state       = COALESCE(p_address_state, address_state),
           address_zip         = COALESCE(p_address_zip, address_zip),
           wedding_anniversary = COALESCE(p_wedding_anniversary, wedding_anniversary)
     WHERE id = p_id;
  ELSE
    SELECT to_jsonb(d) INTO v_antes FROM public.dj_profiles d WHERE d.id = p_id;
    UPDATE public.dj_profiles
       SET phone            = COALESCE(v_phone, phone),
           email            = COALESCE(v_email, email),
           birth_date       = COALESCE(p_birth_date, birth_date),
           address          = COALESCE(p_address, address),
           region           = COALESCE(p_region, region),
           website_url      = COALESCE(p_website_url, website_url),
           social_instagram = COALESCE(p_social_instagram, social_instagram)
     WHERE id = p_id;
  END IF;

  IF v_antes IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contacto_no_encontrado');
  END IF;

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

REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date) TO authenticated;
COMMENT ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date) IS
  'Staff-only (is_staff): actualiza phone/email/birth_date/dirección/perfil(dj)/aniversario(client) de un contacto del Network. Auditado vía mdj_auditar. Extiende 20260919020000.';

NOTIFY pgrst, 'reload schema';
