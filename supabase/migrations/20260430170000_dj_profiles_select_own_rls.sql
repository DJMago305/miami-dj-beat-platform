-- DJs must be able to SELECT their own row (header, dashboard, auth.js nav).
-- RLS without a SELECT policy denies reads; breaks .from('dj_profiles').select(...).maybeSingle().

ALTER TABLE public.dj_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DJs select own dj_profiles" ON public.dj_profiles;

CREATE POLICY "DJs select own dj_profiles"
  ON public.dj_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "DJs select own dj_profiles" ON public.dj_profiles IS
  'Authenticated DJs read only their profile row (user_id = auth.uid()).';

NOTIFY pgrst, 'reload schema';
