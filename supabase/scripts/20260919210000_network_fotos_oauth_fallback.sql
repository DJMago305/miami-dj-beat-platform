-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Pedido del PO: "cablear el avatar que ya existe" -- encontrado en
-- auth.users.raw_user_meta_data->>'avatar_url' (foto real guardada al
-- iniciar sesión con Google), NUNCA copiada a photo_url en
-- client_profiles/dj_profiles. dj-dashboard.html ya usa este mismo
-- respaldo para SU propia vista (`p.photo_url || session.user.
-- user_metadata.avatar_url`, dj-dashboard.html:5097-5099) -- este RPC
-- expone el mismo criterio a Network, staff-only, SIN escribir nada
-- (nunca sobreescribe photo_url -- es un respaldo de SOLO LECTURA para
-- cuando la columna real está vacía). Mismo "misma fuente de verdad"
-- que ya se aplicó a redes sociales/dirección esta sesión.
--
-- Caso real encontrado con este RPC (2026-09-19): Wendy E Ayala
-- (client_profiles) tenía photo_url vacío pero sí una foto real de
-- Google -- ahora se muestra en Network sin tocar su columna real.
-- ============================================================

CREATE OR REPLACE FUNCTION public.network_fotos_oauth_fallback()
RETURNS TABLE(fuente text, id uuid, foto text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'client'::text, c.id, u.raw_user_meta_data->>'avatar_url'
    FROM public.client_profiles c
    JOIN auth.users u ON u.id = c.user_id
   WHERE (c.photo_url IS NULL OR c.photo_url = '')
     AND u.raw_user_meta_data->>'avatar_url' IS NOT NULL
  UNION ALL
  SELECT 'dj'::text, d.id, u.raw_user_meta_data->>'avatar_url'
    FROM public.dj_profiles d
    JOIN auth.users u ON u.id = d.user_id
   WHERE (d.photo_url IS NULL OR d.photo_url = '')
     AND u.raw_user_meta_data->>'avatar_url' IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.network_fotos_oauth_fallback() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_fotos_oauth_fallback() FROM anon;
GRANT EXECUTE ON FUNCTION public.network_fotos_oauth_fallback() TO authenticated;
COMMENT ON FUNCTION public.network_fotos_oauth_fallback() IS
  'Staff-only (is_staff): devuelve, para cada cuenta real (client/dj) con photo_url vacío, la foto real que ya existe en los metadatos de su login (Google avatar_url) -- respaldo de solo lectura, nunca escribe. Usado por Network para no mostrar iniciales cuando ya existe una foto real en otro lugar.';

NOTIFY pgrst, 'reload schema';
