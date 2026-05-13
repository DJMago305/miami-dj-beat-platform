-- Expose residency / venue schedule on fan read model (public_dj_profiles).
-- Fans and QR (?view=public) use the same venue wiring as owner Mi Perfil.

DROP VIEW IF EXISTS public.public_dj_profiles CASCADE;

DO $$
DECLARE
  base_cols text[] := ARRAY[
    'user_id', 'stage_name', 'dj_name', 'full_name', 'username',
    'photo_url', 'background_url', 'photo_focal_x', 'photo_focal_y', 'hero_bg_zoom',
    'bio', 'bio_en', 'bio_short', 'bio_long',
    'city', 'roles', 'artist_specialty',
    'plan', 'plan_type', 'plan_status', 'plan_expires_at', 'is_premium', 'subscription_status',
    'available', 'verified', 'rating', 'review_count', 'soundfortips_active', 'hourly_rate_usd',
    'instagram_url', 'facebook_url', 'tiktok_url', 'youtube_url', 'website_url',
    'soundcloud_url', 'spotify_url', 'apple_music_url',
    'sft_pay_zelle_instructions', 'sft_pay_venmo_instructions', 'sft_pay_paypal_instructions',
    'referral_code',
    'weekly_schedule', 'availability_schedule', 'current_venue', 'venue_schedule', 'is_resident'
  ];
  c text;
  parts text[] := ARRAY[]::text[];
  slug_expr text;
  slug_parts text[] := ARRAY[]::text[];
  view_sql text;
BEGIN
  IF to_regclass('public.dj_profiles') IS NULL THEN
    RAISE EXCEPTION 'public.dj_profiles does not exist';
  END IF;

  FOREACH c IN ARRAY base_cols LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'dj_profiles'
        AND column_name = c
    ) THEN
      parts := array_append(parts, format('p.%I', c));
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'dj_profiles.user_id is required for public_dj_profiles';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = 'dj_slug'
  ) THEN
    slug_expr := 'p.dj_slug';
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = 'username'
    ) THEN
      slug_parts := array_append(slug_parts, 'NULLIF(p.username, '''')');
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = 'stage_name'
    ) THEN
      slug_parts := array_append(slug_parts, 'NULLIF(p.stage_name, '''')');
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = 'dj_name'
    ) THEN
      slug_parts := array_append(slug_parts, 'NULLIF(p.dj_name, '''')');
    END IF;
    IF coalesce(array_length(slug_parts, 1), 0) = 0 THEN
      slug_expr := '''''';
    ELSE
      slug_expr := format(
        'lower(regexp_replace(trim(COALESCE(%s, '''')), ''[^a-zA-Z0-9]+'', ''-'', ''g''))',
        array_to_string(slug_parts, ', ')
      );
    END IF;
  END IF;

  parts := array_append(parts, slug_expr || ' AS dj_slug');

  view_sql := format(
    $v$CREATE VIEW public.public_dj_profiles
WITH (security_invoker = false)
AS
SELECT %s
FROM public.dj_profiles p$v$,
    array_to_string(parts, E',\n  ')
  );

  EXECUTE view_sql;
END $$;

COMMENT ON VIEW public.public_dj_profiles IS
  'Public fan/roster read of dj_profiles incl. weekly_schedule and venue fields for ACTUALMENTE TRABAJA EN.';

GRANT SELECT ON public.public_dj_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
