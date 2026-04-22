-- Contacto del cliente en factura/cotización manual (ventas en vivo).
ALTER TABLE public.mdj_staff_manual_invoices
  ADD COLUMN IF NOT EXISTS client_phone text NULL,
  ADD COLUMN IF NOT EXISTS client_email text NULL;

COMMENT ON COLUMN public.mdj_staff_manual_invoices.client_phone IS 'Teléfono de contacto del cliente (p. ej. llamada en curso).';
COMMENT ON COLUMN public.mdj_staff_manual_invoices.client_email IS 'Correo de contacto del cliente.';
