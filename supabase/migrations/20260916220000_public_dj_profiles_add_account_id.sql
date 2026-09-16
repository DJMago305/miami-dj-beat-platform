-- PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Generado en disco local. NO aplicado a producción -- correr manualmente en
-- el SQL Editor de Supabase cuando el PO lo autorice.
--
-- Contexto: dj-profile.html mostraba el UUID interno de Postgres como
-- fallback público del "ID de artista" porque la consulta anon a
-- public.mdjb_account_ids siempre rebota (RLS: única política es
-- "user_id = auth.uid() OR is_staff(...)", solo para `authenticated` --
-- `anon` no tiene ninguna política, verificado en vivo). La vista
-- public_dj_profiles ya existe específicamente para exponer datos de perfil
-- a anon/authenticated con security_invoker=false (corre con los privilegios
-- del dueño de la vista, no del llamador) -- se le suma el carnet oficial
-- (stem + '-' + class de mdjb_account_ids) como una columna más, sin tocar
-- la RLS de la tabla base ni exponer la fila completa.
--
-- Definición base tomada de pg_get_viewdef en vivo (2026-09-16) para no
-- reconstruir a mano y arriesgar perder una columna real.

CREATE OR REPLACE VIEW public.public_dj_profiles
WITH (security_invoker = false)
AS
SELECT
  p.user_id,
  p.stage_name,
  p.dj_name,
  p.full_name,
  p.username,
  p.photo_url,
  p.background_url,
  p.photo_focal_x,
  p.photo_focal_y,
  p.hero_bg_zoom,
  p.bio,
  p.bio_en,
  p.bio_short,
  p.bio_long,
  p.city,
  p.roles,
  p.artist_specialty,
  p.plan,
  p.plan_type,
  p.plan_status,
  p.plan_expires_at,
  p.is_premium,
  p.subscription_status,
  p.available,
  p.rating,
  p.review_count,
  p.soundfortips_active,
  p.hourly_rate_usd,
  p.instagram_url,
  p.facebook_url,
  p.tiktok_url,
  p.youtube_url,
  p.website_url,
  p.soundcloud_url,
  p.spotify_url,
  p.apple_music_url,
  p.sft_pay_zelle_instructions,
  p.sft_pay_venmo_instructions,
  p.sft_pay_paypal_instructions,
  p.referral_code,
  p.weekly_schedule,
  p.availability_schedule,
  p.current_venue,
  p.venue_schedule,
  p.is_resident,
  lower(regexp_replace(trim(both from coalesce(nullif(p.username, ''), nullif(p.stage_name, ''), nullif(p.dj_name, ''), '')), '[^a-zA-Z0-9]+', '-', 'g')) AS dj_slug,
  -- FIX-HERO-ARTIST-ID-CARNET-OFICIAL (2026-09-16, orden del PO): carnet
  -- oficial público (ej. "MDJB-A1B2-C3D4-A"), NULL si el artista todavía no
  -- tiene fila en mdjb_account_ids -- el frontend no debe inventar ni caer
  -- al UUID en ese caso, solo omitir el contenedor.
  CASE
    WHEN mai.stem IS NOT NULL THEN (mai.stem || '-' || mai.class)
    ELSE NULL
  END AS public_account_id
FROM public.dj_profiles p
LEFT JOIN public.mdjb_account_ids mai ON mai.user_id = p.user_id;

COMMENT ON VIEW public.public_dj_profiles IS
  'Public fan/roster read of dj_profiles incl. weekly_schedule, venue fields, and the official public_account_id (from mdjb_account_ids, security_invoker=false so anon can read it without RLS on the base table).';

GRANT SELECT ON public.public_dj_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación sugerida después de ejecutar:
-- select user_id, dj_slug, public_account_id from public.public_dj_profiles
-- where user_id = '3f5d5196-273c-458e-a4af-6b3545422177';
-- Esperado: public_account_id con formato MDJB-XXXX-XXXX-<letra>, o NULL si
-- ese DJ todavía no tiene fila en mdjb_account_ids.
