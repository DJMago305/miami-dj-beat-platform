-- DJ puede activar SoundForTips solo cuando está trabajando (botón público + cabina en otra pestaña)
ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS soundfortips_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dj_profiles.soundfortips_active IS 'True: perfil público muestra SOUNDFORTIPS; DJ usa pestaña cabina (sft_booth) al activar.';
