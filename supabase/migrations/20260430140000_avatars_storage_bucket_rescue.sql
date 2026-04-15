-- ═══════════════════════════════════════════════════════════════════════════
-- RESCATE STORAGE: bucket `avatars` + políticas (producción)
-- ═══════════════════════════════════════════════════════════════════════════
-- Síntoma frontend: "bucket avatars missing or misconfigured"
-- Causa típica: el bucket no existe en storage.buckets, o public=false, o faltan
-- políticas en storage.objects.
--
-- Aplicar: Supabase Dashboard → SQL → ejecutar este archivo (o `supabase db push`).
-- El frontend sube a: `{auth.uid()}/avatar.{ext}` (ver account-settings.html).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Bucket: nombre exacto `avatars`, lectura pública para URLs públicas del header
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  name   = EXCLUDED.name;

UPDATE storage.buckets
SET public = true
WHERE id = 'avatars';

-- 2) Políticas (reemplazo idempotente; alinea con políticas previas del repo)
DROP POLICY IF EXISTS "Avatar allow select" ON storage.objects;
DROP POLICY IF EXISTS "Avatar allow insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatar allow update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar allow upsert" ON storage.objects;
DROP POLICY IF EXISTS "Avatar allow delete" ON storage.objects;

-- Política 1 — SELECT: cualquiera (incl. anon) puede leer objetos del bucket avatars
CREATE POLICY "Avatar allow select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Política 2 — INSERT: solo autenticados, solo en carpeta = su user id (primer segmento del path)
CREATE POLICY "Avatar allow insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política 3 — UPDATE: mismo dueño (upsert / sobrescribir avatar)
CREATE POLICY "Avatar allow update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política 4 — DELETE: solo el dueño de su carpeta
CREATE POLICY "Avatar allow delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

NOTIFY pgrst, 'reload schema';
