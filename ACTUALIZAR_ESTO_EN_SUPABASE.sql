-- 🚨 SCRIPT FINAL DEFINITIVO - CORRER TODO DE UNA VEZ 🚨
-- Este código asegura que tu perfil existe y que puedes subir fotos.

-- 1. ASEGURAR COLUMNAS EN DJ_PROFILES
ALTER TABLE public.dj_profiles 
ADD COLUMN IF NOT EXISTS stage_name TEXT,
ADD COLUMN IF NOT EXISTS bio_short TEXT,
ADD COLUMN IF NOT EXISTS bio_long TEXT,
ADD COLUMN IF NOT EXISTS current_venue TEXT,
ADD COLUMN IF NOT EXISTS venue_schedule TEXT,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'es',
ADD COLUMN IF NOT EXISTS auto_translate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS photo_focal_y INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS background_url TEXT,
ADD COLUMN IF NOT EXISTS availability_schedule JSONB DEFAULT '{"schedule": {}, "recurring_days": []}'::jsonb,
ADD COLUMN IF NOT EXISTS social_apple TEXT,
ADD COLUMN IF NOT EXISTS social_web TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. ASEGURAR QUE TU FILA DE PERFIL EXISTE
-- Si por algún motivo no hay perfil para tu usuario, esto lo crea con datos básicos.
INSERT INTO public.dj_profiles (user_id, dj_name, status, plan)
SELECT id, email, 'ACTIVE', 'LITE'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.dj_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 3. CREAR BUCKET 'dj-photos' CON ACCESO PÚBLICO
INSERT INTO storage.buckets (id, name, public)
VALUES ('dj-photos', 'dj-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. POLÍTICAS DE ALMACENAMIENTO (RESETEAR Y CREAR)
DROP POLICY IF EXISTS "Public View" ON storage.objects;
CREATE POLICY "Public View" ON storage.objects FOR SELECT USING (bucket_id = 'dj-photos');

DROP POLICY IF EXISTS "Owner Upload" ON storage.objects;
CREATE POLICY "Owner Upload" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'dj-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owner Update" ON storage.objects;
CREATE POLICY "Owner Update" ON storage.objects FOR UPDATE 
USING (bucket_id = 'dj-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. ACTUALIZAR CACHÉ DE SUPABASE (CRÍTICO)
-- Esto obliga a Supabase a reconocer las nuevas columnas inmediatamente.
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- LISTO. Borra el SQL Editor, pega esto y pulsa RUN.
-- ═══════════════════════════════════════════════════════════════
