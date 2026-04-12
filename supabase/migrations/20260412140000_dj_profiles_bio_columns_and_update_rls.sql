-- Public bio fields (dashboard + perfil + find-dj)
ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS bio_en TEXT,
  ADD COLUMN IF NOT EXISTS bio_short TEXT,
  ADD COLUMN IF NOT EXISTS bio_long TEXT;

COMMENT ON COLUMN public.dj_profiles.bio IS 'Biografía pública (ES / por defecto)';
COMMENT ON COLUMN public.dj_profiles.bio_en IS 'Biografía pública (EN)';
COMMENT ON COLUMN public.dj_profiles.bio_short IS 'Resumen para listados (find-dj)';
COMMENT ON COLUMN public.dj_profiles.bio_long IS 'Biografía larga (onboarding)';

-- El cliente autenticado debe poder actualizar su fila (p. ej. guardar bio desde el dashboard).
-- Idempotente: sustituye si ya existía con el mismo nombre.
DROP POLICY IF EXISTS "DJs update own dj_profiles" ON public.dj_profiles;
CREATE POLICY "DJs update own dj_profiles"
  ON public.dj_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
