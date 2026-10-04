-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-10-04 -- SQL ÚNICO Y DEFINITIVO de este ticket.
-- Ticket: DJSolitario no veía en su calendario los viernes alternados con
-- DJYuyo ni el domingo cubierto (reporte del PO 2026-10-04).
-- ============================================================
-- Qué YA funciona en producción (verificado 2026-10-04, NO se toca aquí):
--   agenda personal por fecha (artist_agenda), aviso en bandeja (dj_notifications)
--   + cola push (avisos_pendientes), recordatorios 24h/2h y cash flow de turnos.
--   Todo sale de triggers en residency_schedule y residency_schedule_exceptions
--   (20260921_cableado_asignacion_dj.sql), así que aplica igual si el cambio lo
--   hace staff en la web, ELIXIS o la función residency-schedule-manage.
-- Qué FALLABA (causa raíz, verificada simulando la sesión del DJ):
--   La pantalla "calendario operativo" arma los turnos desde las REGLAS y sus
--   EXCEPCIONES, y un DJ no podía leer ninguna de las dos para un turno donde
--   solo cubre:
--   1) residency_schedule_secure solo devolvía reglas donde el DJ es el DJ BASE.
--   2) residency_schedule_exceptions solo la leía staff/owner.
-- Fix GENÉRICO (por auth.uid(); vale para cualquier DJ actual o futuro, sin
-- nombres ni ids fijos): el artista ve (a) las reglas donde es base o donde
-- tiene una excepción asignada y (b) las excepciones que lo tocan, ya sea como
-- reemplazo o como DJ base. Empata por dj_id y, si la fila no lo trae (dato
-- huérfano, ya documentado), por stage_name, igual que residency_sync_agenda().
-- Nunca ve turnos de otros DJs. venue_pay_usd sigue oculto a no-staff.
-- No borra ni modifica datos. Se puede correr más de una vez sin efecto extra.

CREATE OR REPLACE VIEW public.residency_schedule_secure AS
 SELECT id,
    day_of_week,
    shift,
    venue,
    dj_name,
    start_time,
    end_time,
    dj_id,
    dj_pay_usd,
    active,
    notes,
        CASE
            WHEN is_staff(auth.uid()) THEN venue_pay_usd
            ELSE NULL::numeric
        END AS venue_pay_usd,
    start_date,
    end_date,
    series_name,
    assigned_staff_id,
    assigned_staff_name
   FROM residency_schedule s
  WHERE active = true AND (
        is_staff(auth.uid())
        OR EXISTS (
            SELECT 1 FROM dj_profiles me
            WHERE me.user_id = auth.uid()
              AND (s.dj_id = me.id
                   OR (s.dj_id IS NULL AND lower(s.dj_name) = lower(me.stage_name))
                   OR s.id IN (
                        SELECT e.residency_id FROM residency_schedule_exceptions e
                        WHERE e.dj_id = me.id
                           OR (e.dj_id IS NULL AND lower(e.dj_name) = lower(me.stage_name))))
        )
  );

-- La política consulta residency_schedule, que es solo-staff: dentro de la política
-- esa lectura volvía vacía para el artista y el DJ base no veía las fechas que le
-- quitaron. Por eso la pregunta "¿esta regla es mía?" va en una función con permisos
-- del sistema, que solo responde sí/no sobre el propio usuario.
CREATE OR REPLACE FUNCTION public.mdj_residencia_es_mia(p_residency uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.residency_schedule s
    JOIN public.dj_profiles me ON me.user_id = auth.uid()
    WHERE s.id = p_residency
      AND (s.dj_id = me.id
           OR (s.dj_id IS NULL AND lower(s.dj_name) = lower(me.stage_name)))
  );
$$;
REVOKE ALL ON FUNCTION public.mdj_residencia_es_mia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mdj_residencia_es_mia(uuid) TO authenticated;

DROP POLICY IF EXISTS residency_exceptions_artist_read ON public.residency_schedule_exceptions;
CREATE POLICY residency_exceptions_artist_read
  ON public.residency_schedule_exceptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
        SELECT 1 FROM public.dj_profiles me
        WHERE me.user_id = auth.uid()
          AND (residency_schedule_exceptions.dj_id = me.id
               OR (residency_schedule_exceptions.dj_id IS NULL
                   AND lower(residency_schedule_exceptions.dj_name) = lower(me.stage_name)))
    )
    OR public.mdj_residencia_es_mia(residency_schedule_exceptions.residency_id)
  );
