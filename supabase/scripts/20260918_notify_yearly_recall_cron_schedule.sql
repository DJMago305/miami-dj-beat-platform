-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-18
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Dispara notify-yearly-recall cada día a las 9:30 UTC -- 30 minutos DESPUÉS
-- de dispatch_yearly_recall_cron (0 9 * * *, ya existente, llama a
-- mdj-yearly-recall y llena event_reminders_queue con reminder_type=
-- 'yearly_recall'). El margen de 30 min es para no barrer la cola a mitad de
-- la inserción.
--
-- Reusa vault.decrypted_secrets -> cron_edge_auth_secret_reminders, el MISMO
-- secreto que ya usan dispatch_contract_reminders_cron / dispatch_yearly_
-- recall_cron / renew_google_calendar_channels_cron -- no se crea un secreto
-- nuevo para lo mismo. cron.schedule() con un jobname que ya existe lo
-- actualiza en el mismo id en vez de duplicarlo -- seguro de correr más de
-- una vez.
-- ============================================================

select cron.schedule(
  'notify_yearly_recall_cron',
  '30 9 * * *',
  $$
  select net.http_post(
    url := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/notify-yearly-recall',
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
