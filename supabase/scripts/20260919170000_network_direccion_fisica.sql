-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Pedido del PO: agregar Dirección física a la ficha de Network,
-- usando su propia tarjeta de Contactos de macOS (MIAMI DJ BEAT LLC)
-- como referencia visual de qué tan "elegante" debe verse.
-- ============================================================
--
-- Reemplaza los parámetros de dirección/perfil que trajo la migración
-- 20260919030000 (address_street/city/state/zip, address, region,
-- website_url, social_instagram, wedding_anniversary) -- NUNCA se
-- conectó al frontend, y wedding_anniversary/website_url/
-- social_instagram ya quedaron superados por los campos jsonb
-- genéricos `aniversario`/`redes_sociales` que sí están en producción
-- hoy. Se consolida todo en un solo `p_direccion jsonb` con forma
-- {street, apt, city, state, zip, country} -- mismo criterio "objeto
-- completo siempre que se toque" que ya usan aniversario/redes_sociales.
--
-- Cada fuente escribe en sus columnas REALES (confirmado vía
-- information_schema.columns, nada inventado):
--   client_profiles: address_street, address_apt, city, address_state,
--                     address_zip, address_country (columnas ya existen).
--   dj_profiles: solo tiene `address` (texto libre) + `city` + `region`
--                -- street+apt se combinan en `address`, state -> region.
--                zip/country no tienen columna real en dj_profiles, se
--                ignoran ahí (no se inventa columna nueva).
--   network_referencia_contactos: no tenía NINGUNA columna de dirección
--                -- se agrega `direccion jsonb` nueva, guarda el objeto
--                completo tal cual (mismo patrón que `aniversario`).
--
-- NOTA HISTÓRICA: este CREATE OR REPLACE es también el primer registro
-- en archivo de p_redes_sociales y p_notas -- ambos se aplicaron antes,
-- en el mismo día, directo con las herramientas de Supabase (uno vía
-- apply_migration sin guardar script, el otro vía execute_sql crudo) --
-- nunca llegaron a un archivo propio. Esta firma final ya los incluye,
-- así que este archivo es la fuente de verdad vigente para las tres
-- capas jsonb (aniversario/redes_sociales/direccion) + notas.

ALTER TABLE public.network_referencia_contactos
    ADD COLUMN IF NOT EXISTS direccion jsonb;

DROP FUNCTION IF EXISTS public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date, text, jsonb, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.network_contacto_actualizar(
    p_fuente          text,
    p_id              uuid,
    p_phone           text DEFAULT NULL,
    p_email           text DEFAULT NULL,
    p_birth_date      date DEFAULT NULL,
    p_photo_url       text DEFAULT NULL,
    p_phones_extra    jsonb DEFAULT NULL,
    p_emails_extra    jsonb DEFAULT NULL,
    p_aniversario     jsonb DEFAULT NULL,
    p_redes_sociales  jsonb DEFAULT NULL,
    p_direccion       jsonb DEFAULT NULL
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
       SET phone           = COALESCE(v_phone, phone),
           email           = COALESCE(v_email, email),
           birth_date      = COALESCE(p_birth_date, birth_date),
           photo_url       = COALESCE(p_photo_url, photo_url),
           phones_extra    = COALESCE(p_phones_extra, phones_extra),
           emails_extra    = COALESCE(p_emails_extra, emails_extra),
           aniversario     = COALESCE(p_aniversario, aniversario),
           redes_sociales  = COALESCE(p_redes_sociales, redes_sociales),
           address_street  = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'street', '') ELSE address_street END,
           address_apt     = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'apt', '') ELSE address_apt END,
           city            = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'city', '') ELSE city END,
           address_state   = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'state', '') ELSE address_state END,
           address_zip     = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'zip', '') ELSE address_zip END,
           address_country = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'country', '') ELSE address_country END
     WHERE id = p_id;
  ELSE
    SELECT to_jsonb(d) INTO v_antes FROM public.dj_profiles d WHERE d.id = p_id;
    UPDATE public.dj_profiles
       SET phone            = COALESCE(v_phone, phone),
           email            = COALESCE(v_email, email),
           birth_date       = COALESCE(p_birth_date, birth_date),
           photo_url        = COALESCE(p_photo_url, photo_url),
           phones_extra     = COALESCE(p_phones_extra, phones_extra),
           emails_extra     = COALESCE(p_emails_extra, emails_extra),
           aniversario      = COALESCE(p_aniversario, aniversario),
           redes_sociales   = COALESCE(p_redes_sociales, redes_sociales),
           address          = CASE WHEN p_direccion IS NOT NULL
                                    THEN NULLIF(trim(concat_ws(' ', NULLIF(p_direccion->>'street', ''),
                                                CASE WHEN NULLIF(p_direccion->>'apt', '') IS NOT NULL THEN 'Apt ' || (p_direccion->>'apt') ELSE NULL END)), '')
                                    ELSE address END,
           city             = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'city', '') ELSE city END,
           region           = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'state', '') ELSE region END
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
      p_antes         => jsonb_build_object('phone', v_antes->>'phone', 'email', v_antes->>'email', 'photo_url', v_antes->>'photo_url'),
      p_despues       => jsonb_build_object('phone', COALESCE(v_phone, v_antes->>'phone'), 'email', COALESCE(v_email, v_antes->>'email'), 'photo_url', COALESCE(p_photo_url, v_antes->>'photo_url')),
      p_origen        => 'network'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
COMMENT ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb) IS
  'Staff-only (is_staff): actualiza phone/email/birth_date/foto/telefonos-extra/correos-extra/aniversario/redes-sociales/direccion de un contacto real (client/dj) del Network. Auditado vía mdj_auditar.';

DROP FUNCTION IF EXISTS public.network_referencia_actualizar(uuid, text, text, text, date, jsonb, jsonb, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.network_referencia_actualizar(
    p_id              uuid,
    p_phone           text DEFAULT NULL,
    p_email           text DEFAULT NULL,
    p_photo_url       text DEFAULT NULL,
    p_birth_date      date DEFAULT NULL,
    p_phones_extra    jsonb DEFAULT NULL,
    p_emails_extra    jsonb DEFAULT NULL,
    p_aniversario     jsonb DEFAULT NULL,
    p_redes_sociales  jsonb DEFAULT NULL,
    p_notas           text DEFAULT NULL,
    p_direccion       jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes jsonb;
  v_phone text := NULLIF(trim(p_phone), '');
  v_email text := NULLIF(trim(p_email), '');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;

  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalido');
  END IF;

  SELECT to_jsonb(r) INTO v_antes FROM public.network_referencia_contactos r WHERE r.id = p_id;
  IF v_antes IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contacto_no_encontrado');
  END IF;

  UPDATE public.network_referencia_contactos
     SET telefono        = COALESCE(v_phone, telefono),
         email           = COALESCE(v_email, email),
         photo_url       = COALESCE(p_photo_url, photo_url),
         birth_date      = COALESCE(p_birth_date, birth_date),
         phones_extra    = COALESCE(p_phones_extra, phones_extra),
         emails_extra    = COALESCE(p_emails_extra, emails_extra),
         aniversario     = COALESCE(p_aniversario, aniversario),
         redes_sociales  = COALESCE(p_redes_sociales, redes_sociales),
         notas           = COALESCE(p_notas, notas),
         direccion       = COALESCE(p_direccion, direccion)
   WHERE id = p_id;

  BEGIN
    PERFORM public.mdj_auditar(
      p_accion        => 'network_referencia_actualizar',
      p_recurso_tabla => 'network_referencia_contactos',
      p_recurso_id    => p_id::text,
      p_antes         => jsonb_build_object('telefono', v_antes->>'telefono', 'email', v_antes->>'email'),
      p_despues       => jsonb_build_object('telefono', COALESCE(v_phone, v_antes->>'telefono'), 'email', COALESCE(v_email, v_antes->>'email')),
      p_origen        => 'network'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text, date, jsonb, jsonb, jsonb, jsonb, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text, date, jsonb, jsonb, jsonb, jsonb, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text, date, jsonb, jsonb, jsonb, jsonb, text, jsonb) TO authenticated;
COMMENT ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text, date, jsonb, jsonb, jsonb, jsonb, text, jsonb) IS
  'Staff-only (is_staff): actualiza phone/email/foto/birth_date/telefonos-extra/correos-extra/aniversario/redes-sociales/notas/direccion de un contacto de referencia (sin cuenta real). Auditado vía mdj_auditar.';

NOTIFY pgrst, 'reload schema';
