-- web/sql/migrations/CONSOLIDATED_BEATS_TIPS.sql
-- 🛡️ MDJPRO CONSOLIDATED ARTICLE INFRASTRUCTURE - MODO MILITAR

-- 1. Create the articles table
CREATE TABLE IF NOT EXISTS public.mdjpro_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Magazine', 'Tips', 'News')),
    target_audience TEXT NOT NULL CHECK (target_audience IN ('DJs', 'Clients', 'All')),
    content TEXT NOT NULL,
    excerpt TEXT,
    image_url TEXT,
    is_published BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    author TEXT DEFAULT 'Miami DJ Beat',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.mdjpro_articles ENABLE ROW LEVEL SECURITY;

-- 3. Create Public Read Policy
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'mdjpro_articles' AND policyname = 'Public can read published articles'
    ) THEN
        CREATE POLICY "Public can read published articles" 
        ON public.mdjpro_articles 
        FOR SELECT 
        USING (is_published = true);
    END IF;
END $$;

-- 4. INSERT FIRST LUXURY ARTICLE: "Los héroes invisibles de la pista"
INSERT INTO public.mdjpro_articles (title, slug, category, target_audience, content, excerpt, image_url, is_featured, author) 
VALUES (
    'Los héroes invisibles de la pista', 
    'heroes-invisibles-pista', 
    'Magazine', 
    'All', 
    '<p>Cuando alguien escucha la palabra <strong>DJ</strong>, la mente suele viajar de inmediato a los grandes festivales del planeta. Escenarios gigantescos, pantallas LED, fuegos artificiales y multitudes coreando cada drop. Es el universo de las superestrellas que dominan titulares y redes sociales.</p>

    <div class="article-quote">"¿Qué ocurre con el DJ que trabaja cada noche en la primera línea? El que está en el bar de tu barrio, el que toca en un restaurante, el que anima una fiesta privada..."</div>

    <p>Nada de eso ocurre por casualidad. Detrás de esos artistas existe una maquinaria profesional perfectamente engranada. Pero hay una pregunta que rara vez se plantea: <strong>¿Qué ocurre con el arquitecto invisible que construye la atmósfera de tu noche favorita?</strong></p>

    <img src="./assets/articles/dj_hands_mixer_horizontal_magazine_1772698495862.png" class="article-img" alt="Héroe Invisible Detrás de la Cabina">

    <h3>La Conexión Real</h3>
    <p>Imagina la escena. Llegas a un club sin expectativas. No sabes el nombre del DJ. Pero algo empieza a suceder. El ambiente se transforma. La gente comienza a bailar. Sin darte cuenta, conoces a alguien, ríes, vives. Ese DJ anónimo es el responsable de una de las noches más memorables de tu vida.</p>

    <p>Un DJ profesional está leyendo cada latido de la sala. No hay efectos especiales, pero sí la conexión directa con el público. Son ellos quienes prueban música nueva y sostienen la cultura desde abajo.</p>

    <img src="./assets/articles/dj_crowd_blur_horizontal_magazine_1772698511764.png" class="article-img" alt="Conexión en la pista de baile">

    <h3>El Corazón del Movimiento</h3>
    <p>La cultura DJ no vive únicamente en los grandes escenarios. Vive en los clubes pequeños, en los bares, en cada cabina donde alguien construye una experiencia para el presente. Tal vez nunca supiste su nombre, pero él fue el arquitecto de tu felicidad.</p>

    <p style="text-align:center; font-family: Playfair Display; font-style: italic; color: var(--gold); font-size: 24px;">Que viva la cultura DJ. Y que vivan los DJs. 🎧</p>', 
    'Crónicas del Mundo DJ: Un homenaje a los arquitectos invisibles de la atmósfera nocturna y la conexión real en la pista.', 
    './assets/articles/dj_hands_mixer_horizontal_magazine_1772698495862.png', 
    true, 
    'Miami DJ Beat Editorial'
)
ON CONFLICT (slug) DO UPDATE SET 
    content = EXCLUDED.content,
    excerpt = EXCLUDED.excerpt,
    image_url = EXCLUDED.image_url;
