-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Pedido del PO ("falta cableado"): la sección Redes Sociales de
-- Network escribía a `dj_profiles.redes_sociales` (columna jsonb nueva
-- de hoy), pero el Dashboard real del DJ (dj-dashboard.html) y
-- Configuración de cuenta (account-settings.html) YA gestionan las
-- redes del DJ en 9 columnas reales y activas desde antes de hoy:
-- youtube_url, spotify_url, soundcloud_url, instagram_url, tiktok_url,
-- facebook_url, beatport_url, apple_music_url, twitter_url -- más
-- `website_url` (página web, aparte de las redes). Confirmado en el
-- código: dj-dashboard.html:5820-5825/6426-6434 y
-- account-settings.html:6700-6709 leen/escriben exactamente esas
-- columnas. `dj_profiles.redes_sociales` quedaba como una segunda
-- fuente desconectada -- este cambio hace que Network lea/escriba las
-- columnas reales para DJs, no la copia nueva. (client_profiles no
-- tiene estas columnas -- ahí `redes_sociales` jsonb sigue siendo la
-- fuente real, sin cambios.)
-- ============================================================

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
    p_direccion       jsonb DEFAULT NULL,
    p_website_url     text DEFAULT NULL
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
           website_url      = COALESCE(p_website_url, website_url),
           youtube_url      = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'YouTube' LIMIT 1), '') ELSE youtube_url END,
           spotify_url      = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'Spotify' LIMIT 1), '') ELSE spotify_url END,
           soundcloud_url   = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'SoundCloud' LIMIT 1), '') ELSE soundcloud_url END,
           instagram_url    = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'Instagram' LIMIT 1), '') ELSE instagram_url END,
           tiktok_url       = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'TikTok' LIMIT 1), '') ELSE tiktok_url END,
           facebook_url     = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'Facebook' LIMIT 1), '') ELSE facebook_url END,
           beatport_url     = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'Beatport' LIMIT 1), '') ELSE beatport_url END,
           apple_music_url  = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'Apple Music' LIMIT 1), '') ELSE apple_music_url END,
           twitter_url      = CASE WHEN p_redes_sociales IS NOT NULL THEN NULLIF((SELECT e->>'url' FROM jsonb_array_elements(p_redes_sociales) e WHERE e->>'red' = 'Twitter/X' LIMIT 1), '') ELSE twitter_url END,
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

REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) TO authenticated;
COMMENT ON FUNCTION public.network_contacto_actualizar(text, uuid, text, text, date, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) IS
  'Staff-only (is_staff): actualiza un contacto real (client/dj) del Network. Para dj, redes sociales y página web escriben a las columnas reales (youtube_url/spotify_url/etc/website_url) que ya usan dj-dashboard.html y account-settings.html -- no a una copia jsonb aparte. Auditado vía mdj_auditar.';

NOTIFY pgrst, 'reload schema';
