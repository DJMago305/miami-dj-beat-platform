-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Dispara calendar-reconcile cada 6 horas (minuto 30, para no chocar con calendar-channel-renew):
-- iguala nuestro calendario con Google (Google manda), incluidas las eliminaciones y el calendario de
-- cumpleaños de contactos, que el webhook no cubre. Mismo secreto/patrón que renew_google_calendar_channels_cron.
-- cron.schedule() con un jobname existente lo actualiza: seguro de correr más de una vez.
select cron.schedule(
  'reconcile_google_calendar_cron',
  '30 */6 * * *',
  $$
  select net.http_post(
    url := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/calendar-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_edge_auth_secret_reminders'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- 2026-09-20: primera corrida real OK (las 4 integraciones sincronizaron en ~5 s). pg_net corta a los 5 s por defecto
-- y la respuesta salía como timeout aunque la función terminaba; timeout_milliseconds := 60000 lo corrige.
