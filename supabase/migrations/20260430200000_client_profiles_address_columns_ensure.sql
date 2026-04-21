-- Asegura columnas de dirección en client_profiles (producción puede no tener 20260428120000 aplicada;
-- PostgREST: "Could not find the 'address_apt' column ... in the schema cache").
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_apt TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT;

COMMENT ON COLUMN public.client_profiles.address_country IS 'Full English country name (e.g. United States) for display + legal consistency.';
COMMENT ON COLUMN public.client_profiles.city IS 'City (billing / events); canonical with account settings.';
-- Tras aplicar en el Dashboard, si el error de “schema cache” persiste unos segundos: Settings → API → Reload schema (o nueva sesión del navegador).
