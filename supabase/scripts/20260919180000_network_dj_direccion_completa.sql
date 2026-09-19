-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Pedido del PO (mirando su propia ficha real de DJMago305): la
-- dirección se veía incompleta para la fuente "dj" porque dj_profiles
-- nunca tuvo columnas para apartamento/código postal/país (solo
-- `address` de texto libre + `city` + `region`) -- se agregan ahora,
-- mismo nombre que ya usa client_profiles, para que la ficha de un DJ
-- pueda mostrar la dirección completa igual que la de un cliente.
-- Extiende 20260919170000_network_direccion_fisica.sql.
-- ============================================================

ALTER TABLE public.dj_profiles
    ADD COLUMN IF NOT EXISTS address_apt text,
    ADD COLUMN IF NOT EXISTS address_zip text,
    ADD COLUMN IF NOT EXISTS address_country text;

DROP FUNCTION IF EXISTS public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb);

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
           address          = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'street', '') ELSE address END,
           address_apt      = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'apt', '') ELSE address_apt END,
           city             = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'city', '') ELSE city END,
           region           = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'state', '') ELSE region END,
           address_zip      = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'zip', '') ELSE address_zip END,
           address_country  = CASE WHEN p_direccion IS NOT NULL THEN NULLIF(p_direccion->>'country', '') ELSE address_country END
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
  'Staff-only (is_staff): actualiza phone/email/birth_date/foto/telefonos-extra/correos-extra/aniversario/redes-sociales/direccion (completa, dj y client parejos) de un contacto real del Network. Auditado vía mdj_auditar.';

NOTIFY pgrst, 'reload schema';
