-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Corrección inmediata de
-- 20260901140000_company_incident_log.sql, encontrada en la primera prueba
-- en vivo del mismo día: log_agenda_changes() listaba 8 columnas en el
-- INSERT pero solo daba 7 valores (fecha_incidente se quedó sin valor) --
-- Postgres lo rechazaba con "INSERT has more target columns than
-- expressions", rompiendo CUALQUIER actualizar/cancelar/reactivar sobre
-- elixis_agenda_eventos, no solo las cancelaciones (el trigger corre en
-- todo UPDATE). Se quita fecha_incidente de la lista -- la columna ya tiene
-- DEFAULT CURRENT_DATE, que es exactamente lo correcto para un registro
-- automático de un cambio que pasa ahora mismo.

CREATE OR REPLACE FUNCTION public.log_agenda_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado IN ('cancelado', 'reprogramado') AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.company_incident_log (
      categoria, venue_nombre, dj_afectado, titulo, descripcion_detallada,
      reportado_por, nivel_gravedad
    ) VALUES (
      'agenda_cancelacion',
      NEW.venue_nombre,
      NEW.dj_nombre,
      CASE WHEN NEW.estado = 'cancelado' THEN 'Evento cancelado: ' || NEW.tipo ELSE 'Evento reprogramado: ' || NEW.tipo END,
      'Registro automático. Evento id ' || NEW.id::text || ', ' || NEW.tipo ||
        ' en ' || coalesce(NEW.venue_nombre, '(sin venue)') || ' para ' || NEW.dj_nombre ||
        ', originalmente ' || to_char(OLD.fecha_inicio, 'YYYY-MM-DD HH24:MI') ||
        ' a ' || to_char(OLD.fecha_fin, 'YYYY-MM-DD HH24:MI') || '. Estado: ' || OLD.estado || ' -> ' || NEW.estado || '.',
      coalesce(NEW.staff_user_id, NEW.user_id),
      'baja'
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_agenda_changes() IS
  'Disparador: cuando elixis_agenda_eventos.estado pasa a cancelado/reprogramado, registra una fila automática en company_incident_log. fecha_incidente usa su DEFAULT (CURRENT_DATE).';

NOTIFY pgrst, 'reload schema';
