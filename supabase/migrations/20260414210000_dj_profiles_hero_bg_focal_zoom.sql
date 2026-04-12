-- Hero público: encuadre horizontal + zoom (photo_focal_y ya existía para vertical)
ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS photo_focal_x smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS hero_bg_zoom smallint NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.dj_profiles.photo_focal_x IS 'Hero: object-position horizontal 0–100.';
COMMENT ON COLUMN public.dj_profiles.hero_bg_zoom IS 'Hero: scale percent (80–200 típico).';
