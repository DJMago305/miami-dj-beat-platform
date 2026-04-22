-- Dirección de facturación vs lugar del evento + notas de acceso (portería, código, etc.)
ALTER TABLE public.mdj_staff_manual_invoices
  ADD COLUMN IF NOT EXISTS billing_address text NULL,
  ADD COLUMN IF NOT EXISTS event_address text NULL,
  ADD COLUMN IF NOT EXISTS access_notes text NULL;

COMMENT ON COLUMN public.mdj_staff_manual_invoices.billing_address IS 'Dirección de facturación / cliente (puede diferir del venue del evento).';
COMMENT ON COLUMN public.mdj_staff_manual_invoices.event_address IS 'Lugar del evento o donde se presta el servicio.';
COMMENT ON COLUMN public.mdj_staff_manual_invoices.access_notes IS 'Código portería, nombre en puerta, instrucciones para seguridad, etc.';

NOTIFY pgrst, 'reload schema';
