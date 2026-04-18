-- Artist commercial fields (onboarding + public listings). Safe IF NOT EXISTS.
ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS hourly_rate_usd NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS artist_specialty TEXT;

COMMENT ON COLUMN public.dj_profiles.hourly_rate_usd IS 'Default hourly rate USD for listings/quotes (artist-edited).';
COMMENT ON COLUMN public.dj_profiles.artist_specialty IS 'Short specialty line (e.g. Open Format · Latin · Weddings).';

NOTIFY pgrst, 'reload schema';
