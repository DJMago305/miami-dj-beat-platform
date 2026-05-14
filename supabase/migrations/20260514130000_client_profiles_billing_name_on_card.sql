-- Cardholder / invoice name for buyer billing (as printed on card).
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS billing_name_on_card text;

COMMENT ON COLUMN public.client_profiles.billing_name_on_card IS
  'Name as it appears on the payment card or formal invoices (may differ from full_name).';
