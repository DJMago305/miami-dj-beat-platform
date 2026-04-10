-- web/sql/migrations/06_rls_identity_bypass.sql
-- MDJPRO IDENTITY SHIELD - RLS BYPASS - MODO MILITAR

-- 1. Liberar acceso de lectura anónima para resolución de identidad en dj_profiles
DROP POLICY IF EXISTS "Permitir resolución de identidad pública" ON public.dj_profiles;
CREATE POLICY "Permitir resolución de identidad pública" 
ON public.dj_profiles 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- 2. Liberar acceso de lectura anónima para resolución de identidad en client_profiles
DROP POLICY IF EXISTS "Permitir resolución de identidad pública clientes" ON public.client_profiles;
CREATE POLICY "Permitir resolución de identidad pública clientes" 
ON public.client_profiles 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- 3. Verificación de datos del CEO (DJMago305)
UPDATE public.dj_profiles 
SET stage_name = 'DJMago305',
    dj_name = 'DJMago305'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'djmago305@gmail.com');

-- 4. Audit
COMMENT ON POLICY "Permitir resolución de identidad pública" ON public.dj_profiles IS 'Habilita el login híbrido permitiendo que el sistema busque el email por nombre artístico.';
