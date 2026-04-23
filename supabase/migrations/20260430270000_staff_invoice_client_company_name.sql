-- Nombre del comprador (persona) vs empresa opcional (una sola plantilla).
ALTER TABLE public.mdj_staff_manual_invoices
  ADD COLUMN IF NOT EXISTS client_company_name text NULL;

COMMENT ON COLUMN public.mdj_staff_manual_invoices.client_label IS
  'Nombre del comprador (persona física que firma o contrata).';
COMMENT ON COLUMN public.mdj_staff_manual_invoices.client_company_name IS
  'Opcional: razón social o nombre comercial si quien contrata es empresa.';
