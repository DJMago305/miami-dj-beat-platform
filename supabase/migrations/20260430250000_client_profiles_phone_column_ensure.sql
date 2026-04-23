-- Account settings saves phone on client_profiles; some projects created the table without this column.
-- Error: "Could not find the 'phone' column of 'client_profiles' in the schema cache"
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.client_profiles.phone IS 'Contact phone; account-settings + auth user_metadata.phone.';
