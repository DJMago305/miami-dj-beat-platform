-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr) -- PREPARADO, NO APLICADO.
-- Aplicar SOLO después de que el PO despliegue mdj-avisos-despachar con el cambio que acepta
-- `Authorization: Bearer $CRON_EDGE_AUTH_SECRET` (si se aplica antes, la función responde 401 y no pasa nada grave).
-- Vacía el buzón de avisos (avisos_pendientes) cada minuto y manda el push a los dispositivos activados.
-- Mismo secreto/patrón que reconcile_google_calendar_cron. cron.schedule() con un jobname existente lo actualiza.
select cron.schedule(
  'mdj_avisos_despachar_cron',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/mdj-avisos-despachar',
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

-- Para apagarlo: select cron.unschedule('mdj_avisos_despachar_cron');
-- Comprobación: select estado, count(*) from public.avisos_pendientes group by 1;
