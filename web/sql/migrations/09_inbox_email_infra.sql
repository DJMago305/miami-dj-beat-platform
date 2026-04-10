-- 09_inbox_email_infra.sql
-- Fase 2: Infraestructura segura para Preferencias de Bandeja de Entrada

-- 1. Asegurar Esquema e Idempotencia de Columnas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dj_profiles' AND column_name='notify_inbox_email') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN notify_inbox_email BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dj_profiles' AND column_name='notify_inbox_sms') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN notify_inbox_sms BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dj_profiles' AND column_name='notify_inbox_push') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN notify_inbox_push BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 2. Gatillo Idempotente Seguro para Webhook (pg_net)
create extension if not exists pg_net with schema extensions;

DROP TRIGGER IF EXISTS event_note_insert_trigger ON public.event_notes;
DROP FUNCTION IF EXISTS public.trigger_event_note_webhook();

CREATE OR REPLACE FUNCTION public.trigger_event_note_webhook()
RETURNS trigger AS $$
BEGIN
  -- IMPORTANTE: Debes inyectar tus verdaderas llaves para desplegar esto a producción.
  perform net.http_post(
      url:='https://[SUPABASE_PROJECT_REF].supabase.co/functions/v1/notify-event-note',
      headers:=jsonb_build_object(
          'Content-Type', 'application/json', 
          'Authorization', 'Bearer [SUPABASE_ANON_KEY]',
          'x-webhook-secret', '[WEBHOOK_SECRET]'
      ),
      body:=jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER event_note_insert_trigger
AFTER INSERT ON public.event_notes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_event_note_webhook();
