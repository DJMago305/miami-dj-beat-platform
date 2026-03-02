-- 🔒 MDJPRO 2027: SQL SECURITY LOCKDOWN (HARDENED v2)
-- Ejecuta estos comandos en el SQL Editor de tu Supabase.

-- IMPORTANTE: Para que estas políticas funcionen, debes asignar el rol en app_metadata del usuario.
-- Ejemplo SQL para asignarte a ti mismo como manager:
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role": "manager"}' WHERE email = 'tu-email@ejemplo.com';

-- 1. Habilitar RLS en las tablas críticas
ALTER TABLE dj_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS PARA DJ_PROFILES
-- Solo los Managers pueden ver todos los perfiles (basado en app_metadata)
CREATE POLICY "Managers pueden ver todo" ON dj_profiles
FOR SELECT TO authenticated
USING ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager' );

-- Los DJs solo pueden ver y editar SU propio perfil
CREATE POLICY "DJs ven su propio perfil" ON dj_profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "DJs editan su propio perfil" ON dj_profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 3. POLÍTICAS PARA LEADS (CLIENTES)
-- El público puede INSERTAR leads (desde el formulario web)
CREATE POLICY "Publico puede enviar leads" ON leads
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- SOLO los Managers pueden VER los leads de los clientes (basado en app_metadata)
CREATE POLICY "Solo Managers ven leads" ON leads
FOR SELECT TO authenticated
USING ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager' );

-- 4. COMENTARIO TÉCNICO
COMMENT ON TABLE leads IS 'Tabla protegida. Acceso restringido a Managers mediante app_metadata.';
