-- ═══════════════════════════════════════════════════════════
-- Miami DJ Beat — Agenda & Communication Schema
-- ═══════════════════════════════════════════════════════════

-- 1. Tabla de Eventos Asignados
CREATE TABLE IF NOT EXISTS public.dj_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    venue TEXT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME WITHOUT TIME ZONE,
    end_time TIME WITHOUT TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('CONFIRMED', 'CANCELLED', 'RESIDENT')),
    notes TEXT,
    docs JSONB DEFAULT '[]'::jsonb, -- Array de {name, url, type}
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Comunicaciones del Manager
CREATE TABLE IF NOT EXISTS public.dj_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'urgent', 'update')),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Seguridad (RLS)
ALTER TABLE public.dj_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj_communications ENABLE ROW LEVEL SECURITY;

-- Políticas para dj_events
DROP POLICY IF EXISTS "DJs can view own events" ON public.dj_events;
CREATE POLICY "DJs can view own events" 
ON public.dj_events FOR SELECT 
USING (auth.uid() = dj_user_id);

-- Políticas para dj_communications
DROP POLICY IF EXISTS "DJs can view own communications" ON public.dj_communications;
CREATE POLICY "DJs can view own communications" 
ON public.dj_communications FOR SELECT 
USING (auth.uid() = dj_user_id);

-- 4. Almacenamiento (Bucket para documentos de eventos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-docs', 'event-docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage
DROP POLICY IF EXISTS "Public View Event Docs" ON storage.objects;
CREATE POLICY "Public View Event Docs" ON storage.objects FOR SELECT USING (bucket_id = 'event-docs');

-- 5. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_events_date ON public.dj_events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_user ON public.dj_events(dj_user_id);
CREATE INDEX IF NOT EXISTS idx_comm_user ON public.dj_communications(dj_user_id);

-- Forzar recarga de esquema
NOTIFY pgrst, 'reload schema';
