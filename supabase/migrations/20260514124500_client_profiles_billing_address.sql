-- Separate billing address when it differs from home (client account).
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS billing_same_as_home boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_street text,
  ADD COLUMN IF NOT EXISTS billing_apt text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_state text,
  ADD COLUMN IF NOT EXISTS billing_zip text,
  ADD COLUMN IF NOT EXISTS billing_country text;

COMMENT ON COLUMN public.client_profiles.billing_same_as_home IS
  'When true, invoices use home address (address_* / city). When false, use billing_* columns.';
COMMENT ON COLUMN public.client_profiles.billing_country IS
  'Full English country name (e.g. United States), same convention as address_country.';
