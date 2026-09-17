-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-17
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Dispara calendar-channel-renew cada 6 horas para renovar los canales de
-- Google Calendar (events.watch) antes de que venzan (Google los expira a
-- los ~7 días, no se pueden "renovar" -- hay que crear uno nuevo). La propia
-- función solo toca los que vencen dentro de las próximas 24h, así que
-- correr esto varias veces al día no hace nada de más.
--
-- Reusa vault.decrypted_secrets → cron_edge_auth_secret_reminders, el MISMO
-- secreto que ya usan dispatch_contract_reminders_cron / notify-dj-sms --
-- no se crea un secreto nuevo para lo mismo. cron.schedule() con un
-- jobname que ya existe lo actualiza en el mismo id en vez de duplicarlo —
-- seguro de correr más de una vez.
-- ============================================================

select cron.schedule(
  'renew_google_calendar_channels_cron',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/calendar-channel-renew',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_edge_auth_secret_reminders'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
