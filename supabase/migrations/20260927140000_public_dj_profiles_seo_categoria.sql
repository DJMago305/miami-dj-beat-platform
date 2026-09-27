-- ═══════════════════════════════════════════════════════════════════════════
-- 2026-09-27 (orden del PO, tras hallazgo real): la vista `public_dj_profiles`
-- nunca expuso `seo_publish_status` ni `categoria` (ambas columnas existen en
-- `dj_profiles` desde antes, agregadas por separado). Consecuencia real, no
-- teórica: `tools/dj-profiles/build.mjs` (el generador de web/dj/<slug>.html)
-- consulta `seo_publish_status` a través de esta vista y falla en cada
-- corrida con "column public_dj_profiles.seo_publish_status does not exist"
-- (42703) -- confirmado con --dry-run en producción el 2026-09-27. El
-- generador lleva roto desde que se agregó esa columna sin actualizar esta
-- vista; por eso djsolitario.html/djyuyo.html quedaron desactualizados
-- (ratings falsos, ciudad en minúscula, CTA al patrón viejo).
--
-- Aditivo puro: CREATE OR REPLACE VIEW con la MISMA definición real y actual
-- de producción (verificada vía pg_get_viewdef antes de escribir este
-- archivo, no una foto vieja) + 2 columnas nuevas al final. Ninguna columna
-- existente se quita ni se reordena. Entorno: FUENTE ÚNICA — PROD
-- (hkuvuqupbxwkiykxvqdr). PRUEBA no tiene esta tabla/vista (esquema
-- atrasado, ver notas previas de esta misma serie de migraciones).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.public_dj_profiles AS
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
    lower(regexp_replace(TRIM(BOTH FROM COALESCE(NULLIF(p.username, ''::text), NULLIF(p.stage_name, ''::text), NULLIF(p.dj_name, ''::text), ''::text)), '[^a-zA-Z0-9]+'::text, '-'::text, 'g'::text)) AS dj_slug,
    CASE
        WHEN mai.stem IS NOT NULL THEN (mai.stem || '-'::text) || mai.class::text
        ELSE NULL::text
    END AS public_account_id,
    p.soundfortips_live_started_at,
    p.beatport_url,
    p.twitter_url,
    p.seo_publish_status,
    p.categoria
FROM public.dj_profiles p
LEFT JOIN public.mdjb_account_ids mai ON mai.user_id = p.user_id;
