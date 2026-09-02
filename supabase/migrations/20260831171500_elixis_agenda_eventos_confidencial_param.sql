-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Corrección inmediata de la
-- migración anterior (20260831170000_elixis_agenda_eventos.sql), aplicada en
-- la misma sesión: el tool modificar_agenda_evento expone es_confidencial_staff
-- (parte central del ticket "privacidad por roles") pero el RPC no lo recibía
-- todavía. Se agrega el parámetro sin romper la firma existente en el resto
-- del flujo (mismo nombre de función, un parámetro más al final).

DROP FUNCTION IF EXISTS public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.elixis_agenda_evento_modificar(
  p_dj_nombre             text,
  p_venue_nombre          text,
  p_fecha_inicio          timestamptz,
  p_fecha_fin             timestamptz,
  p_accion                text,
  p_tipo                  text DEFAULT 'nota',
  p_estado                text DEFAULT 'activo',
  p_notas                 text DEFAULT NULL,
  p_tarifa_venue_cents    integer DEFAULT NULL,
  p_pago_dj_cents         integer DEFAULT NULL,
  p_staff_user_id         uuid DEFAULT NULL,
  p_agent_id              text DEFAULT 'elixis',
  p_es_confidencial_staff boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_id       uuid;
  v_notas    text := NULLIF(btrim(COALESCE(p_notas, '')), '');
  v_venue    text := NULLIF(btrim(COALESCE(p_venue_nombre, '')), '');
  v_accion   text := lower(trim(COALESCE(p_accion, 'crear')));
  v_tipo     text := lower(trim(COALESCE(p_tipo, 'nota')));
  v_estado   text := lower(trim(COALESCE(p_estado, 'activo')));
  v_agent    text := NULLIF(btrim(COALESCE(p_agent_id, 'elixis')), '');
BEGIN
  IF p_dj_nombre IS NULL OR btrim(p_dj_nombre) = '' THEN
    RAISE EXCEPTION 'dj_nombre_requerido';
  END IF;
  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin <= p_fecha_inicio THEN
    RAISE EXCEPTION 'rango_invalido';
  END IF;
  IF v_tipo NOT IN ('residencia', 'boda', 'privado', 'cumpleanos', 'nota') THEN
    RAISE EXCEPTION 'tipo_invalido';
  END IF;
  IF v_estado NOT IN ('activo', 'suspendido') THEN
    RAISE EXCEPTION 'estado_invalido';
  END IF;
  IF v_agent IS NULL THEN
    v_agent := 'elixis';
  END IF;

  SELECT d.user_id INTO v_user_id
    FROM public.dj_profiles d
    WHERE lower(btrim(coalesce(d.stage_name, ''))) = lower(btrim(p_dj_nombre))
       OR lower(btrim(coalesce(d.dj_name, ''))) = lower(btrim(p_dj_nombre))
       OR lower(btrim(coalesce(d.full_name, ''))) = lower(btrim(p_dj_nombre))
    LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'dj_no_encontrado';
  END IF;

  IF v_accion = 'crear' THEN
    INSERT INTO public.elixis_agenda_eventos (
      user_id, dj_nombre, venue_nombre, fecha_inicio, fecha_fin, tipo,
      tarifa_venue_cents, pago_dj_cents, estado, notas, staff_user_id, agent_id,
      es_confidencial_staff
    ) VALUES (
      v_user_id, btrim(p_dj_nombre), v_venue, p_fecha_inicio, p_fecha_fin, v_tipo,
      p_tarifa_venue_cents, p_pago_dj_cents, v_estado, v_notas, p_staff_user_id, v_agent,
      COALESCE(p_es_confidencial_staff, false)
    )
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  SELECT e.id INTO v_id
    FROM public.elixis_agenda_eventos e
    WHERE e.user_id = v_user_id
      AND e.fecha_inicio = p_fecha_inicio
      AND (v_venue IS NULL OR lower(btrim(coalesce(e.venue_nombre, ''))) = lower(v_venue))
    ORDER BY e.created_at DESC
    LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'evento_no_encontrado';
  END IF;

  UPDATE public.elixis_agenda_eventos
     SET fecha_fin             = p_fecha_fin,
         tipo                  = v_tipo,
         estado                = CASE
                                    WHEN v_accion = 'cancelar' THEN 'suspendido'
                                    WHEN v_accion = 'suspender' THEN 'suspendido'
                                    WHEN v_accion = 'reactivar' THEN 'activo'
                                    ELSE v_estado
                                  END,
         tarifa_venue_cents    = COALESCE(p_tarifa_venue_cents, tarifa_venue_cents),
         pago_dj_cents         = COALESCE(p_pago_dj_cents, pago_dj_cents),
         notas                 = COALESCE(v_notas, notas),
         es_confidencial_staff = COALESCE(p_es_confidencial_staff, es_confidencial_staff),
         updated_at            = now()
   WHERE id = v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text, boolean) TO service_role;

COMMENT ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text, boolean) IS
  'Escritura de elixis_agenda_eventos para el tool modificar_agenda_evento. EXECUTE solo service_role. Resuelve dj_nombre contra dj_profiles; nunca inventa un user_id. Incluye es_confidencial_staff (privacidad por roles).';

NOTIFY pgrst, 'reload schema';
