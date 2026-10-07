-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · BORRAR LOS EVENTOS DE PRUEBA (pedido del PO 2026-10-08: «elimina las pruebas»). ES UN BORRADO DEFINITIVO: no se puede deshacer.
-- Se borran SOLO estos 5 eventos (por id Y por nombre), con todo lo que cuelga de ellos. «Operación de hoy» NO se toca.
--   · PRUEBA - Plano corregido (borrar)            442117ee-5bce-4547-813b-22ca466cf29b  (cancelado; 15 mesas)
--   · PRUEBA - Mesas con areas (borrar)             5d754121-4a41-47f1-af46-b38278a06ffb  (cancelado; 37 mesas)
--   · PRUEBA · Compra de mesas (borrar)             281dad9e-211e-42cf-a812-546ca5ae7f03  (cancelado; 36 mesas; 3 órdenes de prueba de Stripe en modo prueba, estado cancelled_test)
--   · PRUEBA · Concierto Ruddy La Scala (borrar)    db5ebb9b-d96d-4524-be70-5c4d408a8366  (lista de espera; 1 orden de prueba cs_test_manual con 2 pases y 9 escaneos de la prueba de puerta)
--   · Prueba Fase 4 - Checkout QA                   e468f40e-755e-4af7-9032-ceb4a12f1011  (cancelado; 1 entrada de prueba de $1, orden cancelled_test)
-- Revisado antes en producción: TODAS las órdenes, pases y escaneos que existen en el sistema de salas son de estos 5 eventos (5 órdenes, 2 pases, 9 escaneos), ninguna orden tiene pago, cliente real ni lead asociado
-- (payments, leads, merch_orders y discount_redemptions: 0 filas con esas sesiones), y no hay lista de espera de clientes. Después de esto, las tablas de órdenes, pases y escaneos quedan vacías.
-- Seguridad: todo ocurre en una sola transacción; si algún conteo no es el esperado, se detiene SIN borrar nada.
-- Orden: escaneos → pases → órdenes → eventos (las mesas del inventario y los tipos de entrada de esos eventos se borran solas con el evento).

do $$
declare
  v_ids uuid[] := array['442117ee-5bce-4547-813b-22ca466cf29b', '5d754121-4a41-47f1-af46-b38278a06ffb', '281dad9e-211e-42cf-a812-546ca5ae7f03', 'db5ebb9b-d96d-4524-be70-5c4d408a8366', 'e468f40e-755e-4af7-9032-ceb4a12f1011']::uuid[];
  n_ev integer; n_ord integer; n_guests integer; n_logs integer; n_hoy integer; n_otros_ord integer; n_otros_guests integer; n_otros_logs integer; n_pay integer;
begin
  select count(*) into n_ev from public.venue_events where id = any (v_ids) and (title like 'PRUEBA%' or title like 'Prueba%') and status in ('cancelled', 'waitlist');
  if n_ev = 0 then raise notice 'No quedan eventos de prueba; no se borra nada.'; return; end if;
  if n_ev <> 5 then raise exception 'se esperaban 5 eventos de prueba y hay % (alguno cambió de nombre o estado); no se borra nada', n_ev; end if;
  select count(*) into n_hoy from public.venue_events where status = 'operation';
  select count(*) into n_ord from public.venue_ticket_orders where event_id = any (v_ids);
  select count(*) into n_otros_ord from public.venue_ticket_orders where not (event_id = any (v_ids));
  select count(*) into n_guests from public.venue_ticket_guests where event_id = any (v_ids);
  select count(*) into n_otros_guests from public.venue_ticket_guests where not (event_id = any (v_ids));
  select count(*) into n_logs from public.venue_ticket_scan_logs where event_id = any (v_ids);
  select count(*) into n_otros_logs from public.venue_ticket_scan_logs where not (event_id = any (v_ids));
  select count(*) into n_pay from public.payments p where p.stripe_session_id in (select stripe_session_id from public.venue_ticket_orders where event_id = any (v_ids) and stripe_session_id is not null);
  if n_otros_ord <> 0 or n_otros_guests <> 0 or n_otros_logs <> 0 then raise exception 'hay órdenes, pases o escaneos de OTROS eventos (% / % / %); no se borra nada', n_otros_ord, n_otros_guests, n_otros_logs; end if;
  if n_pay <> 0 then raise exception 'alguna orden de prueba tiene un pago registrado (%); no se borra nada', n_pay; end if;
  if exists (select 1 from public.venue_ticket_orders where event_id = any (v_ids) and (stripe_session_id is null or stripe_session_id not like 'cs_test%')) then
    raise exception 'alguna orden no es de prueba de Stripe (cs_test…); no se borra nada'; end if;
  if n_ord <> 5 or n_guests <> 2 or n_logs <> 9 then raise exception 'conteos distintos a los revisados (órdenes %, pases %, escaneos %); no se borra nada', n_ord, n_guests, n_logs; end if;

  delete from public.venue_ticket_scan_logs where event_id = any (v_ids);
  delete from public.venue_ticket_guests where event_id = any (v_ids);
  delete from public.venue_ticket_orders where event_id = any (v_ids);
  delete from public.venue_events where id = any (v_ids);
  if (select count(*) from public.venue_events where status = 'operation') <> n_hoy then raise exception 'la Operación de hoy cambió; se deshace todo'; end if;
  raise notice 'Borrados: 5 eventos, % órdenes, % pases, % escaneos.', n_ord, n_guests, n_logs;
end $$;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: eventos=1 (solo «Operación de hoy»), pruebas_restantes=0, ordenes=0, pases=0, escaneos=0, inventario=65 (el de hoy), tipos_entrada=0, operacion_de_hoy_mesas=65 ──
select (select count(*) from public.venue_events) as eventos,
       (select count(*) from public.venue_events where title ilike 'prueba%') as pruebas_restantes,
       (select count(*) from public.venue_ticket_orders) as ordenes,
       (select count(*) from public.venue_ticket_guests) as pases,
       (select count(*) from public.venue_ticket_scan_logs) as escaneos,
       (select count(*) from public.venue_event_tables) as inventario,
       (select count(*) from public.venue_ticket_types) as tipos_entrada,
       (select jsonb_array_length(layout -> 'tables') from public.venue_events where status = 'operation') as operacion_de_hoy_mesas;
