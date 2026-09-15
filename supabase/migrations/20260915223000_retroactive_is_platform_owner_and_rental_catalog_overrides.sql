-- MIGRACIÓN RETROACTIVA (2026-09-15, orden del PO).
-- Documenta en git dos funciones que existían en producción
-- (hkuvuqupbxwkiykxvqdr) SIN ningún migration asociado -- ni en este
-- repositorio ni en el historial propio de migraciones de Supabase.
-- Origen desconocido (aplicadas por fuera de todo control de versiones).
--
-- El cuerpo y los permisos aquí reflejan EXACTAMENTE el estado ya vigente en
-- producción a esta fecha (extraído vía pg_get_functiondef + has_function_
-- privilege durante la auditoría de seguridad de 211 advertencias). Esta
-- migración no cambia comportamiento -- solo cierra la brecha de que código
-- vivo en prod no tuviera rastro en git.
--
-- Nota: public.platform_settings (usada por mdj_owner_save_rental_catalog_
-- overrides) ya está trackeada en migraciones previas (ver
-- 20260303000003_stripe_columns_dj_profiles_referrals.sql y las de
-- mdjpro_downloads_catalog_*) -- no se recrea aquí.

-- ── RPC: is_platform_owner ──────────────────────────────────────────────
-- Helper interno de solo lectura: ¿el uid dado tiene role='owner' en
-- dj_profiles? Sin call sites directos en el código (grep confirmado) --
-- se usa como building block de otras funciones SECURITY DEFINER
-- (ej. mdj_owner_save_rental_catalog_overrides).

DROP FUNCTION IF EXISTS public.is_platform_owner(uuid);

CREATE OR REPLACE FUNCTION public.is_platform_owner(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.dj_profiles dp
     WHERE dp.user_id = p_uid
       AND lower(trim(dp.role::text)) = 'owner'
  );
$$;

COMMENT ON FUNCTION public.is_platform_owner(uuid) IS
  'Helper interno: true si p_uid tiene role=owner en dj_profiles. Documentado retroactivamente 2026-09-15 -- no tenía migración propia.';

REVOKE ALL ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated;

-- ── RPC: mdj_owner_save_rental_catalog_overrides ────────────────────────
-- Solo el owner de la plataforma (via is_platform_owner) puede guardar
-- overrides del catálogo de rentals en platform_settings. Sin call sites
-- en el código actual (feature pendiente de conectar a UI).

DROP FUNCTION IF EXISTS public.mdj_owner_save_rental_catalog_overrides(jsonb);

CREATE OR REPLACE FUNCTION public.mdj_owner_save_rental_catalog_overrides(p_overrides jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_session');
  END IF;

  IF NOT public.is_platform_owner(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'owner_only');
  END IF;

  IF p_overrides IS NULL OR jsonb_typeof(p_overrides) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_overrides');
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('rental_catalog_overrides_v1', p_overrides::text, now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.mdj_owner_save_rental_catalog_overrides(jsonb) IS
  'Solo platform owner: guarda overrides del catálogo de rentals en platform_settings. Documentado retroactivamente 2026-09-15 -- no tenía migración propia.';

REVOKE ALL ON FUNCTION public.mdj_owner_save_rental_catalog_overrides(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_owner_save_rental_catalog_overrides(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
