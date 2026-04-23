-- Reafirma políticas de artista (fila propia) junto a staff (303100).
-- Si en algún entorno faltó "DJs select/update own" tras migraciones parciales,
-- el dashboard (Agenda / CONFIG / Cash Flow) falla con permisos denegados en API.

ALTER TABLE public.dj_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DJs select own dj_profiles" ON public.dj_profiles;
CREATE POLICY "DJs select own dj_profiles"
  ON public.dj_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "DJs update own dj_profiles" ON public.dj_profiles;
CREATE POLICY "DJs update own dj_profiles"
  ON public.dj_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_settings_select_own" ON public.billing_settings;
CREATE POLICY "billing_settings_select_own"
  ON public.billing_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "billing_settings_insert_own" ON public.billing_settings;
CREATE POLICY "billing_settings_insert_own"
  ON public.billing_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "billing_settings_update_own" ON public.billing_settings;
CREATE POLICY "billing_settings_update_own"
  ON public.billing_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
