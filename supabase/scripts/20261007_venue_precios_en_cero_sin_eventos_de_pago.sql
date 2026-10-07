-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · TODOS LOS PRECIOS DE MESA EN $0 (pedido del PO 2026-10-07: «pon todo en cero porque no hay eventos de pago todavía»).
-- Pone en 0 el precio de cada mesa y taburete: en el plano base de la sala (la plantilla, que hoy trae $160 como valor de relleno) y en la copia de cada evento NO cancelado («Operación de hoy»),
-- tanto en el plano (layout.tables) como en el inventario del evento (venue_event_tables). Cuando haya un evento de pago, cada precio se pone con «Editar» en el portal, mesa por mesa o por área.
-- NO toca: eventos cancelados (pruebas), mesas que ya estén reservadas o vendidas (solo las libres; hoy no hay ninguna vendida), tipos de entrada (venue_ticket_types), órdenes ni pagos, ni el dibujo.
-- Idempotente: volver a correrlo no cambia nada.

update public.venue_rooms r
   set layout = jsonb_set(r.layout, '{tables}', (select coalesce(jsonb_agg(jsonb_set(t, '{price_cents}', '0'::jsonb) order by ord), '[]'::jsonb)
                                                   from jsonb_array_elements(r.layout -> 'tables') with ordinality as x(t, ord))),
       updated_at = now()
 where jsonb_typeof(r.layout -> 'tables') = 'array' and jsonb_array_length(r.layout -> 'tables') > 0
   and exists (select 1 from jsonb_array_elements(r.layout -> 'tables') t where coalesce((t ->> 'price_cents')::numeric, 0) <> 0);

update public.venue_events e
   set layout = jsonb_set(e.layout, '{tables}', (select coalesce(jsonb_agg(jsonb_set(t, '{price_cents}', '0'::jsonb) order by ord), '[]'::jsonb)
                                                   from jsonb_array_elements(e.layout -> 'tables') with ordinality as x(t, ord))),
       updated_at = now()
 where e.status <> 'cancelled' and jsonb_typeof(e.layout -> 'tables') = 'array' and jsonb_array_length(e.layout -> 'tables') > 0
   and exists (select 1 from jsonb_array_elements(e.layout -> 'tables') t where coalesce((t ->> 'price_cents')::numeric, 0) <> 0);

update public.venue_event_tables k
   set price_cents = 0
  from public.venue_events e
 where e.id = k.event_id and e.status <> 'cancelled' and k.status = 'available' and k.price_cents <> 0;

-- ── Comprobación (solo lectura). Esperado: plantilla_precios=[0], evento_vivo_layout=[0], evento_vivo_inventario=[0], no_libres_con_precio=0 (nada vendido se tocó), cancelados_sin_tocar=true ──
select (select jsonb_agg(distinct (t ->> 'price_cents')::numeric) from public.venue_rooms r, jsonb_array_elements(r.layout -> 'tables') t) as plantilla_precios,
       (select jsonb_agg(distinct (t ->> 'price_cents')::numeric) from public.venue_events e, jsonb_array_elements(e.layout -> 'tables') t where e.status <> 'cancelled') as evento_vivo_layout,
       (select jsonb_agg(distinct k.price_cents) from public.venue_event_tables k join public.venue_events e on e.id = k.event_id where e.status <> 'cancelled') as evento_vivo_inventario,
       (select count(*) from public.venue_event_tables k join public.venue_events e on e.id = k.event_id where e.status <> 'cancelled' and k.status <> 'available' and k.price_cents <> 0) as no_libres_con_precio,
       (select coalesce(bool_and(k.price_cents <> 0), true) from public.venue_event_tables k join public.venue_events e on e.id = k.event_id where e.status = 'cancelled') as cancelados_sin_tocar;
