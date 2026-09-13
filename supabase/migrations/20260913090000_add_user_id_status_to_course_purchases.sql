-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Cierra el circuito de acceso al curso ($197): course_purchases nunca tuvo
-- user_id ni status, así que el webhook solo dejaba un recibo (customer_email
-- suelto, sin FK) y ningún cliente autenticado podía siquiera leer su propia
-- fila (RLS estaba habilitado desde el origen sin ninguna política).

ALTER TABLE public.course_purchases
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

ALTER TABLE public.course_purchases
ADD CONSTRAINT course_purchases_status_check
CHECK (status IN ('completed', 'refunded', 'disputed'));

CREATE INDEX IF NOT EXISTS idx_course_purchases_user_id ON public.course_purchases (user_id);

-- RLS ya estaba ENABLE desde la migración original (20260411120000) sin
-- ninguna política -- deny-all real para cualquier cliente que no sea
-- service_role. El webhook (service_role) sigue escribiendo sin cambios;
-- esta política solo abre lectura al propio dueño de la compra.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_purchases' AND policyname = 'Users read own course purchases'
  ) THEN
    CREATE POLICY "Users read own course purchases"
      ON public.course_purchases
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Confirmación de esquema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'course_purchases' AND column_name IN ('user_id', 'status');
