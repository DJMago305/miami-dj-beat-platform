-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · LLEVAR EL DISEÑO DE UN DÍA NORMAL A LA PLANTILLA (pedido del PO 2026-10-07: «ese es el diseño de un día normal en Mojitos Calle 8, de lunes a domingo»).
-- Por qué: cada día «Operación de hoy» se crea copiando la PLANTILLA de la sala (venue_open_day), no el día anterior. Hoy el diseño bueno vive solo en el evento de hoy y la plantilla sigue con el diseño viejo
-- (22 mesas, terraza con los cuadros T01-T12): mañana el día arrancaría con el diseño viejo.
-- Qué hace: copia a la plantilla el DIBUJO (arquitectura y mesas: layout.maps) y la LISTA de mesas (layout.tables) de la «Operación de hoy» más reciente de esa sala, con TODOS los precios en $0 (día regular, sin venta).
-- Se queda como está en la plantilla: el catálogo de áreas (layout.areas) y el estado del editor (layout.builder).
-- Córrelo DESPUÉS de dejar el diseño de hoy como lo quieres (por ejemplo, las sillas por lado de las mesas largas): copia lo que haya en ese momento.
-- NO toca: eventos (ni el de hoy ni los cancelados), inventario, ventas, ni la sala pública. Solo cambia venue_rooms.layout.
-- Se detiene sin cambiar nada si no hay «Operación de hoy», si el plano del evento no es consistente (mesas del dibujo y de la lista no coinciden, llaves repetidas) o si la plantilla YA no tiene el diseño viejo (mesas L01 y P03; el viejo trae X01 y X02, por eso no sirven de marca):
-- así no se pisa lo que el PO ajuste después en la plantilla.

do $$
declare
  v_room record; v_ev record; v_listo integer := 0; v_tablas jsonb; v_n_dibujo integer; v_n_lista integer; v_unicas integer;
begin
  for v_room in select r.id, r.layout from public.venue_rooms r where coalesce(r.active, true) and r.layout is not null loop
    select e.id, e.layout into v_ev from public.venue_events e where e.room_id = v_room.id and e.status = 'operation' and e.layout is not null order by e.event_date desc, e.created_at desc limit 1;
    if v_ev.id is null then raise notice 'Sala %: no hay Operación de hoy; no se cambia nada.', v_room.id; continue; end if;
    if jsonb_typeof(v_ev.layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_ev.layout -> 'maps') = 0 or jsonb_typeof(v_ev.layout -> 'tables') is distinct from 'array' then
      raise exception 'plano_del_evento_invalido'; end if;
    select count(*) into v_n_dibujo from jsonb_array_elements(v_ev.layout -> 'maps' -> 0 -> 'tables');
    select count(*), count(distinct t ->> 'key') into v_n_lista, v_unicas from jsonb_array_elements(v_ev.layout -> 'tables') t;
    if v_n_dibujo <> v_n_lista or v_unicas <> v_n_lista or v_n_lista = 0
       or exists (select 1 from jsonb_array_elements(v_ev.layout -> 'tables') t where not exists (select 1 from jsonb_array_elements(v_ev.layout -> 'maps' -> 0 -> 'tables') g where g ->> 'id' = t ->> 'key')) then
      raise exception 'plano_del_evento_inconsistente'; end if;
    if not exists (select 1 from jsonb_array_elements(coalesce(v_room.layout -> 'tables', '[]'::jsonb)) t where t ->> 'key' in ('L01', 'P03')) then
      raise notice 'Sala %: la plantilla ya no tiene el diseño viejo (mesas L01/P03); no se cambia nada.', v_room.id; continue; end if;
    select coalesce(jsonb_agg(jsonb_set(t, '{price_cents}', '0'::jsonb) order by ord), '[]'::jsonb) into v_tablas from jsonb_array_elements(v_ev.layout -> 'tables') with ordinality as x(t, ord);
    update public.venue_rooms set layout = jsonb_set(jsonb_set(layout, '{maps}', v_ev.layout -> 'maps'), '{tables}', v_tablas), updated_at = now() where id = v_room.id;
    v_listo := v_listo + 1;
  end loop;
  raise notice 'Plantillas actualizadas: %', v_listo;
end $$;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: mesas_plantilla = mesas_hoy, dibujo = lista, precios_plantilla=[0], tiene_diseno_viejo=false, marcas_t_plantilla=0, areas y builder iguales que antes, eventos intactos ──
select (select jsonb_array_length(r.layout -> 'tables') from public.venue_rooms r limit 1) as mesas_plantilla,
       (select jsonb_array_length(r.layout -> 'maps' -> 0 -> 'tables') from public.venue_rooms r limit 1) as dibujo_plantilla,
       (select jsonb_array_length(e.layout -> 'tables') from public.venue_events e where e.status = 'operation' order by e.event_date desc limit 1) as mesas_hoy,
       (select jsonb_agg(distinct (t ->> 'price_cents')::numeric) from public.venue_rooms r, jsonb_array_elements(r.layout -> 'tables') t) as precios_plantilla,
       (select exists (select 1 from public.venue_rooms r, jsonb_array_elements(r.layout -> 'tables') t where t ->> 'key' in ('L01', 'P03'))) as tiene_diseno_viejo,
       (select count(*) from public.venue_rooms r, jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') s where s ->> 'label' ~ '^T[0-9]{1,3}$') as marcas_t_plantilla,
       (select jsonb_array_length(r.layout -> 'areas') from public.venue_rooms r limit 1) as areas_plantilla,
       (select count(*) from public.venue_events) as eventos;
