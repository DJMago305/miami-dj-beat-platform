-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Ticket "FASE 2 CALENDARIOS
-- (OAUTH + WEBHOOKS)" (2026-09-01).
--
-- Hallazgo real revisando la documentación oficial vigente de Google Calendar
-- push notifications antes de escribir el webhook: cada canal de escucha
-- (events.watch) tiene su propio channel_id + resourceId, y CADA notificación
-- entrante solo trae esos dos valores en headers (X-Goog-Channel-ID /
-- X-Goog-Resource-ID) -- el cuerpo de la petición viene VACÍO, sin user_id ni
-- nada identificable. La tabla de fase 1 (user_calendar_integrations) no
-- tenía dónde guardar esos dos valores -- sin ellos, el webhook no puede
-- saber a qué usuario pertenece una notificación entrante. Se agregan aquí,
-- antes de escribir calendar-sync-webhook.

ALTER TABLE public.user_calendar_integrations
  ADD COLUMN IF NOT EXISTS channel_id text,
  ADD COLUMN IF NOT EXISTS channel_resource_id text,
  ADD COLUMN IF NOT EXISTS channel_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_calendar_integrations_channel_id
  ON public.user_calendar_integrations (channel_id)
  WHERE channel_id IS NOT NULL;

COMMENT ON COLUMN public.user_calendar_integrations.channel_id IS
  'id del canal de events.watch (Google) que enviamos nosotros al crear la suscripción push -- viaja de vuelta en el header X-Goog-Channel-ID de cada notificación entrante.';
COMMENT ON COLUMN public.user_calendar_integrations.channel_resource_id IS
  'resourceId que Google devuelve al crear el canal -- lo exige el endpoint stop (channels.stop) para cancelar la suscripción.';

NOTIFY pgrst, 'reload schema';
