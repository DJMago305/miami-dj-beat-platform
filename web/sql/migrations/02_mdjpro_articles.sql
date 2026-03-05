-- web/sql/migrations/02_mdjpro_articles.sql
-- MDJPRO MAGAZINE & TIPS MODULE - MODO MILITAR

-- 1. Table for Articles
CREATE TABLE IF NOT EXISTS public.mdjpro_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Magazine', 'Tips', 'News')),
    target_audience TEXT NOT NULL CHECK (target_audience IN ('DJs', 'Clients', 'All')),
    content TEXT NOT NULL,
    excerpt TEXT,
    image_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    author TEXT DEFAULT 'Miami DJ Beat'
);

-- 2. Initial Data for Home Launch
INSERT INTO public.mdjpro_articles (title, slug, category, target_audience, content, excerpt, image_url, is_featured) 
VALUES
('5 Consejos para una Boda Inolvidable', '5-consejos-boda-inolvidable', 'Tips', 'Clients', '...', 'Descubre cómo asegurar que la música de tu boda sea perfecta desde la ceremonia hasta la hora loca.', './assets/articles/wedding-tips.png', true),
('El Arte del Beatmatching Pro', 'arte-beatmatching-pro', 'Magazine', 'DJs', '...', 'Técnicas avanzadas para DJs que buscan perfeccionar sus transiciones en vivo.', './assets/articles/dj-matching.png', true),
('Tendencias de Iluminación 2026', 'tendencias-iluminacion-2026', 'News', 'All', '...', 'Conoce lo último en tecnología LED y efectos especiales para eventos de lujo.', './assets/articles/lighting-2026.png', false)
ON CONFLICT (slug) DO NOTHING;

-- 3. RLS (Row Level Security)
ALTER TABLE public.mdjpro_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public View Articles" ON public.mdjpro_articles 
FOR SELECT USING (is_published = true);
