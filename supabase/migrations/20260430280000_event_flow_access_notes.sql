-- Acceso/portería: dato operativo para el equipo (va con Event Flow impreso), no en factura.
ALTER TABLE public.mdj_event_flows
  ADD COLUMN IF NOT EXISTS access_notes text NULL;

COMMENT ON COLUMN public.mdj_event_flows.access_notes IS
  'Código portería, nombre en recepción, etc. — para talento que entra al local con el flow.';
