-- Fase 2 (c): una integración por CALENDARIO de Google, no solo por usuario.
-- Hasta ahora user_calendar_integrations solo guardaba UN canal por
-- (user_id, provider) -- el calendario "primary". El PO pidió que los
-- cumpleaños (calendario especial de Google, distinto a primary) también se
-- sincronicen, así que cada usuario necesita hasta 2 filas: una para
-- "primary" y otra para el calendario de cumpleaños.

ALTER TABLE public.user_calendar_integrations
  ADD COLUMN IF NOT EXISTS calendar_id text NOT NULL DEFAULT 'primary';

COMMENT ON COLUMN public.user_calendar_integrations.calendar_id IS
  'ID del calendario de Google ("primary" o el calendario especial de '
  'cumpleaños, addressbook#contacts@group.v.calendar.google.com). Una fila '
  'por (user_id, provider, calendar_id).';

ALTER TABLE public.user_calendar_integrations
  DROP CONSTRAINT IF EXISTS user_calendar_integrations_user_provider_unique;

ALTER TABLE public.user_calendar_integrations
  ADD CONSTRAINT user_calendar_integrations_user_provider_calendar_unique
  UNIQUE (user_id, provider, calendar_id);

NOTIFY pgrst, 'reload schema';
