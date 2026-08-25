-- ========================================================
-- INSTALADOR DE ARQUITECTURA: MOTOR DE RECORDATORIOS SMS
-- ========================================================
-- Este script crea la infraestructura completa de notificaciones
-- usando pg_cron y pg_net de manera 100% nativa.

-- 1. Habilitar extensiones (si no están habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ==========================================
-- 2. TABLA SECUNDARIA: EVENTOS CONFIRMADOS
-- ==========================================
-- Migración del JSON a una tabla tipada fuertemente para poder usar Triggers
CREATE TABLE IF NOT EXISTS public.booked_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_id UUID REFERENCES public.dj_profiles(user_id) ON DELETE CASCADE,
    venue TEXT NOT NULL,
    city TEXT DEFAULT 'Miami, FL',
    start_time TIMESTAMPTZ NOT NULL, -- Siempre almacenar en UTC
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. TABLA DE COLA: RECORDATORIOS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.event_reminders_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_id UUID REFERENCES public.dj_profiles(user_id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.booked_events(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    reminder_type TEXT CHECK (reminder_type IN ('24h', '2h', '30m')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, reminder_type) -- Un evento solo puede tener un recordatorio de cada tipo
);

-- Index para optimizar la búsqueda del Cron Job
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON public.event_reminders_queue (scheduled_for) WHERE status = 'pending';

-- ==========================================
-- 4. TRIGGER: AUTO-GENERADOR DE RECORDATORIOS
-- ==========================================
-- Genera automáticamente las marcas de T-24h, T-2h y T-30m cuando un evento se crea o modifica

CREATE OR REPLACE FUNCTION public.trg_schedule_event_reminders()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el evento fue cancelado, invalidar recordatorios futuros
    IF NEW.status = 'CANCELLED' THEN
        UPDATE public.event_reminders_queue 
        SET status = 'failed' 
        WHERE event_id = NEW.id AND status IN ('pending', 'processing');
        RETURN NEW;
    END IF;

    -- Upsert T-24h
    IF (NEW.start_time - INTERVAL '24 hours') > NOW() THEN
        INSERT INTO public.event_reminders_queue (dj_id, event_id, scheduled_for, reminder_type)
        VALUES (NEW.dj_id, NEW.id, NEW.start_time - INTERVAL '24 hours', '24h')
        ON CONFLICT (event_id, reminder_type) 
        DO UPDATE SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = NOW();
    END IF;

    -- Upsert T-2h
    IF (NEW.start_time - INTERVAL '2 hours') > NOW() THEN
        INSERT INTO public.event_reminders_queue (dj_id, event_id, scheduled_for, reminder_type)
        VALUES (NEW.dj_id, NEW.id, NEW.start_time - INTERVAL '2 hours', '2h')
        ON CONFLICT (event_id, reminder_type) 
        DO UPDATE SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = NOW();
    END IF;

    -- Upsert T-30m
    IF (NEW.start_time - INTERVAL '30 minutes') > NOW() THEN
        INSERT INTO public.event_reminders_queue (dj_id, event_id, scheduled_for, reminder_type)
        VALUES (NEW.dj_id, NEW.id, NEW.start_time - INTERVAL '30 minutes', '30m')
        ON CONFLICT (event_id, reminder_type) 
        DO UPDATE SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atar el trigger a la tabla
DROP TRIGGER IF EXISTS trigger_schedule_reminders ON public.booked_events;
CREATE TRIGGER trigger_schedule_reminders
AFTER INSERT OR UPDATE OF start_time, status ON public.booked_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_schedule_event_reminders();

-- ==========================================
-- 5. FUNCIÓN CRON DISPATCHER (Llamada HTTP a Edge Function)
-- ==========================================
CREATE OR REPLACE FUNCTION public.cron_dispatch_pending_reminders()
RETURNS void AS $$
DECLARE
    r RECORD;
    edge_url TEXT := 'https://[TU_PROYECTO_SUPABASE].supabase.co/functions/v1/notify-dj-sms';
    service_role_key TEXT := '<INSERTA_TU_SERVICE_ROLE_KEY>';
BEGIN
    -- Seleccionamos y bloqueamos las filas para evitar race conditions
    FOR r IN 
        SELECT id FROM public.event_reminders_queue 
        WHERE status = 'pending' AND scheduled_for <= NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Marcar inmediatamente como 'processing'
        UPDATE public.event_reminders_queue SET status = 'processing', updated_at = NOW() WHERE id = r.id;

        -- Despachar usando pg_net hacia nuestra Edge Function de Twilio
        PERFORM net.http_post(
            url := edge_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := jsonb_build_object('reminder_id', r.id)
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. CRON JOB: POLLING CADA 2 MINUTOS
-- ==========================================
-- Desagenda por si ya existía para evitar errores
SELECT cron.unschedule('dispatch_sms_reminders_cron');

-- Agenda el trabajo cada 2 minutos
SELECT cron.schedule(
  'dispatch_sms_reminders_cron',
  '*/2 * * * *', -- Ticks every 2 minutes
  $$ SELECT public.cron_dispatch_pending_reminders() $$
);
