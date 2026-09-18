-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-18
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Ticket: "serie de eventos acotada + rotación de DJ" (pendiente anotado en
-- docs/ESTADO_MAESTRO.md tras el caso real "Haunting House: Halloween" --
-- 5 jueves seguidos creados como 5 filas sueltas en elixis_agenda_eventos,
-- sin ninguna identidad de grupo).
--
-- Decisión del PO, explícita: NO se construye un concepto nuevo separado.
-- Se extiende residency_schedule (regla semanal ya existente, con
-- reasignar/eliminar-solo-una-fecha vía residency_schedule_exceptions,
-- auditoría vía mdj_auditar, y render ya en el calendario) con una fecha de
-- inicio/fin OPCIONAL + un nombre de serie. Una residencia PERMANENTE (las 6
-- reales de hoy) simplemente deja start_date/end_date en NULL -- sin fin,
-- exactamente el comportamiento actual, cero cambio de conducta para ellas.
-- Rotación de DJ: manual fecha por fecha, reusando "reasignar_dj_una_vez"
-- (residency-schedule-manage) que YA existe y ya está probado en producción
-- -- el PO decidió explícitamente NO automatizar un round-robin.
--
-- start_date es necesario además de end_date: sin él, una serie "5 jueves
-- desde el 24-sep" se expandiría también hacia TODOS los jueves anteriores
-- del año calendario (loadResidencies() hoy expande desde el 1 de enero sin
-- ningún límite inferior -- ver comentario en calendario-operacional-
-- inteligente.html).

-- ── 1) Columnas nuevas ──────────────────────────────────────────────────────
ALTER TABLE public.residency_schedule
  ADD COLUMN IF NOT EXISTS start_date  date,
  ADD COLUMN IF NOT EXISTS end_date    date,
  ADD COLUMN IF NOT EXISTS series_name text;

ALTER TABLE public.residency_schedule DROP CONSTRAINT IF EXISTS residency_schedule_fechas_orden;
ALTER TABLE public.residency_schedule ADD CONSTRAINT residency_schedule_fechas_orden
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);

COMMENT ON COLUMN public.residency_schedule.start_date IS
  'NULL = sin fecha de inicio (residencia permanente, comportamiento de siempre). Con fecha: la regla no genera ocurrencias antes de este día.';
COMMENT ON COLUMN public.residency_schedule.end_date IS
  'NULL = sin fecha de fin (residencia permanente). Con fecha: la regla deja de generar ocurrencias después de este día -- lo que hace que sea una "serie acotada" en vez de indefinida.';
COMMENT ON COLUMN public.residency_schedule.series_name IS
  'Nombre a mostrar para una serie acotada (ej. "Haunting House: Halloween"). NULL en residencias permanentes -- el calendario sigue usando "Residencia · {venue}".';

-- ── 2) RPC: agrega p_fecha_inicio/p_fecha_fin/p_nombre_serie ────────────────
-- DROP explícito: agregar parámetros cambia la identidad de la función en
-- Postgres (nombre+tipos de argumentos) -- sin el DROP quedaría un segundo
-- overload de 11 argumentos, muerto pero confuso.
DROP FUNCTION IF EXISTS public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid);

CREATE OR REPLACE FUNCTION public.residency_schedule_modificar(
  p_accion         text,
  p_dia_semana     smallint,
  p_turno          text,
  p_venue          text,
  p_dj_nombre      text DEFAULT 'DJMago305',
  p_hora_inicio    time DEFAULT NULL,
  p_hora_fin       time DEFAULT NULL,
  p_venue_pay_usd  numeric DEFAULT NULL,
  p_dj_pay_usd     numeric DEFAULT NULL,
  p_notas          text DEFAULT NULL,
  p_staff_user_id  uuid DEFAULT NULL,
  p_fecha_inicio   date DEFAULT NULL,
  p_fecha_fin      date DEFAULT NULL,
  p_nombre_serie   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_accion text := lower(trim(coalesce(p_accion, '')));
  v_venue  text := btrim(coalesce(p_venue, ''));
  v_turno  text := btrim(coalesce(p_turno, ''));
  v_notas  text := NULLIF(btrim(coalesce(p_notas, '')), '');
  v_serie  text := NULLIF(btrim(coalesce(p_nombre_serie, '')), '');
BEGIN
  IF v_accion NOT IN ('crear', 'actualizar', 'desactivar', 'reactivar') THEN
    RAISE EXCEPTION 'accion_invalida';
  END IF;
  IF p_dia_semana IS NULL OR p_dia_semana < 0 OR p_dia_semana > 6 THEN
    RAISE EXCEPTION 'dia_semana_invalido';
  END IF;
  IF v_venue = '' THEN
    RAISE EXCEPTION 'venue_requerido';
  END IF;
  IF v_turno = '' THEN
    RAISE EXCEPTION 'turno_requerido';
  END IF;
  IF p_fecha_inicio IS NOT NULL AND p_fecha_fin IS NOT NULL AND p_fecha_fin < p_fecha_inicio THEN
    RAISE EXCEPTION 'rango_fechas_invalido';
  END IF;

  IF v_accion = 'crear' THEN
    IF p_hora_inicio IS NULL OR p_hora_fin IS NULL THEN
      RAISE EXCEPTION 'horario_requerido';
    END IF;
    INSERT INTO public.residency_schedule (
      day_of_week, shift, venue, dj_name, start_time, end_time,
      venue_pay_usd, dj_pay_usd, notes, active, start_date, end_date, series_name
    ) VALUES (
      p_dia_semana, v_turno, v_venue, coalesce(nullif(btrim(p_dj_nombre), ''), 'DJMago305'),
      p_hora_inicio, p_hora_fin, coalesce(p_venue_pay_usd, 0), coalesce(p_dj_pay_usd, 250),
      v_notas, true, p_fecha_inicio, p_fecha_fin, v_serie
    )
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- actualizar/desactivar/reactivar: localiza la fila real por
  -- dia+turno+venue -- la misma combinacion que ya distingue las filas
  -- reales de hoy. Nunca inventa una fila que no existe.
  SELECT r.id INTO v_id
    FROM public.residency_schedule r
   WHERE r.day_of_week = p_dia_semana
     AND lower(btrim(r.shift)) = lower(v_turno)
     AND lower(btrim(r.venue)) = lower(v_venue)
   ORDER BY r.updated_at DESC
   LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'residencia_no_encontrada';
  END IF;

  IF v_accion = 'desactivar' THEN
    UPDATE public.residency_schedule SET active = false, updated_at = now() WHERE id = v_id;
    RETURN v_id;
  END IF;

  IF v_accion = 'reactivar' THEN
    UPDATE public.residency_schedule SET active = true, updated_at = now() WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- actualizar (incluye poder mover/cerrar la fecha de fin de una serie ya
  -- creada, o convertir una permanente en acotada agregándole end_date)
  UPDATE public.residency_schedule
     SET dj_name        = coalesce(nullif(btrim(p_dj_nombre), ''), dj_name),
         start_time     = coalesce(p_hora_inicio, start_time),
         end_time       = coalesce(p_hora_fin, end_time),
         venue_pay_usd  = coalesce(p_venue_pay_usd, venue_pay_usd),
         dj_pay_usd     = coalesce(p_dj_pay_usd, dj_pay_usd),
         notes          = coalesce(v_notas, notes),
         start_date     = coalesce(p_fecha_inicio, start_date),
         end_date       = coalesce(p_fecha_fin, end_date),
         series_name    = coalesce(v_serie, series_name),
         updated_at     = now()
   WHERE id = v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid, date, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid, date, date, text) FROM anon;
REVOKE ALL ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid, date, date, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid, date, date, text) TO service_role;

COMMENT ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid, date, date, text) IS
  'Escritura validada de residency_schedule (permanente o serie acotada) para gestionar_residency_schedule (ELIXIS) y residency-schedule-manage (staff UI). EXECUTE solo service_role.';

NOTIFY pgrst, 'reload schema';
