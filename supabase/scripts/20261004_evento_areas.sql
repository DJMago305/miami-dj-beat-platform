-- ============================================================================
-- ENTORNO: PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr) — *** NO APLICADO *** (preparado el 2026-10-04)
-- Quién lo aplica: el PO, en el SQL Editor de Supabase. REEMPLAZA venue_event_open_tables (DROP de la versión de un solo argumento + CREATE con p_maps);
-- no cambia ni borra datos. Requiere 20261003_sala_mesas_inventario_por_evento.sql.
-- ============================================================================
-- ÁREAS DE UN EVENTO: Mojitos Calle 8 no es un bloque: tiene sala principal, VIP y terraza, y casi siempre se venden juntas; en una ocasión especial se cierra una
-- (p. ej. el VIP se separa con una pared). Una sala = varios planos; al abrir la venta de un evento se elige qué planos (áreas) se venden.
-- ============================================================================
-- La versión anterior (solo p_event_id) se reemplaza: con las dos firmas a la vez, llamar con un solo argumento sería ambiguo.
drop function if exists public.venue_event_open_tables(uuid);
-- Abre la venta de mesas de un evento: copia el mapa de la sala y crea una fila por mesa. Idempotente: volver a correrla NO pisa mesas vendidas,
-- apartadas ni en espera (ON CONFLICT DO NOTHING).
-- ÁREAS (p_maps): una sala puede tener varios planos (Sala principal, VIP, Terraza…). Normalmente se venden todos juntos (p_maps = null). Un plano marcado «siempre»: true
-- (una terraza pública, abierta siempre) entra en todo evento y no se puede cerrar. Para un evento especial
-- (p. ej. el VIP separado por una pared) se pasa la lista de planos que SÍ se venden: solo esos quedan en el evento. También sirve para cerrar o volver a abrir un área
-- después de abrir la venta: se quitan las mesas libres del área cerrada, pero si ya hay ventas, reservas o alguien pagando en ella se rechaza (area_con_ventas).
create or replace function public.venue_event_open_tables(p_event_id uuid, p_maps text[] default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id); v_layout jsonb; v_ev jsonb; v_room jsonb; n integer; v_total integer; v_unicas integer;
  v_id text; m jsonb; mt jsonb; v_tb jsonb; v_maps jsonb := '[]'::jsonb; v_tabs jsonb := '[]'::jsonb; v_keys text[]; v_desde_ev boolean; v_siempre text[];
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select e.layout, r.layout into v_ev, v_room from public.venue_events e join public.venue_rooms r on r.id = e.room_id where e.id = p_event_id for update of e;
  v_layout := case when v_ev ? 'tables' then v_ev else v_room end;
  if v_layout is null or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' or jsonb_array_length(v_layout -> 'tables') = 0 then
    raise exception 'sin_mapa';
  end if;

  if p_maps is not null then
    if coalesce(array_length(p_maps, 1), 0) not between 1 and 12 or (select count(distinct x) from unnest(p_maps) x) <> array_length(p_maps, 1) or array_position(p_maps, null) is not null then
      raise exception 'areas_invalidas';
    end if;
    -- Las áreas marcadas «siempre abiertas» (p. ej. una terraza pública) no se cierran: entran en todo evento aunque no se elijan.
    select coalesce(array_agg(x ->> 'id'), '{}') into v_siempre from jsonb_array_elements(case when jsonb_typeof(v_room -> 'maps') = 'array' then v_room -> 'maps' else '[]'::jsonb end) x
     where x ->> 'siempre' = 'true' and not ((x ->> 'id') = any (p_maps));
    p_maps := p_maps || v_siempre;
    foreach v_id in array p_maps loop
      m := null; v_desde_ev := false;
      select x into m from jsonb_array_elements(case when jsonb_typeof(v_ev -> 'maps') = 'array' then v_ev -> 'maps' else '[]'::jsonb end) x where x ->> 'id' = v_id limit 1;
      if m is not null then v_desde_ev := true; end if;
      if m is null then
        select x into m from jsonb_array_elements(case when jsonb_typeof(v_room -> 'maps') = 'array' then v_room -> 'maps' else '[]'::jsonb end) x where x ->> 'id' = v_id limit 1;
      end if;
      if m is null then raise exception 'areas_invalidas'; end if;
      v_maps := v_maps || jsonb_build_array(m);
      for v_tb in select * from jsonb_array_elements(case when jsonb_typeof(m -> 'tables') = 'array' then m -> 'tables' else '[]'::jsonb end) loop
        select x into mt from jsonb_array_elements(case when v_desde_ev then v_ev -> 'tables' else v_room -> 'tables' end) x where x ->> 'key' = v_tb ->> 'id' limit 1;
        if mt is not null then v_tabs := v_tabs || jsonb_build_array(mt); end if;
      end loop;
    end loop;
    if jsonb_array_length(v_tabs) = 0 then raise exception 'sin_mapa'; end if;
    v_layout := jsonb_set(jsonb_set(v_layout, '{maps}', v_maps), '{tables}', v_tabs);
    select coalesce(array_agg(x ->> 'key'), '{}') into v_keys from jsonb_array_elements(v_tabs) x;
    -- cerrar un área: se quitan sus mesas libres; si ya hay ventas, reservas o alguien pagando, no se toca nada
    if exists (select 1 from public.venue_event_tables k where k.event_id = p_event_id and k.table_key <> all (v_keys)
                and (k.status in ('sold', 'reserved') or (k.status = 'held' and k.held_until >= now()))) then
      raise exception 'area_con_ventas';
    end if;
    delete from public.venue_event_tables k where k.event_id = p_event_id and k.table_key <> all (v_keys);
  end if;

  select count(*), count(distinct t ->> 'key') into v_total, v_unicas from jsonb_array_elements(v_layout -> 'tables') t;
  if v_unicas <> v_total or exists (select 1 from jsonb_array_elements(v_layout -> 'tables') t where coalesce(t ->> 'key', '') = '' or (t ->> 'price_cents') is null) then
    raise exception 'mapa_invalido';   -- llaves repetidas / vacías o mesa sin precio
  end if;
  update public.venue_events set layout = v_layout, tables_open = true, updated_at = now() where id = p_event_id;
  insert into public.venue_event_tables (event_id, table_key, label, seats, zone_name, price_cents)
    select p_event_id, t ->> 'key', coalesce(nullif(t ->> 'label', ''), t ->> 'key'), coalesce((t ->> 'seats')::integer, 4), t ->> 'zone', (t ->> 'price_cents')::integer
      from jsonb_array_elements(v_layout -> 'tables') t
    on conflict (event_id, table_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.venue_event_open_tables(uuid, text[]) from public, anon, authenticated;
grant execute on function public.venue_event_open_tables(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';

-- Comprobación: 1 fila, con la firma (uuid, text[]) y solo "authenticated" puede ejecutarla.
select p.oid::regprocedure as funcion, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'venue_event_open_tables';
