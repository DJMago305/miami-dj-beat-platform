-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: "sí, importa
--   los 13 cumpleaños" (archivo aparte cumpleanos.csv, nunca formó
--   parte del lote FORM1-5 que se importó antes esta misma noche).
-- ============================================================
--
-- network_referencia_contactos no tenía columna de fecha de nacimiento.
-- Varias fechas del CSV traen año "1904"/"1604" -- son placeholders que
-- pone Outlook cuando la persona nunca puso el año real (columna propia
-- del CSV "Año_es_real" = "NO (placeholder Outlook)"); el mes/día sí es
-- dato real. Se guarda igual (para no perder el mes/día), pero con una
-- bandera aparte para que la interfaz nunca lo presente como un año
-- confirmado.

ALTER TABLE public.network_referencia_contactos
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS birth_date_year_conocido boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.network_referencia_contactos.birth_date_year_conocido IS 'false = el año de birth_date es un placeholder (ej. Outlook 1904/1604) -- solo el mes/día es dato real. true = año confirmado o la fecha se cargó a mano desde la ficha.';

-- Extiende network_referencia_actualizar con p_birth_date. Si el staff
-- edita la fecha desde el carrete de la ficha, se asume año real
-- (year_conocido vuelve a true) -- la bandera "año no confirmado" solo
-- la pone este backfill puntual, nunca la deja el RPC en false.
DROP FUNCTION IF EXISTS public.network_referencia_actualizar(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.network_referencia_actualizar(
    p_id         uuid,
    p_phone      text DEFAULT NULL,
    p_email      text DEFAULT NULL,
    p_photo_url  text DEFAULT NULL,
    p_birth_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes jsonb;
  v_phone text := NULLIF(trim(p_phone), '');
  v_email text := NULLIF(trim(p_email), '');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;

  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalido');
  END IF;

  SELECT to_jsonb(r) INTO v_antes FROM public.network_referencia_contactos r WHERE r.id = p_id;
  IF v_antes IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contacto_no_encontrado');
  END IF;

  UPDATE public.network_referencia_contactos
     SET telefono   = COALESCE(v_phone, telefono),
         email      = COALESCE(v_email, email),
         photo_url  = COALESCE(p_photo_url, photo_url),
         birth_date = COALESCE(p_birth_date, birth_date),
         birth_date_year_conocido = CASE WHEN p_birth_date IS NOT NULL THEN true ELSE birth_date_year_conocido END
   WHERE id = p_id;

  BEGIN
    PERFORM public.mdj_auditar(
      p_accion        => 'network_referencia_actualizar',
      p_recurso_tabla => 'network_referencia_contactos',
      p_recurso_id    => p_id::text,
      p_antes         => jsonb_build_object('telefono', v_antes->>'telefono', 'email', v_antes->>'email', 'photo_url', v_antes->>'photo_url', 'birth_date', v_antes->>'birth_date'),
      p_despues       => jsonb_build_object('telefono', COALESCE(v_phone, v_antes->>'telefono'), 'email', COALESCE(v_email, v_antes->>'email'), 'photo_url', COALESCE(p_photo_url, v_antes->>'photo_url'), 'birth_date', COALESCE(p_birth_date::text, v_antes->>'birth_date')),
      p_origen        => 'network'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_referencia_actualizar(uuid, text, text, text, date) TO authenticated;

-- Backfill: 2 de los 13 ya existían como contacto de referencia (se
-- encontraron por nombre en el lote de esta noche) -- se actualizan en
-- vez de duplicarse. Email se agrega solo si el contacto no tenía uno.
UPDATE public.network_referencia_contactos
   SET birth_date = '1604-02-21', birth_date_year_conocido = false,
       email = COALESCE(email, 'yoandry.bilbao@nauta.cu')
 WHERE id = 'c0646931-bedd-4418-8a3a-b2100e15c175'; -- Yoandry Bilbao

UPDATE public.network_referencia_contactos
   SET birth_date = '1969-11-22', birth_date_year_conocido = true
 WHERE id = '95eeb165-e0ac-4a25-80f8-33ca8522c2fc'; -- Abisail Castillo

-- Los otros 11 no existían en ningún lado -- se insertan como contacto
-- de referencia nuevo, mismo origen que el resto del lote de esta
-- noche (a mano, desde la cuenta del Owner).
INSERT INTO public.network_referencia_contactos
  (nombre, email, origen_csv, created_by, origen_persona_id, origen_persona_nombre, birth_date, birth_date_year_conocido)
VALUES
  ('Martha Cecilia Herrera Tascon', NULL, 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1904-04-16', false),
  ('Maria Jose Acheritogaray', 'maria.jose1610@hotmail.com', 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1904-10-15', false),
  ('Keren Lopez', 'tuti_14@live.com', 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1904-06-21', false),
  ('Odailys Perez-Prado', 'meli30odi@yahoo.com', 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1904-06-15', false),
  ('Angela King', 'Angeladh07@hotmail.com', 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1982-03-10', true),
  ('Brianne King', 'BrianneKing6@hotmail.com', 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1987-11-06', true),
  ('Junio Valerio Borghese', NULL, 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1904-07-08', false),
  ('Manuel Mendoza', 'manuelromengar@hotmail.com', 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1904-03-01', false),
  ('Efrain Alfonso Torre Samaniego', 'Efrainalfonsotorre@hotmail.com', 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1904-06-26', false),
  ('Juan Carlos Huerres Quintero', 'jchuerres@hotmail.com', 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1979-08-20', true),
  ('Yuxell Matos', NULL, 'cumpleanos.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '1904-12-16', false);

NOTIFY pgrst, 'reload schema';
