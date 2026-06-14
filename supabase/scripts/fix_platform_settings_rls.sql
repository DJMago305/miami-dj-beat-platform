-- Permitir que los administradores (staff_management) puedan escribir en cualquier clave de platform_settings
-- Anteriormente estaba limitado solo a 'mdjpro_%', lo que causaba errores RLS al guardar precios, videos y música.

DROP POLICY IF EXISTS "Staff management can write mdjpro settings" ON platform_settings;
DROP POLICY IF EXISTS "Staff management can write all settings" ON platform_settings;

CREATE POLICY "Staff management can write all settings"
  ON platform_settings
  FOR ALL
  TO authenticated
  USING (
    public.is_staff_management(auth.uid())
  )
  WITH CHECK (
    public.is_staff_management(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
