-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Corrige: (1) turnos de residencia contados desde hace 7 años cuando start_date es NULL
--          (2) registra los eventos confirmados por el PO de DJSolitario: vie 2026-09-04 y jue 2026-08-20
DO $do$
DECLARE
  d text;
  viejo text := E'COALESCE(start_date, CURRENT_DATE - INTERVAL ''7 years'')::date AS win_start,';
  nuevo text := E'LEAST(COALESCE(start_date, created_at::date),\n                    COALESCE((SELECT MIN(e.exception_date) FROM public.residency_schedule_exceptions e WHERE e.residency_id = public.residency_schedule.id), COALESCE(start_date, created_at::date))\n               )::date AS win_start,';
  veces int;
BEGIN
  d := pg_get_functiondef('public._refresh_dj_flow_rollups_core(uuid)'::regprocedure);
  IF position('WHERE e.residency_id = public.residency_schedule.id' in d) > 0 THEN
    RAISE NOTICE 'ya estaba corregida';
    RETURN;
  END IF;
  veces := (length(d) - length(replace(d, viejo, ''))) / length(viejo);
  IF veces <> 1 THEN
    RAISE EXCEPTION 'El texto esperado aparece % veces (debe ser 1). No se toca nada.', veces;
  END IF;
  EXECUTE replace(d, viejo, nuevo);
END
$do$;

-- 4 sept 2026 (viernes): turno de residencia cubierto por DJSolitario
INSERT INTO public.residency_schedule_exceptions (residency_id, exception_date, skip, dj_name, dj_id, notes)
SELECT 'b1b6c7ad-229a-4bd6-bf13-87cadea5816a', DATE '2026-09-04', false, 'DJSolitario',
       '85b3f2a3-ad73-43f9-9d6f-4c1e3a38857d',
       'Registro retroactivo: el PO confirmó el 2026-10-04 que DJSolitario trabajó este turno.'
WHERE NOT EXISTS (SELECT 1 FROM public.residency_schedule_exceptions
                  WHERE residency_id = 'b1b6c7ad-229a-4bd6-bf13-87cadea5816a' AND exception_date = DATE '2026-09-04');

-- 20 ago 2026 (jueves): Sundowner Key Largo evento flotante, pago al DJ $250 (viene de artist_agenda ef4119a9)
INSERT INTO public.dj_ledger (dj_user_id, type, amount_cents, status, event_id, metadata)
SELECT 'b31e0e33-abfb-49a3-9cf3-076fbbc659a6', 'income', 25000, 'pending',
       'agenda:ef4119a9-6fbd-46fe-9614-c7ab09b926f7',
       jsonb_build_object('source','event_sale_expected','fecha','2026-08-20',
                          'titulo','Sundowner Key Largo - Flotante',
                          'nota','Registro retroactivo confirmado por el PO el 2026-10-04')
WHERE NOT EXISTS (SELECT 1 FROM public.dj_ledger WHERE event_id = 'agenda:ef4119a9-6fbd-46fe-9614-c7ab09b926f7');

SELECT public.refresh_all_dj_flow_rollups();
