-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Ticket "LIBRO DE HISTORIAL,
-- BITÁCORA DE INCIDENTES Y AUDITORÍA PLURIANUAL" (2026-09-01).
--
-- Ajuste de alcance real, confirmado por el PO antes de escribir esto: el
-- ticket pedía un disparador de cancelación en artist_agenda TAMBIÉN, pero
-- esa tabla no tiene ninguna columna de estado -- es append-only por diseño
-- explícito de su propia migración original (20260816180000_artist_agenda.sql:
-- "Isolated append-only... No client writes"). Agregarle un estado mutable
-- ahora contradiría ese diseño. El disparador vive SOLO en
-- elixis_agenda_eventos, que sí tiene estado y es donde ELIXIS cancela
-- eventos de negocio de verdad.
--
-- Para que el disparador tenga algo real que disparar, se amplía el CHECK de
-- elixis_agenda_eventos.estado para aceptar 'cancelado' y 'reprogramado'
-- ademas de 'activo'/'suspendido' -- y la acción 'cancelar' de
-- elixis_agenda_evento_modificar (creado hoy mismo, antes en esta sesión) se
-- corrige para escribir 'cancelado' en vez de reusar 'suspendido': eran la
-- misma cosa antes, y ahora deben distinguirse para que el disparador sepa
-- cuál es cuál.

-- 1) company_incident_log ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_incident_log (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  fecha_incidente        date        NOT NULL DEFAULT CURRENT_DATE,
  categoria              text        NOT NULL
                                      CHECK (categoria IN ('tecnico', 'logistica', 'cliente', 'venue', 'agenda_cancelacion', 'general')),
  venue_nombre           text        CHECK (venue_nombre IS NULL OR char_length(btrim(venue_nombre)) BETWEEN 1 AND 200),
  dj_afectado            text        CHECK (dj_afectado IS NULL OR char_length(btrim(dj_afectado)) BETWEEN 1 AND 200),
  titulo                 text        NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 200),
  descripcion_detallada  text        NOT NULL CHECK (char_length(btrim(descripcion_detallada)) BETWEEN 1 AND 4000),
  solucion_aplicada      text        CHECK (solucion_aplicada IS NULL OR char_length(btrim(solucion_aplicada)) BETWEEN 1 AND 4000),
  reportado_por          uuid        NOT NULL,
  nivel_gravedad         text        NOT NULL DEFAULT 'media'
                                      CHECK (nivel_gravedad IN ('baja', 'media', 'alta', 'critica'))
);

COMMENT ON TABLE public.company_incident_log IS
  'Bitácora histórica de incidentes de la operación (técnicos, logística, cliente, venue, cancelaciones de agenda). Append-heavy, no diseñada para editar el historial.';

CREATE INDEX IF NOT EXISTS idx_company_incident_log_fecha ON public.company_incident_log (fecha_incidente DESC);
CREATE INDEX IF NOT EXISTS idx_company_incident_log_categoria ON public.company_incident_log (categoria);
CREATE INDEX IF NOT EXISTS idx_company_incident_log_dj ON public.company_incident_log (dj_afectado);

ALTER TABLE public.company_incident_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_incident_log FROM PUBLIC;
REVOKE ALL ON TABLE public.company_incident_log FROM anon;
GRANT SELECT, INSERT ON TABLE public.company_incident_log TO authenticated;
GRANT ALL ON TABLE public.company_incident_log TO service_role;

-- owner/admin: lectura y escritura total histórica, sin restricción de fecha.
DROP POLICY IF EXISTS incident_log_all_owner_admin ON public.company_incident_log;
CREATE POLICY incident_log_all_owner_admin
  ON public.company_incident_log
  FOR ALL
  TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

COMMENT ON POLICY incident_log_all_owner_admin ON public.company_incident_log IS
  'owner/admin/manager (is_staff_management): CRUD total histórico.';

-- Artistas/DJs: solo lectura de SUS PROPIOS incidentes (dj_afectado calza con
-- su nombre real en dj_profiles) o inserción de un reporte técnico propio
-- (mismo candado: dj_afectado tiene que ser su propio nombre, nunca el de
-- otro DJ). El ticket no define una columna de "público/privado" -- este es
-- el candado más cercano a "reportes asignados a su sesión" sin inventar una
-- columna que no se pidió.
DROP POLICY IF EXISTS incident_log_select_own_dj ON public.company_incident_log;
CREATE POLICY incident_log_select_own_dj
  ON public.company_incident_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dj_profiles d
      WHERE d.user_id = auth.uid()
        AND lower(btrim(coalesce(company_incident_log.dj_afectado, ''))) IN (
          lower(btrim(coalesce(d.stage_name, ''))), lower(btrim(coalesce(d.dj_name, ''))), lower(btrim(coalesce(d.full_name, '')))
        )
    )
  );

COMMENT ON POLICY incident_log_select_own_dj ON public.company_incident_log IS
  'Un DJ lee solo los incidentes donde dj_afectado es su propio nombre.';

DROP POLICY IF EXISTS incident_log_insert_own_dj ON public.company_incident_log;
CREATE POLICY incident_log_insert_own_dj
  ON public.company_incident_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reportado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dj_profiles d
      WHERE d.user_id = auth.uid()
        AND lower(btrim(coalesce(company_incident_log.dj_afectado, ''))) IN (
          lower(btrim(coalesce(d.stage_name, ''))), lower(btrim(coalesce(d.dj_name, ''))), lower(btrim(coalesce(d.full_name, '')))
        )
    )
  );

COMMENT ON POLICY incident_log_insert_own_dj ON public.company_incident_log IS
  'Un DJ solo inserta reportes técnicos autoatribuidos a sí mismo (dj_afectado = su propio nombre).';

-- 2) RPC de escritura validada (la usa el tool registrar_incidente_bitacora) -

CREATE OR REPLACE FUNCTION public.company_incident_log_registrar(
  p_categoria       text,
  p_titulo          text,
  p_descripcion     text,
  p_venue           text DEFAULT NULL,
  p_dj              text DEFAULT NULL,
  p_gravedad        text DEFAULT 'media',
  p_solucion        text DEFAULT NULL,
  p_reportado_por   uuid DEFAULT NULL,
  p_fecha_incidente date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_categoria text := lower(trim(coalesce(p_categoria, '')));
  v_gravedad  text := lower(trim(coalesce(p_gravedad, 'media')));
BEGIN
  IF v_categoria NOT IN ('tecnico', 'logistica', 'cliente', 'venue', 'agenda_cancelacion', 'general') THEN
    RAISE EXCEPTION 'categoria_invalida';
  END IF;
  IF v_gravedad NOT IN ('baja', 'media', 'alta', 'critica') THEN
    RAISE EXCEPTION 'gravedad_invalida';
  END IF;
  IF btrim(coalesce(p_titulo, '')) = '' THEN
    RAISE EXCEPTION 'titulo_requerido';
  END IF;
  IF btrim(coalesce(p_descripcion, '')) = '' THEN
    RAISE EXCEPTION 'descripcion_requerida';
  END IF;
  IF p_reportado_por IS NULL THEN
    RAISE EXCEPTION 'reportado_por_requerido';
  END IF;

  INSERT INTO public.company_incident_log (
    fecha_incidente, categoria, venue_nombre, dj_afectado, titulo,
    descripcion_detallada, solucion_aplicada, reportado_por, nivel_gravedad
  ) VALUES (
    coalesce(p_fecha_incidente, CURRENT_DATE), v_categoria,
    NULLIF(btrim(coalesce(p_venue, '')), ''), NULLIF(btrim(coalesce(p_dj, '')), ''),
    substring(btrim(p_titulo) from 1 for 200), substring(btrim(p_descripcion) from 1 for 4000),
    NULLIF(btrim(coalesce(p_solucion, '')), ''), p_reportado_por, v_gravedad
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.company_incident_log_registrar(text, text, text, text, text, text, text, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_incident_log_registrar(text, text, text, text, text, text, text, uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public.company_incident_log_registrar(text, text, text, text, text, text, text, uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.company_incident_log_registrar(text, text, text, text, text, text, text, uuid, date) TO service_role;

COMMENT ON FUNCTION public.company_incident_log_registrar(text, text, text, text, text, text, text, uuid, date) IS
  'Escritura validada de company_incident_log para el tool registrar_incidente_bitacora. EXECUTE solo service_role.';

-- 3) Ampliar elixis_agenda_eventos.estado para distinguir cancelado --------
-- (necesario para que el disparador de abajo tenga algo real que detectar;
-- 'suspendido' seguia usandose para pausas temporales, 'cancelado' ahora es
-- distinto y definitivo, 'reprogramado' queda disponible para un futuro
-- ticket que sí construya ese flujo -- no se le agrega lógica todavía).

ALTER TABLE public.elixis_agenda_eventos DROP CONSTRAINT IF EXISTS elixis_agenda_eventos_estado_check;
ALTER TABLE public.elixis_agenda_eventos
  ADD CONSTRAINT elixis_agenda_eventos_estado_check
  CHECK (estado IN ('activo', 'suspendido', 'cancelado', 'reprogramado'));

-- Corrige elixis_agenda_evento_modificar (creado hoy mismo): 'cancelar' ahora
-- escribe 'cancelado' (antes reusaba 'suspendido', indistinguible de una
-- pausa). Firma sin cambios -- mismo DROP/CREATE que ya usan las otras
-- correcciones de esta sesión sobre esta función.
DROP FUNCTION IF EXISTS public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text, boolean);

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
  IF v_estado NOT IN ('activo', 'suspendido', 'cancelado', 'reprogramado') THEN
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
                                    WHEN v_accion = 'cancelar' THEN 'cancelado'
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
  'Escritura de elixis_agenda_eventos. accion=cancelar ahora escribe estado=cancelado (distinto de suspendido) para alimentar el disparador de bitácora.';

-- 4) Disparador: cancelación en elixis_agenda_eventos -> company_incident_log

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
      reportado_por, nivel_gravedad, fecha_incidente
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
  'Disparador: cuando elixis_agenda_eventos.estado pasa a cancelado/reprogramado, registra una fila automática en company_incident_log.';

DROP TRIGGER IF EXISTS trg_log_agenda_changes ON public.elixis_agenda_eventos;
CREATE TRIGGER trg_log_agenda_changes
  AFTER UPDATE ON public.elixis_agenda_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_agenda_changes();

NOTIFY pgrst, 'reload schema';
