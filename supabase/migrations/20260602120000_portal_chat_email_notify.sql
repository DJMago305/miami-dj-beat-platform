-- Portal chat → email notifications (debounce state + DB trigger hook)
-- Email body/send: Edge Function notify-portal-message (Resend).
-- Captain: set service_role JWT on trigger (see supabase/scripts/portal_messages_email_trigger_manual.sql).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Debounce: max one email per lead + direction every 2 minutes (enforced in Edge Function).
CREATE TABLE IF NOT EXISTS public.portal_chat_email_notify_log (
    lead_id      uuid NOT NULL,
    direction    text NOT NULL CHECK (direction IN ('client_to_staff', 'staff_to_client')),
    last_sent_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (lead_id, direction)
);

COMMENT ON TABLE public.portal_chat_email_notify_log IS
    'Last portal chat email sent per lead and direction; used by notify-portal-message debounce (2 min).';

ALTER TABLE public.portal_chat_email_notify_log ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role / Edge Function (bypasses RLS) writes.

DROP TRIGGER IF EXISTS portal_message_insert_notify ON public.portal_messages;
DROP FUNCTION IF EXISTS public.trigger_portal_message_notify();

CREATE OR REPLACE FUNCTION public.trigger_portal_message_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    notify_url  text := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/notify-portal-message';
    svc_key     text;
    portal_sec  text;
BEGIN
    -- Optional: SET in SQL Editor after deploy:
    --   ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJ...';
    -- Or paste JWT directly in portal_messages_email_trigger_manual.sql
    svc_key := nullif(trim(current_setting('app.settings.service_role_key', true)), '');
    portal_sec := nullif(trim(current_setting('app.settings.portal_notify_secret', true)), '');

    IF svc_key IS NULL THEN
        RAISE WARNING 'portal_message notify skipped: app.settings.service_role_key not configured';
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
$$;

COMMENT ON FUNCTION public.trigger_portal_message_notify() IS
    'AFTER INSERT on portal_messages → pg_net POST to notify-portal-message (non-blocking for chat UI).';

CREATE TRIGGER portal_message_insert_notify
    AFTER INSERT ON public.portal_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_portal_message_notify();

NOTIFY pgrst, 'reload schema';
