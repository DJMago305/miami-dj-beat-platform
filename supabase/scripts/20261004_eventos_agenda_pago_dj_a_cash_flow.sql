-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Cableado: un evento de negocio de la agenda operativa de ELIXIS (elixis_agenda_eventos) con
-- pago al DJ (pago_dj_cents) crea solo el ingreso en el Cash Flow del DJ, con la fecha del evento
-- y sin comisión (el pago acordado ya es neto), igual que los eventos que vienen de leads.
--
-- Reglas:
--   * Solo tipo 'privado' y 'boda' con estado 'activo' y pago > 0. 'residencia' ya cuenta por
--     residency_schedule (contarlo aquí sería doble). 'nota' y 'cumpleanos' no son dinero.
--   * No se registra si el evento es confidencial de staff ni si el DJ es el owner (DJMago305),
--     igual que las residencias.
--   * Al cancelar/suspender, bajar el pago a 0 o cambiar el DJ, la línea pendiente se retira.
--     Una línea ya liberada ('event_sale_release') no se toca.
--   * Idempotente: una línea por evento (event_id = 'agenda_evento:<id>').
--   * NO rellena eventos anteriores: solo actúa en eventos nuevos o editados desde ahora.
--   * El recálculo del Cash Flow lo hace solo el proceso dj_flow_rollups_refresh (cada 30 min).

CREATE OR REPLACE FUNCTION public.elixis_evento_pago_a_cash_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id text := 'agenda_evento:' || NEW.id::text;
  v_owner    constant uuid := '3f5d5196-273c-458e-a4af-6b3545422177';
  v_ok       boolean;
  v_fecha    date;
BEGIN
  -- Si el evento cambió de DJ, retirar la línea pendiente del DJ anterior
  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    DELETE FROM public.dj_ledger
     WHERE dj_user_id = OLD.user_id AND event_id = v_event_id
       AND type = 'income' AND status = 'pending'
       AND coalesce(metadata->>'source', '') = 'event_sale_expected';
  END IF;

  v_ok := NEW.user_id IS NOT NULL
      AND NEW.user_id <> v_owner
      AND NEW.tipo IN ('privado', 'boda')
      AND NEW.estado = 'activo'
      AND coalesce(NEW.pago_dj_cents, 0) > 0
      AND NOT coalesce(NEW.es_confidencial_staff, false)
      AND EXISTS (SELECT 1 FROM public.dj_profiles d
                   WHERE d.user_id = NEW.user_id AND lower(coalesce(d.role, '')) = 'dj');

  IF NOT v_ok THEN
    DELETE FROM public.dj_ledger
     WHERE dj_user_id = NEW.user_id AND event_id = v_event_id
       AND type = 'income' AND status = 'pending'
       AND coalesce(metadata->>'source', '') = 'event_sale_expected';
    RETURN NEW;
  END IF;

  -- ya liberada por el staff: no se toca
  IF EXISTS (SELECT 1 FROM public.dj_ledger
              WHERE dj_user_id = NEW.user_id AND event_id = v_event_id
                AND coalesce(metadata->>'source', '') = 'event_sale_release') THEN
    RETURN NEW;
  END IF;

  v_fecha := (NEW.fecha_inicio AT TIME ZONE 'America/New_York')::date;

  UPDATE public.dj_ledger
     SET amount_cents = NEW.pago_dj_cents,
         metadata = metadata || jsonb_build_object('fecha', v_fecha::text,
                                                   'evento', coalesce(NEW.venue_nombre, NEW.tipo))
   WHERE dj_user_id = NEW.user_id AND event_id = v_event_id
     AND type = 'income' AND status = 'pending'
     AND coalesce(metadata->>'source', '') = 'event_sale_expected';

  IF NOT FOUND THEN
    INSERT INTO public.dj_ledger (dj_user_id, type, amount_cents, status, event_id, metadata)
    VALUES (NEW.user_id, 'income', NEW.pago_dj_cents, 'pending', v_event_id,
            jsonb_build_object('source', 'event_sale_expected',
                               'agenda_evento_id', NEW.id,
                               'evento', coalesce(NEW.venue_nombre, NEW.tipo),
                               'fecha', v_fecha::text));
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.elixis_evento_pago_a_cash_flow() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_elixis_evento_pago_cash_flow ON public.elixis_agenda_eventos;
CREATE TRIGGER trg_elixis_evento_pago_cash_flow
  AFTER INSERT OR UPDATE OF user_id, tipo, estado, pago_dj_cents, fecha_inicio, es_confidencial_staff
  ON public.elixis_agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.elixis_evento_pago_a_cash_flow();
