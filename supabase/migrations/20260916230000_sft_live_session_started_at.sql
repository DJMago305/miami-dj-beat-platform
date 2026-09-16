-- PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Generado en disco local. NO aplicado a producción -- correr manualmente en
-- el SQL Editor de Supabase cuando el PO lo autorice.
--
-- Contexto (ticket "SoundForTips Live Session Gating", 2026-09-16): hoy
-- dj_profiles.soundfortips_active es un boolean manual sin expiración -- si
-- el DJ lo enciende, cualquier visitante del link público de perfil
-- (?view=public, el mismo QR/link de compartir/booking) puede enviar
-- pedidos, sin ninguna señal de que el DJ esté físicamente en vivo.
--
-- Este cambio agrega SOLO el "Candado B" (tiempo/estado en BD). El
-- "Candado A" (URL: ?mode=live vs ?view=public) vive en el frontend
-- (web/dj-profile.html), no requiere cambios de esquema.
--
-- Regla de expiración (calculada en el cliente, sin cron):
--   is_live_now = soundfortips_active = true
--                 AND soundfortips_live_started_at IS NOT NULL
--                 AND now() - soundfortips_live_started_at < interval '4 hours'
--
-- soundfortips_live_started_at se debe fijar/limpiar junto con
-- soundfortips_active en el mismo UPDATE que ya hace el toggle del DJ
-- (dj-profile.html, guardado de #soundfortips-active-toggle) y su copia en
-- la cabina -- no es un campo independiente que el usuario edite directo.

ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS soundfortips_live_started_at timestamptz NULL;

COMMENT ON COLUMN public.dj_profiles.soundfortips_live_started_at IS
  'Timestamp de inicio de la sesión SFT en vivo actual. Se fija a now() cuando soundfortips_active pasa a true; se limpia (NULL) cuando pasa a false. Una sesión se considera expirada 4 horas después de este valor -- ver web/dj-profile.html (Candado B, ticket Live Session Gating).';

-- Recrear la vista pública para exponer la nueva columna a anon/authenticated
-- (mismo mecanismo que ya usa soundfortips_active y public_account_id: la
-- vista corre con security_invoker=false, así que no hace falta abrir RLS
-- en la tabla base para este campo no sensible).
--
-- Definición base: la misma que
-- supabase/migrations/20260916220000_public_dj_profiles_add_account_id.sql,
-- con soundfortips_live_started_at agregada junto a soundfortips_active.

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
  CASE
    WHEN mai.stem IS NOT NULL THEN (mai.stem || '-' || mai.class)
    ELSE NULL
  END AS public_account_id,
  p.soundfortips_live_started_at
FROM public.dj_profiles p
LEFT JOIN public.mdjb_account_ids mai ON mai.user_id = p.user_id;

COMMENT ON VIEW public.public_dj_profiles IS
  'Public fan/roster read of dj_profiles incl. weekly_schedule, venue fields, public_account_id, and soundfortips_live_started_at (Live Session Gating, security_invoker=false so anon can read it without RLS on the base table).';

GRANT SELECT ON public.public_dj_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación sugerida después de ejecutar:
-- select user_id, soundfortips_active, soundfortips_live_started_at
-- from public.public_dj_profiles
-- where user_id = '3f5d5196-273c-458e-a4af-6b3545422177';
-- Esperado: la columna existe y devuelve NULL (nadie ha iniciado sesión en
-- vivo todavía) sin romper ninguna otra columna del select.
