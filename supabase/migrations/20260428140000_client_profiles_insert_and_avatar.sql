-- Account settings: allow first-time row insert (upsert) + avatar columns for clients
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.client_profiles.avatar_url IS 'Public avatar URL (synced with auth user_metadata.avatar_url when possible).';
COMMENT ON COLUMN public.client_profiles.photo_url IS 'Legacy mirror of avatar image URL for reporting.';

-- RLS: authenticated users may create their own client_profiles row (upsert on save)
DROP POLICY IF EXISTS "Users can insert their own client profile" ON public.client_profiles;
CREATE POLICY "Users can insert their own client profile"
  ON public.client_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
