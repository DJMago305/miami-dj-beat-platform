-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Dos cableados para que registrar y rotar turnos/eventos NO dependa de SQL a mano:
--
-- 1) Una excepción de residencia con DJ pero sin dj_id resuelve sola el dj_id. El formulario manual del
--    calendario («Reemplazar DJ → solo esta fecha») manda solo el nombre escrito; sin dj_id el Cash Flow
--    (une por COALESCE(ex.dj_id, regla.dj_id)) le pagaría el turno al DJ de la regla en vez de al que cubrió.
--    Si el nombre no existe o es ambiguo se rechaza con un error claro en vez de guardar a medias.
--
-- 2) staff_registrar_evento_con_pago(): lo que usa el formulario «Registrar evento con pago» del calendario.
--    Solo owner/admin. Crea el evento en elixis_agenda_eventos; el disparador trg_elixis_evento_pago_cash_flow
--    crea el ingreso en el Cash Flow del DJ (fecha del evento, sin comisión). Admite fechas pasadas
--    (registro retroactivo). Evita duplicados (doble clic = doble pago). Avisa al DJ solo si el evento es futuro.

-- ───────── 1) resolver dj_id en excepciones ─────────
CREATE OR REPLACE FUNCTION public.residency_exception_resolver_dj()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n  int;
  v_dj public.dj_profiles%ROWTYPE;
BEGIN
  IF NEW.skip OR NEW.dj_id IS NOT NULL OR NULLIF(btrim(coalesce(NEW.dj_name, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.dj_profiles d
   WHERE d.user_id IS NOT NULL
     AND lower(coalesce(d.role, '')) = 'dj'
     AND (lower(btrim(coalesce(d.stage_name, ''))) = lower(btrim(NEW.dj_name))
          OR lower(btrim(coalesce(d.dj_name, ''))) = lower(btrim(NEW.dj_name))
          OR lower(btrim(coalesce(d.full_name, ''))) = lower(btrim(NEW.dj_name)));
  IF v_n = 0 THEN
    RAISE EXCEPTION 'dj_no_encontrado';
  ELSIF v_n > 1 THEN
    RAISE EXCEPTION 'dj_ambiguo';
  END IF;

  SELECT d.* INTO v_dj
    FROM public.dj_profiles d
   WHERE d.user_id IS NOT NULL
     AND lower(coalesce(d.role, '')) = 'dj'
     AND (lower(btrim(coalesce(d.stage_name, ''))) = lower(btrim(NEW.dj_name))
          OR lower(btrim(coalesce(d.dj_name, ''))) = lower(btrim(NEW.dj_name))
          OR lower(btrim(coalesce(d.full_name, ''))) = lower(btrim(NEW.dj_name)));

  NEW.dj_id   := v_dj.id;
  NEW.dj_name := coalesce(v_dj.stage_name, v_dj.dj_name, v_dj.full_name);
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.residency_exception_resolver_dj() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_residency_exceptions_a_resolver_dj ON public.residency_schedule_exceptions;
CREATE TRIGGER trg_residency_exceptions_a_resolver_dj
  BEFORE INSERT OR UPDATE OF dj_id, dj_name, skip
  ON public.residency_schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.residency_exception_resolver_dj();

-- ───────── 2) registrar evento con pago desde el calendario ─────────
CREATE OR REPLACE FUNCTION public.staff_registrar_evento_con_pago(
  p_dj_user_id        uuid,
  p_venue             text,
  p_fecha             date,
  p_hora_inicio       time,
  p_hora_fin          time,
  p_pago_dj_usd       numeric,
  p_tarifa_venue_usd  numeric DEFAULT NULL,
  p_tipo              text    DEFAULT 'privado',
  p_notas             text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_dj     public.dj_profiles%ROWTYPE;
  v_venue  text := NULLIF(btrim(coalesce(p_venue, '')), '');
  v_tipo   text := lower(btrim(coalesce(p_tipo, 'privado')));
  v_notas  text := NULLIF(btrim(coalesce(p_notas, '')), '');
  v_ini    timestamptz;
  v_fin    timestamptz;
  v_id     uuid;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.dj_profiles s
        WHERE s.user_id = v_uid AND lower(btrim(coalesce(s.role, ''))) IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_venue IS NULL THEN RAISE EXCEPTION 'venue_requerido'; END IF;
  IF p_fecha IS NULL OR p_hora_inicio IS NULL OR p_hora_fin IS NULL THEN RAISE EXCEPTION 'fecha_y_horas_requeridas'; END IF;
  IF v_tipo NOT IN ('privado', 'boda') THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF p_pago_dj_usd IS NULL OR p_pago_dj_usd <= 0 OR p_pago_dj_usd > 100000 THEN RAISE EXCEPTION 'pago_invalido'; END IF;
  IF p_tarifa_venue_usd IS NOT NULL AND (p_tarifa_venue_usd < 0 OR p_tarifa_venue_usd > 1000000) THEN RAISE EXCEPTION 'tarifa_invalida'; END IF;

  SELECT d.* INTO v_dj FROM public.dj_profiles d
   WHERE d.user_id = p_dj_user_id AND d.user_id IS NOT NULL AND lower(coalesce(d.role, '')) = 'dj';
  IF NOT FOUND THEN RAISE EXCEPTION 'dj_no_encontrado'; END IF;

  v_ini := (p_fecha + p_hora_inicio)::timestamp AT TIME ZONE 'America/New_York';
  v_fin := (p_fecha + p_hora_fin)::timestamp AT TIME ZONE 'America/New_York';
  IF v_fin <= v_ini THEN v_fin := v_fin + interval '1 day'; END IF;

  IF EXISTS (SELECT 1 FROM public.elixis_agenda_eventos e
              WHERE e.user_id = p_dj_user_id AND e.fecha_inicio = v_ini
                AND lower(btrim(coalesce(e.venue_nombre, ''))) = lower(v_venue)
                AND e.estado <> 'cancelado') THEN
    RAISE EXCEPTION 'evento_duplicado';
  END IF;

  INSERT INTO public.elixis_agenda_eventos (
    user_id, dj_nombre, venue_nombre, fecha_inicio, fecha_fin, tipo,
    tarifa_venue_cents, pago_dj_cents, estado, notas, staff_user_id, agent_id, es_confidencial_staff
  ) VALUES (
    p_dj_user_id, coalesce(v_dj.stage_name, v_dj.dj_name, v_dj.full_name), v_venue, v_ini, v_fin, v_tipo,
    CASE WHEN p_tarifa_venue_usd IS NULL THEN NULL ELSE round(p_tarifa_venue_usd * 100)::integer END,
    round(p_pago_dj_usd * 100)::integer, 'activo', v_notas, v_uid, 'staff-calendario', false
  )
  RETURNING id INTO v_id;

  -- Aviso al DJ solo si el evento todavía no ocurrió (un registro retroactivo no avisa a nadie)
  IF v_ini > now() THEN
    BEGIN
      PERFORM public._dj_notificar(p_dj_user_id, 'evento_asignado', 'Evento asignado',
        v_venue || ' el ' || to_char(p_fecha, 'DD/MM/YYYY') || ' de ' || to_char(p_hora_inicio, 'HH12:MI AM')
          || ' a ' || to_char(p_hora_fin, 'HH12:MI AM') || '. Pago acordado: $' || to_char(p_pago_dj_usd, 'FM999990.00'),
        jsonb_build_object('agenda_evento_id', v_id, 'fecha', p_fecha));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'staff_registrar_evento_con_pago: aviso no enviado: %', SQLERRM;
    END;
  END IF;

  -- Cash Flow al instante (si falla, el proceso de cada 30 min lo recalcula igual)
  BEGIN
    PERFORM public.refresh_dj_flow_rollups_for_user(p_dj_user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'staff_registrar_evento_con_pago: recálculo diferido: %', SQLERRM;
  END;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.staff_registrar_evento_con_pago(uuid, text, date, time, time, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_registrar_evento_con_pago(uuid, text, date, time, time, numeric, numeric, text, text) TO authenticated;
