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
-- ÁREAS (p_maps = ids de área): una sala se vende por ÁREAS (salón principal, VIP, terraza…). Un área es un área libre dibujada marcada «venta» (las mesas que
-- quedan dentro de su contorno le pertenecen) o, en una sala sin áreas dibujadas, cada plano completo. Normalmente se venden todas juntas (p_maps = null). Para un
-- evento especial (p. ej. el VIP separado por una pared) se pasa la lista de áreas que SÍ se venden; las marcadas «siempre» (una terraza pública) entran en todo
-- evento y no se pueden cerrar. También sirve para cerrar o volver a abrir un área después de abrir la venta: se quitan las mesas libres del área cerrada, pero si ya
-- hay ventas, reservas o alguien pagando en ella se rechaza (area_con_ventas). Las mesas que no pertenecen a ningún área se venden siempre.
-- El catálogo de áreas está en layout.areas ([{id, label, siempre}]); la mesa dice su área en tables[].area. Sin catálogo (planos anteriores) cada plano es un área.
create or replace function public.venue_event_open_tables(p_event_id uuid, p_maps text[] default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id); v_layout jsonb; v_ev jsonb; v_room jsonb; n integer; v_total integer; v_unicas integer;
  v_cat jsonb; v_aid text; v_siempre text[]; v_keys text[]; v_maps jsonb := '[]'::jsonb; v_tabs jsonb := '[]'::jsonb; v_geo jsonb := '[]'::jsonb;
  rm jsonb; em jsonb; tt jsonb; g jsonb; ge jsonb; v_rmaps jsonb; v_emaps jsonb;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select e.layout, r.layout into v_ev, v_room from public.venue_events e join public.venue_rooms r on r.id = e.room_id where e.id = p_event_id for update of e;
  v_layout := case when v_ev ? 'tables' then v_ev else v_room end;
  if v_layout is null or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' or jsonb_array_length(v_layout -> 'tables') = 0 then
    raise exception 'sin_mapa';
  end if;

  if p_maps is not null then
    v_rmaps := case when jsonb_typeof(v_room -> 'maps') = 'array' then v_room -> 'maps' else '[]'::jsonb end;
    v_emaps := case when jsonb_typeof(v_ev -> 'maps') = 'array' then v_ev -> 'maps' else '[]'::jsonb end;
    -- catálogo de áreas: el de la sala o, si no trae, un área por plano
    v_cat := case when jsonb_typeof(v_room -> 'areas') = 'array' then v_room -> 'areas'
                  else (select coalesce(jsonb_agg(jsonb_build_object('id', x ->> 'id', 'label', x ->> 'label', 'siempre', coalesce(x ->> 'siempre' = 'true', false))), '[]'::jsonb)
                          from jsonb_array_elements(v_rmaps) x where x ? 'id') end;
    if coalesce(array_length(p_maps, 1), 0) not between 1 and 24 or (select count(distinct x) from unnest(p_maps) x) <> array_length(p_maps, 1) or array_position(p_maps, null) is not null then
      raise exception 'areas_invalidas';
    end if;
    -- las áreas «siempre abiertas» no se cierran: entran en todo evento aunque no se elijan
    select coalesce(array_agg(x ->> 'id'), '{}') into v_siempre from jsonb_array_elements(v_cat) x where x ->> 'siempre' = 'true' and not ((x ->> 'id') = any (p_maps));
    p_maps := p_maps || v_siempre;
    foreach v_aid in array p_maps loop
      if not exists (select 1 from jsonb_array_elements(v_cat) x where x ->> 'id' = v_aid) then raise exception 'areas_invalidas'; end if;
    end loop;

    -- mesas que se quedan: las de las áreas elegidas y las que no pertenecen a ningún área
    for tt in select * from jsonb_array_elements(case when jsonb_typeof(v_room -> 'tables') = 'array' then v_room -> 'tables' else '[]'::jsonb end) loop
      v_aid := nullif(tt ->> 'area', '');
      if v_aid is null and jsonb_typeof(v_room -> 'areas') is distinct from 'array' then          -- salas anteriores (sin catálogo): el área es el plano que dibuja la mesa
        select m ->> 'id' into v_aid from jsonb_array_elements(v_rmaps) m, jsonb_array_elements(case when jsonb_typeof(m -> 'tables') = 'array' then m -> 'tables' else '[]'::jsonb end) q
         where q ->> 'id' = tt ->> 'key' limit 1;
      end if;                                                                                   -- con catálogo, una mesa sin área no pertenece a ninguna (se vende siempre)
      if v_aid is null or v_aid = any (p_maps) then v_tabs := v_tabs || jsonb_build_array(tt); end if;
    end loop;
    if jsonb_array_length(v_tabs) = 0 then raise exception 'sin_mapa'; end if;
    select coalesce(array_agg(x ->> 'key'), '{}') into v_keys from jsonb_array_elements(v_tabs) x;

    -- dibujo del evento: cada plano con SOLO las mesas que se quedan (con su lugar en el evento si ya se movieron); un plano sin mesas que antes las tenía se quita
    for rm in select * from jsonb_array_elements(v_rmaps) loop
      em := null; v_geo := '[]'::jsonb;
      select x into em from jsonb_array_elements(v_emaps) x where x ->> 'id' = rm ->> 'id' limit 1;
      for g in select * from jsonb_array_elements(case when jsonb_typeof(rm -> 'tables') = 'array' then rm -> 'tables' else '[]'::jsonb end) loop
        if (g ->> 'id') = any (v_keys) then
          ge := null;
          if em is not null and jsonb_typeof(em -> 'tables') = 'array' then select x into ge from jsonb_array_elements(em -> 'tables') x where x ->> 'id' = g ->> 'id' limit 1; end if;
          v_geo := v_geo || jsonb_build_array(coalesce(ge, g));
        end if;
      end loop;
      if jsonb_array_length(v_geo) > 0 or jsonb_array_length(case when jsonb_typeof(rm -> 'tables') = 'array' then rm -> 'tables' else '[]'::jsonb end) = 0 then
        v_maps := v_maps || jsonb_build_array(jsonb_set(coalesce(em, rm), '{tables}', v_geo));
      end if;
    end loop;
    v_layout := jsonb_set(jsonb_set(v_layout, '{maps}', v_maps), '{tables}', v_tabs);
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
