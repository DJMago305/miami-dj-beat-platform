-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- YA APLICADO el 2026-09-21 (a pedido del PO, "soluciona esa").
-- Vulnerabilidad #2 de la auditoría de funciones SECURITY DEFINER abiertas a anon:
-- cron_dispatch_pending_reminders() (despachador de recordatorios SMS a DJs) era ejecutable por cualquiera.
-- Solo la usa pg_cron (job dispatch_sms_reminders_cron, cada 2 min, corre como `postgres`, dueño de la función,
-- que conserva sus permisos). Sin llamadores en web/ ni en edge functions. No cambia el código de la función.
-- Severidad real tras leer el código: BAJA (no elige destinatario ni texto, devuelve void, solo procesa lo ya
-- vencido, idempotente por FOR UPDATE SKIP LOCKED).
--
-- Se revoca de PUBLIC (no basta con anon: lo hereda de PUBLIC) y de anon/authenticated; service_role conserva.

revoke execute on function public.cron_dispatch_pending_reminders() from public;
revoke execute on function public.cron_dispatch_pending_reminders() from anon, authenticated;
