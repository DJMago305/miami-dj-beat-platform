-- web/sql/migrations/01_blindaje_infrae.sql
-- MDJPRO TECHNICAL SHIELD - MODO MILITAR

-- 1. Table for Dynamic Manuals
CREATE TABLE IF NOT EXISTS public.mdjpro_manuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    lang TEXT NOT NULL CHECK (lang IN ('es', 'en', 'pt', 'fr', 'it', 'de')),
    file_path TEXT NOT NULL,
    version TEXT DEFAULT 'v18',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lang) -- One active manual per language for this specific entity
);

-- 2. Initial Data for v18 Manuals
INSERT INTO public.mdjpro_manuals (title, lang, file_path, version) 
VALUES
('Manual Oficial MDJPRO', 'es', './downloads/MDJPRO-Manual-ES.pdf', 'v18'),
('Official MDJPRO Manual', 'en', './downloads/MDJPRO-Manual-EN.pdf', 'v18'),
('Manual Oficial MDJPRO', 'pt', './downloads/MDJPRO-Manual-PT.pdf', 'v18'),
('Manuel Officiel MDJPRO', 'fr', './downloads/MDJPRO-Manual-FR.pdf', 'v18'),
('Manuale Ufficiale MDJPRO', 'it', './downloads/MDJPRO-Manual-IT.pdf', 'v18'),
('MDJPRO Offizielles Handbuch', 'de', './downloads/MDJPRO-Manual-DE.pdf', 'v18')
ON CONFLICT (lang) DO UPDATE 
SET file_path = EXCLUDED.file_path, version = EXCLUDED.version;

-- 3. Extend DJ Profiles with Advanced Social Fields (if not existing)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dj_profiles' AND column_name='beatport_url') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN beatport_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dj_profiles' AND column_name='apple_music_url') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN apple_music_url TEXT;
    END IF;
END $$;

-- 4. RLS (Row Level Security) - MDJPRO PROTECTION
ALTER TABLE public.mdjpro_manuals ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view manuals
CREATE POLICY "Public View Manuals" ON public.mdjpro_manuals 
FOR SELECT USING (true);
