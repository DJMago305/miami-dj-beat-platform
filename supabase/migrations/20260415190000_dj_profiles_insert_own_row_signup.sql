-- Signup (web/auth.js): tras signUp/signIn el usuario autenticado inserta su fila en dj_profiles.
-- Sin esta política, RLS deniega INSERT → 403 / "new row violates row-level security policy".

ALTER TABLE public.dj_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DJs insert own dj_profiles" ON public.dj_profiles;
CREATE POLICY "DJs insert own dj_profiles"
  ON public.dj_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "DJs insert own dj_profiles" ON public.dj_profiles IS
  'Artist self-registration: only the new user can insert their own row (user_id = auth.uid()).';

NOTIFY pgrst, 'reload schema';
