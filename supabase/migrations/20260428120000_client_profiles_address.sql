-- Billing / event address on client_profiles (synced from account settings + auth metadata)
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_apt TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT;

COMMENT ON COLUMN public.client_profiles.address_country IS 'Full English country name (e.g. United States) for display + legal consistency.';
COMMENT ON COLUMN public.client_profiles.city IS 'City (billing / events); canonical with account settings.';
