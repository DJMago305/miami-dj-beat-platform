-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- ELIXIS puede hacer lo que hoy solo hace el calendario: cambiar el DJ de UNA fecha de una residencia
-- (rotación), saltar una fecha, o quitar esa excepción. La regla semanal NO se toca.
--
-- Es la misma escritura que hace la Edge Function residency-schedule-manage (reasignar_dj_una_vez /
-- eliminar_una_vez), con una diferencia importante: aquí el DJ se resuelve a su dj_id real. El cálculo del
-- Cash Flow une la excepción por dj_id (COALESCE(ex.dj_id, regla.dj_id)); una excepción sin dj_id pagaría
-- el turno al DJ de la regla, no al que cubrió. Por eso nunca se guarda una excepción sin dj_id.
--
-- Los avisos al DJ, la agenda y el Cash Flow los siguen haciendo solos los disparadores y el cron ya existentes
-- (trg_residency_exceptions_sync, residency_sync_agenda, dj_flow_rollups_refresh).
-- Solo service_role (la llama la Edge Function elixis-chat tras la aprobación humana).

CREATE OR REPLACE FUNCTION public.residency_exception_modificar(
  p_accion         text,
  p_dia_semana     smallint,
  p_turno          text,
  p_venue          text,
  p_fecha          date,
  p_dj_nombre      text DEFAULT NULL,
  p_notas          text DEFAULT NULL,
  p_staff_user_id  uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accion  text := lower(btrim(coalesce(p_accion, '')));
  v_rule    public.residency_schedule%ROWTYPE;
  v_dj      public.dj_profiles%ROWTYPE;
  v_n       int;
  v_id      uuid;
  v_notas   text := NULLIF(btrim(coalesce(p_notas, '')), '');
BEGIN
  IF v_accion NOT IN ('reasignar_una_vez', 'saltar_una_vez', 'quitar_excepcion') THEN
    RAISE EXCEPTION 'accion_invalida';
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'fecha_requerida';
  END IF;

  -- La regla se identifica por día + turno + venue, solo entre las ACTIVAS
  SELECT count(*) INTO v_n
    FROM public.residency_schedule r
   WHERE r.active
     AND r.day_of_week = p_dia_semana
     AND lower(btrim(r.shift)) = lower(btrim(coalesce(p_turno, '')))
     AND lower(btrim(r.venue)) = lower(btrim(coalesce(p_venue, '')));
  IF v_n = 0 THEN
    RAISE EXCEPTION 'residencia_no_encontrada';
  ELSIF v_n > 1 THEN
    RAISE EXCEPTION 'residencia_ambigua';
  END IF;

  SELECT r.* INTO v_rule
    FROM public.residency_schedule r
   WHERE r.active
     AND r.day_of_week = p_dia_semana
     AND lower(btrim(r.shift)) = lower(btrim(coalesce(p_turno, '')))
     AND lower(btrim(r.venue)) = lower(btrim(coalesce(p_venue, '')));

  IF extract(dow FROM p_fecha)::int <> v_rule.day_of_week THEN
    RAISE EXCEPTION 'fecha_no_coincide_con_el_dia';
  END IF;
  IF (v_rule.start_date IS NOT NULL AND p_fecha < v_rule.start_date)
     OR (v_rule.end_date IS NOT NULL AND p_fecha > v_rule.end_date) THEN
    RAISE EXCEPTION 'fecha_fuera_de_la_serie';
  END IF;

  IF v_accion = 'quitar_excepcion' THEN
    DELETE FROM public.residency_schedule_exceptions
     WHERE residency_id = v_rule.id AND exception_date = p_fecha
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'excepcion_no_encontrada';
    END IF;
    RETURN v_id;
  END IF;

  IF v_accion = 'saltar_una_vez' THEN
    INSERT INTO public.residency_schedule_exceptions (residency_id, exception_date, skip, dj_name, dj_id, notes, created_by)
    VALUES (v_rule.id, p_fecha, true, NULL, NULL, v_notas, p_staff_user_id)
    ON CONFLICT (residency_id, exception_date)
    DO UPDATE SET skip = true, dj_name = NULL, dj_id = NULL, notes = EXCLUDED.notes, created_by = EXCLUDED.created_by
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- reasignar_una_vez: el DJ debe existir y ser único
  IF p_dj_nombre IS NULL OR btrim(p_dj_nombre) = '' THEN
    RAISE EXCEPTION 'dj_nombre_requerido';
  END IF;
  SELECT count(*) INTO v_n
    FROM public.dj_profiles d
   WHERE d.user_id IS NOT NULL
     AND lower(coalesce(d.role, '')) = 'dj'
     AND (lower(btrim(coalesce(d.stage_name, ''))) = lower(btrim(p_dj_nombre))
          OR lower(btrim(coalesce(d.dj_name, ''))) = lower(btrim(p_dj_nombre))
          OR lower(btrim(coalesce(d.full_name, ''))) = lower(btrim(p_dj_nombre)));
  IF v_n = 0 THEN
    RAISE EXCEPTION 'dj_no_encontrado';
  ELSIF v_n > 1 THEN
    RAISE EXCEPTION 'dj_ambiguo';
  END IF;
  SELECT d.* INTO v_dj
    FROM public.dj_profiles d
   WHERE d.user_id IS NOT NULL
     AND lower(coalesce(d.role, '')) = 'dj'
     AND (lower(btrim(coalesce(d.stage_name, ''))) = lower(btrim(p_dj_nombre))
          OR lower(btrim(coalesce(d.dj_name, ''))) = lower(btrim(p_dj_nombre))
          OR lower(btrim(coalesce(d.full_name, ''))) = lower(btrim(p_dj_nombre)));

  INSERT INTO public.residency_schedule_exceptions (residency_id, exception_date, skip, dj_name, dj_id, notes, created_by)
  VALUES (v_rule.id, p_fecha, false, coalesce(v_dj.stage_name, v_dj.dj_name, v_dj.full_name), v_dj.id, v_notas, p_staff_user_id)
  ON CONFLICT (residency_id, exception_date)
  DO UPDATE SET skip = false, dj_name = EXCLUDED.dj_name, dj_id = EXCLUDED.dj_id,
                notes = EXCLUDED.notes, created_by = EXCLUDED.created_by
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.residency_exception_modificar(text, smallint, text, text, date, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.residency_exception_modificar(text, smallint, text, text, date, text, text, uuid)
  TO service_role;
