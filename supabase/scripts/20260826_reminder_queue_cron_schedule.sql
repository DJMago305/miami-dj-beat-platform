-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-08-26
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Dispara send-reminder-sms cada 10 minutos. Usa vault.decrypted_secrets
-- (columna decrypted_secret, NO "secret" — esa sigue cifrada) para leer
-- CRON_EDGE_AUTH_SECRET sin que el valor real quede visible en cron.job.
-- cron.schedule() con un jobname que ya existe lo actualiza en el mismo
-- id en vez de duplicarlo — seguro de correr más de una vez.
-- ============================================================

select cron.schedule(
  'dispatch_contract_reminders_cron',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/send-reminder-sms',
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
