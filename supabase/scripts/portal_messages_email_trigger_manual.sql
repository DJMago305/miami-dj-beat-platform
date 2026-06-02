-- MANUAL (Supabase SQL Editor): wire portal_messages INSERT → notify-portal-message
--
-- Prerequisites:
--   1) Migration 20260602120000_portal_chat_email_notify.sql applied (debounce table + trigger shell)
--   2) Edge Function notify-portal-message deployed (--no-verify-jwt)
--   3) Edge secrets: RESEND_API_KEY, MDJ_OWNER_EMAIL, SUPABASE_SERVICE_ROLE_KEY (auto),
--      optional: SITE_URL, FROM_EMAIL, PORTAL_NOTIFY_SECRET
--
-- Service role JWT: Dashboard → Project Settings → API → Legacy JWT → service_role (starts with eyJ...)
-- Do NOT use sb_secret_* alone if the function returns 401 and logs stay empty.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS portal_message_insert_notify ON public.portal_messages;
DROP FUNCTION IF EXISTS public.trigger_portal_message_notify();

CREATE OR REPLACE FUNCTION public.trigger_portal_message_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  notify_url text := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/notify-portal-message';
  svc_key    text := $key$PEGA_AQUI_TU_SERVICE_ROLE_JWT_eyJ$key$;
  portal_sec text := nullif(trim($key$OPCIONAL_PORTAL_NOTIFY_SECRET$key$), 'OPCIONAL_PORTAL_NOTIFY_SECRET');
BEGIN
  IF svc_key IS NULL OR svc_key LIKE '%PEGA_AQUI%' THEN
    RAISE WARNING 'portal_message notify skipped: paste service_role JWT in trigger SQL';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := notify_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ) || CASE
      WHEN portal_sec IS NOT NULL THEN jsonb_build_object('x-portal-notify-secret', portal_sec)
      ELSE '{}'::jsonb
    END,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'portal_messages',
      'schema', 'public',
      'record', to_jsonb(NEW)
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'portal_message notify failed: %', SQLERRM;
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER portal_message_insert_notify
  AFTER INSERT ON public.portal_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_portal_message_notify();

-- Quick test (replace LEAD_UUID): insert a row as client in portal, then check Edge Logs.
