-- Platform UI language (synced from Account Settings + local i18n)
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';

COMMENT ON COLUMN public.client_profiles.language_preference IS 'UI locale: en | es. Drives i18n with localStorage mdjpro_lang.';

-- Normalize legacy NULLs
UPDATE public.client_profiles
SET language_preference = 'en'
WHERE language_preference IS NULL OR trim(language_preference) = '';
