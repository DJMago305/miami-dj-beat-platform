-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Ticket "SPRINT CRÍTICO: RELOJ EN
-- TIEMPO REAL, FUNCTION CALLING DE AGENDAS Y PRIVACIDAD POR ROLES" (2026-08-31).
--
-- Tabla nueva, separada de public.artist_agenda (bloques personales del propio
-- DJ) y de public.residency_schedule (plantilla semanal recurrente). Esta es
-- la agenda operativa que ELIXIS puede escribir en nombre del staff: eventos
-- con tarifa de venue y pago al DJ, con un flag de confidencialidad para que
-- un DJ no vea, por ejemplo, cuánto cobró el venue en un evento suyo.
--
-- Dinero en *_cents (integer), mismo patrón que dj_ledger / event_quotes /
-- discount_codes -- nunca decimal suelto.
--
-- Nombres del ticket: 'tarifa_venue' -> tarifa_venue_cents,
-- 'pago_dj' -> pago_dj_cents. Mismo campo, unidad explícita.

CREATE TABLE IF NOT EXISTS public.elixis_agenda_eventos (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  dj_nombre              text        NOT NULL CHECK (char_length(btrim(dj_nombre)) BETWEEN 1 AND 200),
  venue_nombre           text        CHECK (venue_nombre IS NULL OR char_length(btrim(venue_nombre)) BETWEEN 1 AND 200),
  fecha_inicio           timestamptz NOT NULL,
  fecha_fin              timestamptz NOT NULL,
  tipo                   text        NOT NULL DEFAULT 'nota'
                                      CHECK (tipo IN ('residencia', 'boda', 'privado', 'cumpleanos', 'nota')),
  tarifa_venue_cents     integer     CHECK (tarifa_venue_cents IS NULL OR tarifa_venue_cents >= 0),
  pago_dj_cents          integer     CHECK (pago_dj_cents IS NULL OR pago_dj_cents >= 0),
  estado                 text        NOT NULL DEFAULT 'activo'
                                      CHECK (estado IN ('activo', 'suspendido')),
  es_confidencial_staff  boolean     NOT NULL DEFAULT false,
  notas                  text        CHECK (notas IS NULL OR char_length(btrim(notas)) BETWEEN 1 AND 2000),
  staff_user_id          uuid,
  agent_id               text        NOT NULL DEFAULT 'elixis' CHECK (char_length(btrim(agent_id)) BETWEEN 1 AND 64),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT elixis_agenda_eventos_range_check CHECK (fecha_fin > fecha_inicio)
);

COMMENT ON TABLE public.elixis_agenda_eventos IS
  'Agenda operativa escribible por ELIXIS vía RPC (modificar_agenda_evento). Distinta de artist_agenda (bloques personales) y residency_schedule (plantilla semanal).';

CREATE INDEX IF NOT EXISTS idx_elixis_agenda_eventos_user_fecha
  ON public.elixis_agenda_eventos (user_id, fecha_inicio);

ALTER TABLE public.elixis_agenda_eventos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.elixis_agenda_eventos FROM PUBLIC;
REVOKE ALL ON TABLE public.elixis_agenda_eventos FROM anon;
REVOKE ALL ON TABLE public.elixis_agenda_eventos FROM authenticated;

GRANT SELECT, INSERT ON TABLE public.elixis_agenda_eventos TO authenticated;
GRANT ALL ON TABLE public.elixis_agenda_eventos TO service_role;

-- owner/admin: CRUD total (ticket dice explícitamente "owner/admin", no
-- manager/seller -- por eso no se reutiliza is_staff_management() aquí, que
-- incluye manager).
DROP POLICY IF EXISTS elixis_agenda_eventos_all_owner_admin ON public.elixis_agenda_eventos;
CREATE POLICY elixis_agenda_eventos_all_owner_admin
  ON public.elixis_agenda_eventos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dj_profiles d
      WHERE d.user_id = auth.uid()
        AND lower(trim(coalesce(d.role, ''))) IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dj_profiles d
      WHERE d.user_id = auth.uid()
        AND lower(trim(coalesce(d.role, ''))) IN ('owner', 'admin')
    )
  );

COMMENT ON POLICY elixis_agenda_eventos_all_owner_admin ON public.elixis_agenda_eventos IS
  'owner/admin (dj_profiles.role): SELECT/INSERT/UPDATE/DELETE total, incluyendo filas confidenciales.';

-- DJ (artista, dueño de la fila): SELECT + INSERT de lo propio, nunca lo
-- marcado confidencial para staff. Sin UPDATE/DELETE -- solo ELIXIS/staff
-- modifica vía RPC.
DROP POLICY IF EXISTS elixis_agenda_eventos_select_own_dj ON public.elixis_agenda_eventos;
CREATE POLICY elixis_agenda_eventos_select_own_dj
  ON public.elixis_agenda_eventos
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND es_confidencial_staff = false);

COMMENT ON POLICY elixis_agenda_eventos_select_own_dj ON public.elixis_agenda_eventos IS
  'Un DJ lee solo sus propios eventos no confidenciales.';

DROP POLICY IF EXISTS elixis_agenda_eventos_insert_own_dj ON public.elixis_agenda_eventos;
CREATE POLICY elixis_agenda_eventos_insert_own_dj
  ON public.elixis_agenda_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND es_confidencial_staff = false);

COMMENT ON POLICY elixis_agenda_eventos_insert_own_dj ON public.elixis_agenda_eventos IS
  'Un DJ inserta solo eventos propios y nunca marcados confidenciales.';

-- ─── RPC de escritura (service_role only, la llama elixis-chat) ─────────────
-- Resuelve dj_nombre -> user_id contra dj_profiles (stage_name/dj_name/
-- full_name), igual que el resto del roster de ELIXIS. accion='crear' inserta;
-- accion IN ('actualizar','suspender','reactivar','cancelar') busca el evento
-- activo más reciente que calce dj+venue+fecha y lo actualiza -- nunca inventa
-- un id que no existe.

DROP FUNCTION IF EXISTS public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.elixis_agenda_evento_modificar(
  p_dj_nombre          text,
  p_venue_nombre       text,
  p_fecha_inicio       timestamptz,
  p_fecha_fin          timestamptz,
  p_accion             text,
  p_tipo               text DEFAULT 'nota',
  p_estado             text DEFAULT 'activo',
  p_notas              text DEFAULT NULL,
  p_tarifa_venue_cents integer DEFAULT NULL,
  p_pago_dj_cents      integer DEFAULT NULL,
  p_staff_user_id      uuid DEFAULT NULL,
  p_agent_id           text DEFAULT 'elixis'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_match_ct integer;
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

  SELECT d.user_id, count(*) OVER ()
    INTO v_user_id, v_match_ct
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
      tarifa_venue_cents, pago_dj_cents, estado, notas, staff_user_id, agent_id
    ) VALUES (
      v_user_id, btrim(p_dj_nombre), v_venue, p_fecha_inicio, p_fecha_fin, v_tipo,
      p_tarifa_venue_cents, p_pago_dj_cents, v_estado, v_notas, p_staff_user_id, v_agent
    )
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- actualizar / suspender / reactivar / cancelar: busca el evento más
  -- reciente que calce dj + fecha_inicio exacta (y venue, si vino).
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
     SET fecha_fin          = p_fecha_fin,
         tipo               = v_tipo,
         estado             = CASE
                                 WHEN v_accion = 'cancelar' THEN 'suspendido'
                                 WHEN v_accion = 'suspender' THEN 'suspendido'
                                 WHEN v_accion = 'reactivar' THEN 'activo'
                                 ELSE v_estado
                               END,
         tarifa_venue_cents = COALESCE(p_tarifa_venue_cents, tarifa_venue_cents),
         pago_dj_cents      = COALESCE(p_pago_dj_cents, pago_dj_cents),
         notas              = COALESCE(v_notas, notas),
         updated_at         = now()
   WHERE id = v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text) TO service_role;

COMMENT ON FUNCTION public.elixis_agenda_evento_modificar(text, text, timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, text) IS
  'Escritura de elixis_agenda_eventos para el tool modificar_agenda_evento. EXECUTE solo service_role. Resuelve dj_nombre contra dj_profiles; nunca inventa un user_id.';

NOTIFY pgrst, 'reload schema';
