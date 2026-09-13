-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Agrega clave foránea user_id a certificates y actualiza políticas RLS

ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates(user_id);

-- Backfill: vincula certificados históricos (sin user_id) por email, cuando
-- ese email coincide con una cuenta real -- puente de una sola vez para no
-- dejar huérfanos los certificados emitidos antes de esta migración.
UPDATE public.certificates c
SET user_id = u.id
FROM auth.users u
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND lower(trim(c.email)) = lower(trim(u.email));

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certificates' AND policyname = 'Public read certificates'
  ) THEN
    CREATE POLICY "Public read certificates"
      ON public.certificates
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certificates' AND policyname = 'Authenticated users manage certificates'
  ) THEN
    CREATE POLICY "Authenticated users manage certificates"
      ON public.certificates
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Confirmación de esquema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'certificates' AND column_name = 'user_id';
