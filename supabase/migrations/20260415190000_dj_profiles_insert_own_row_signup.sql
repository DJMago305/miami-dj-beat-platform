-- LLAVE DE BIENVENIDA PARA ARTISTAS — signup (web/auth.js): INSERT con JWT tras signUp/signIn.
-- Sin esto, RLS deniega INSERT → 403.

ALTER TABLE public.dj_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DJs insert own dj_profiles" ON public.dj_profiles;
DROP POLICY IF EXISTS "DJs can insert their own profile" ON public.dj_profiles;

CREATE POLICY "DJs can insert their own profile"
  ON public.dj_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "DJs can insert their own profile" ON public.dj_profiles IS
  'Artist self-registration: only the new user can insert their own row (user_id = auth.uid()).';

NOTIFY pgrst, 'reload schema';
