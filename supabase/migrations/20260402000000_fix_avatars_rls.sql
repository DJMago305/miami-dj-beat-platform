-- Limpiar políticas anteriores conflictivas (o bloqueadas)
DROP POLICY IF EXISTS "Avatar allow select" ON storage.objects;
DROP POLICY IF EXISTS "Avatar allow insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatar allow update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar allow upsert" ON storage.objects;
DROP POLICY IF EXISTS "Avatar allow delete" ON storage.objects;

-- Asegurar que el bucket de Avatares sea globalmente público para que renderice
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- NOTA: Se eliminó la línea de ALTER TABLE ENABLE RLS debido a que el servidor de Supabase
-- ya lo hace de forma nativa por motivos de seguridad en schemas privados y arroja error 42501.

-- 1. LECTURA (Select): Permitir que la foto sea visible a todos tras ser conectada
CREATE POLICY "Avatar allow select" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- 2. ESCRITURA (Insert): Permitir subir foto SOLO en tu propia carpeta ID
CREATE POLICY "Avatar allow insert" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. REEMPLAZO (Update/Upsert): VITAL — Permite pisar la foto anterior con la nueva
CREATE POLICY "Avatar allow update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. BOLETÍN (Delete): Permitir al usuario purgar datos temporales de sí mismo
CREATE POLICY "Avatar allow delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
