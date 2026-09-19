-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Pedido del PO tras auditoría forense: detectó (con evidencia real --
-- sus propias 2 fichas "MIAMI DJ BEAT LLC"/"MIAMIDJBEATLLC Valle" ya
-- coincidiendo por teléfono/email con sus cuentas reales) que Network
-- no tenía ninguna detección de duplicados entre contactos de
-- referencia (sin cuenta) y cuentas reales (client_profiles/
-- dj_profiles) -- esto ya estaba admitido en el propio tooltip de
-- Network ("Pendiente para después: detección de duplicados").
--
-- Este script construye la fusión real:
--   1. Nunca borra la fila de referencia -- se marca como fusionada
--      (fusionado_fuente/fusionado_id/fusionado_en) para no perder
--      notas/origen_csv/origen_persona_nombre, que no tienen columna
--      equivalente en client_profiles/dj_profiles. El frontend deja de
--      mostrarla como ficha aparte y en su lugar inyecta su notas/
--      origen dentro de "Info interna" de la cuenta real.
--   2. Solo rellena huecos reales (columna real en NULL/vacía) --
--      jamás sobreescribe un dato que la cuenta real ya tenga. Mismo
--      criterio "root cause, no band-aid" usado en todo el resto de
--      Network esta sesión.
-- ============================================================

ALTER TABLE public.network_referencia_contactos
    ADD COLUMN IF NOT EXISTS fusionado_fuente text CHECK (fusionado_fuente IN ('client','dj')),
    ADD COLUMN IF NOT EXISTS fusionado_id uuid,
    ADD COLUMN IF NOT EXISTS fusionado_en timestamptz;

CREATE OR REPLACE FUNCTION public.network_referencia_fusionar(
    p_referencia_id uuid,
    p_fuente_real   text,
    p_id_real       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref  record;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;

  IF p_fuente_real NOT IN ('client', 'dj') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fuente_invalida');
  END IF;

  SELECT * INTO v_ref FROM public.network_referencia_contactos WHERE id = p_referencia_id;
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referencia_no_encontrada');
  END IF;
  IF v_ref.fusionado_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ya_fusionado');
  END IF;

  IF p_fuente_real = 'client' THEN
    IF NOT EXISTS (SELECT 1 FROM public.client_profiles WHERE id = p_id_real) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cuenta_real_no_encontrada');
    END IF;
    UPDATE public.client_profiles c SET
      phone           = COALESCE(NULLIF(c.phone, ''), v_ref.telefono),
      email           = COALESCE(NULLIF(c.email, ''), v_ref.email),
      birth_date      = CASE WHEN c.birth_date IS NULL AND v_ref.birth_date_year_conocido IS DISTINCT FROM false THEN v_ref.birth_date ELSE c.birth_date END,
      photo_url       = COALESCE(c.photo_url, v_ref.photo_url),
      phones_extra    = CASE WHEN c.phones_extra IS NULL OR c.phones_extra = '[]'::jsonb THEN COALESCE(v_ref.phones_extra, c.phones_extra) ELSE c.phones_extra END,
      emails_extra    = CASE WHEN c.emails_extra IS NULL OR c.emails_extra = '[]'::jsonb THEN COALESCE(v_ref.emails_extra, c.emails_extra) ELSE c.emails_extra END,
      aniversario     = COALESCE(c.aniversario, v_ref.aniversario),
      redes_sociales  = CASE WHEN c.redes_sociales IS NULL OR c.redes_sociales = '[]'::jsonb THEN COALESCE(v_ref.redes_sociales, c.redes_sociales) ELSE c.redes_sociales END,
      address_street  = COALESCE(NULLIF(c.address_street, ''), v_ref.direccion->>'street'),
      address_apt     = COALESCE(NULLIF(c.address_apt, ''), v_ref.direccion->>'apt'),
      city            = COALESCE(NULLIF(c.city, ''), v_ref.direccion->>'city'),
      address_state   = COALESCE(NULLIF(c.address_state, ''), v_ref.direccion->>'state'),
      address_zip     = COALESCE(NULLIF(c.address_zip, ''), v_ref.direccion->>'zip'),
      address_country = COALESCE(NULLIF(c.address_country, ''), v_ref.direccion->>'country')
    WHERE c.id = p_id_real;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.dj_profiles WHERE id = p_id_real) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cuenta_real_no_encontrada');
    END IF;
    UPDATE public.dj_profiles d SET
      phone            = COALESCE(NULLIF(d.phone, ''), v_ref.telefono),
      email            = COALESCE(NULLIF(d.email, ''), v_ref.email),
      birth_date       = CASE WHEN d.birth_date IS NULL AND v_ref.birth_date_year_conocido IS DISTINCT FROM false THEN v_ref.birth_date ELSE d.birth_date END,
      photo_url        = COALESCE(d.photo_url, v_ref.photo_url),
      phones_extra     = CASE WHEN d.phones_extra IS NULL OR d.phones_extra = '[]'::jsonb THEN COALESCE(v_ref.phones_extra, d.phones_extra) ELSE d.phones_extra END,
      emails_extra     = CASE WHEN d.emails_extra IS NULL OR d.emails_extra = '[]'::jsonb THEN COALESCE(v_ref.emails_extra, d.emails_extra) ELSE d.emails_extra END,
      aniversario      = COALESCE(d.aniversario, v_ref.aniversario),
      redes_sociales   = CASE WHEN d.redes_sociales IS NULL OR d.redes_sociales = '[]'::jsonb THEN COALESCE(v_ref.redes_sociales, d.redes_sociales) ELSE d.redes_sociales END,
      address          = COALESCE(NULLIF(d.address, ''), v_ref.direccion->>'street'),
      address_apt      = COALESCE(NULLIF(d.address_apt, ''), v_ref.direccion->>'apt'),
      city             = COALESCE(NULLIF(d.city, ''), v_ref.direccion->>'city'),
      region           = COALESCE(NULLIF(d.region, ''), v_ref.direccion->>'state'),
      address_zip      = COALESCE(NULLIF(d.address_zip, ''), v_ref.direccion->>'zip'),
      address_country  = COALESCE(NULLIF(d.address_country, ''), v_ref.direccion->>'country')
    WHERE d.id = p_id_real;
  END IF;

  UPDATE public.network_referencia_contactos
     SET fusionado_fuente = p_fuente_real,
         fusionado_id     = p_id_real,
         fusionado_en     = now()
   WHERE id = p_referencia_id;

  BEGIN
    PERFORM public.mdj_auditar(
      p_accion        => 'network_referencia_fusionar',
      p_recurso_tabla => CASE WHEN p_fuente_real = 'client' THEN 'client_profiles' ELSE 'dj_profiles' END,
      p_recurso_id    => p_id_real::text,
      p_antes         => jsonb_build_object('referencia_id', p_referencia_id, 'referencia_nombre', v_ref.nombre),
      p_despues       => jsonb_build_object('fusionado', true),
      p_origen        => 'network'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_referencia_fusionar(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_referencia_fusionar(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_referencia_fusionar(uuid, text, uuid) TO authenticated;
COMMENT ON FUNCTION public.network_referencia_fusionar(uuid, text, uuid) IS
  'Staff-only (is_staff): fusiona un contacto de referencia con la cuenta real (client/dj) que ya coincide por teléfono/email -- solo rellena columnas vacías, nunca sobreescribe dato real, y marca la fila de referencia como fusionada (nunca la borra) para no perder notas/origen. Auditado vía mdj_auditar.';

NOTIFY pgrst, 'reload schema';
