-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: "en la
--   sección de donde va la foto también se debería poder editar
--   desde aquí, hasta que el cliente se abra la cuenta y se
--   autocorrija".
-- ============================================================
--
-- El bucket "avatars" ya existe y tiene RLS real: solo el dueño de la
-- cuenta (auth.uid() = carpeta del archivo) puede subir/actualizar su
-- propia foto (confirmado vía pg_policies). Staff (otro auth.uid()
-- distinto) NO puede escribir en la carpeta de otra persona -- eso es
-- correcto, no se toca. Se agrega una carpeta APARTE dentro del mismo
-- bucket ("staff-uploads/"), con su propia política, solo para que
-- staff suba una foto temporal a un contacto -- cuando la persona
-- real abra su cuenta y suba la suya propia (a SU carpeta normal),
-- esa nueva foto simplemente reemplaza el photo_url igual que
-- siempre, sin conflicto.

DROP POLICY IF EXISTS "Staff allow insert en avatars/staff-uploads" ON storage.objects;
CREATE POLICY "Staff allow insert en avatars/staff-uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'staff-uploads'
    AND public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Staff allow update en avatars/staff-uploads" ON storage.objects;
CREATE POLICY "Staff allow update en avatars/staff-uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'staff-uploads'
    AND public.is_staff(auth.uid())
  );

-- network_referencia_contactos no tenía columna de foto todavía.
ALTER TABLE public.network_referencia_contactos
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Extiende network_contacto_actualizar (cuentas reales) con p_photo_url.
DROP FUNCTION IF EXISTS public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date);

CREATE OR REPLACE FUNCTION public.network_contacto_actualizar(
    p_fuente               text,
    p_id                   uuid,
    p_phone                text DEFAULT NULL,
    p_email                text DEFAULT NULL,
    p_birth_date           date DEFAULT NULL,
    p_address_street       text DEFAULT NULL,
    p_address_city         text DEFAULT NULL,
    p_address_state        text DEFAULT NULL,
    p_address_zip          text DEFAULT NULL,
    p_address              text DEFAULT NULL,
    p_region               text DEFAULT NULL,
    p_website_url          text DEFAULT NULL,
    p_social_instagram     text DEFAULT NULL,
    p_wedding_anniversary  date DEFAULT NULL,
    p_photo_url            text DEFAULT NULL
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
           wedding_anniversary = COALESCE(p_wedding_anniversary, wedding_anniversary),
           photo_url           = COALESCE(p_photo_url, photo_url)
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
           social_instagram = COALESCE(p_social_instagram, social_instagram),
           photo_url        = COALESCE(p_photo_url, photo_url)
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

REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, text, text, text, text, text, text, text, date, text) TO authenticated;

-- Extiende network_referencia_actualizar (contactos sin cuenta) con p_photo_url.
DROP FUNCTION IF EXISTS public.network_referencia_actualizar(uuid, text, text);

CREATE OR REPLACE FUNCTION public.network_referencia_actualizar(
    p_id        uuid,
    p_phone     text DEFAULT NULL,
    p_email     text DEFAULT NULL,
    p_photo_url text DEFAULT NULL
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
     SET telefono  = COALESCE(v_phone, telefono),
         email     = COALESCE(v_email, email),
         photo_url = COALESCE(p_photo_url, photo_url)
   WHERE id = p_id;

  BEGIN
    PERFORM public.mdj_auditar(
      p_accion        => 'network_referencia_actualizar',
      p_recurso_tabla => 'network_referencia_contactos',
      p_recurso_id    => p_id::text,
      p_antes         => jsonb_build_object('telefono', v_antes->>'telefono', 'email', v_antes->>'email', 'photo_url', v_antes->>'photo_url'),
      p_despues       => jsonb_build_object('telefono', COALESCE(v_phone, v_antes->>'telefono'), 'email', COALESCE(v_email, v_antes->>'email'), 'photo_url', COALESCE(p_photo_url, v_antes->>'photo_url')),
      p_origen        => 'network'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
