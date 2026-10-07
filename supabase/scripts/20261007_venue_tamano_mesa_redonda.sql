-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · TAMAÑO DE LA MESA REDONDA (pedido del PO 2026-10-07: «las mesas redondas del VIP son chiquitas pero de 4 sillas altas y ahí solo pude poner las medianas de 4»).
-- Requiere 20261007_venue_taburetes_de_barra.sql y 20261007_venue_terraza_mesas_numeradas_y_movibles.sql ya aplicados. Sin tablas ni columnas nuevas.
--
-- Hasta ahora el tamaño de una mesa redonda salía SOLO del número de sillas (1-2: chica · 3-6: mediana · 7+: grande). Ahora cada mesa redonda puede llevar su tamaño propio en el dibujo
-- (maps[].tables[].r = radio: 24 chica · 36 mediana · 48 grande); sin ese dato todo sigue igual que hoy. Una mesa alta de 4 sillas es una redonda CHICA (24) con 4 sillas.
--   1) venue_mesa_radio_r / venue_mesa_margen_r: el radio y el margen a la estructura usan el tamaño propio si lo tiene (las funciones de siempre no se tocan).
--   2) venue_room_add_table y venue_event_add_table ganan un parámetro final opcional p_radius (24, 36 o 48; solo redondas). Se reemplazan (se borra la firma de 7 parámetros para que no quede
--      una segunda versión que cause ambigüedad; los llamados de 7 parámetros siguen funcionando).
--   3) venue_room_move_tables, venue_event_move_tables y venue_plano_mover_muebles: usan el tamaño propio de cada mesa (una mesa chica puede ir más pegada a la pared).
--   4) venue_room_set_size / venue_event_set_size: cambia el tamaño de una mesa redonda ya puesta (null = el de siempre según sus sillas). Si al agrandarla toca la estructura o a otra mesa, se rechaza.
--      Permiso: can_manage_venue_layout. En un evento, no si la mesa ya se vendió o alguien la está pagando. El precio, las sillas y las ventas NO cambian.

create or replace function public.venue_mesa_radio_r(p_t text, p_seats integer, p_w numeric, p_h numeric, p_r numeric)
returns numeric language sql immutable set search_path to 'public' as $$
  select coalesce(case when p_t = 'round' then p_r end, public.venue_mesa_radio(p_t, p_seats, p_w, p_h));
$$;
create or replace function public.venue_mesa_margen_r(p_t text, p_seats integer, p_r numeric)
returns numeric language sql immutable set search_path to 'public' as $$
  select case when p_t = 'round' and p_r is not null then p_r else public.venue_mesa_margen(p_t, p_seats) end;
$$;

drop function if exists public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text);
drop function if exists public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text);

create or replace function public.venue_room_add_table(p_room_id uuid, p_map_id text, p_x numeric, p_y numeric, p_seats integer, p_price_cents integer, p_shape text default 'round', p_radius integer default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid; v_layout jsonb; v_mi integer := null; v_i integer; v_w numeric; v_h numeric; v_key text; v_n integer := 1;
  v_zone text; v_area text; v_best numeric := null; v_best_id text; v_d numeric; g jsonb; v_tpl jsonb; v_tbl jsonb; v_geo jsonb; v_maptables jsonb;
  v_stool boolean := (p_shape = 'stool'); v_seats integer; v_rad numeric; v_bloq boolean;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_shape is null or p_shape not in ('round', 'square', 'rect', 'stool') then return jsonb_build_object('ok', false, 'error', 'forma_invalida'); end if;
  if p_radius is not null and (p_radius not in (24, 36, 48) or p_shape <> 'round') then return jsonb_build_object('ok', false, 'error', 'tamano_invalido'); end if;
  v_seats := case when v_stool then 1 else p_seats end;                                               -- el taburete SIEMPRE es de 1 silla
  if v_seats is null or v_seats < 1 or v_seats > 40 then return jsonb_build_object('ok', false, 'error', 'sillas_invalidas'); end if;
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 1000000 then return jsonb_build_object('ok', false, 'error', 'precio_invalido'); end if;
  if p_x is null or p_y is null or p_x < 0 or p_x > 2000 or p_y < 0 or p_y > 2000 then return jsonb_build_object('ok', false, 'error', 'fuera_del_plano'); end if;

  select layout into v_layout from public.venue_rooms where id = p_room_id for update;
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0
     or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' then raise exception 'sin_plano'; end if;
  for v_i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
    if v_layout -> 'maps' -> v_i ->> 'id' = p_map_id then v_mi := v_i; end if;
  end loop;
  if v_mi is null then return jsonb_build_object('ok', false, 'error', 'plano_invalido'); end if;
  if jsonb_array_length(v_layout -> 'tables') >= 300 then return jsonb_build_object('ok', false, 'error', 'demasiadas_mesas'); end if;

  v_w := coalesce((v_layout -> 'maps' -> v_mi -> 'room' ->> 'w')::numeric, 800);
  v_h := coalesce((v_layout -> 'maps' -> v_mi -> 'room' ->> 'h')::numeric, 520);
  if p_x > v_w or p_y > v_h then return jsonb_build_object('ok', false, 'error', 'fuera_del_plano'); end if;
  v_rad := public.venue_mesa_radio_r(p_shape, v_seats, case p_shape when 'square' then 54 when 'rect' then 108 else null end, case p_shape when 'rect' then 54 else null end, p_radius);
  v_bloq := public.venue_plano_bloquea_m(v_layout -> 'maps' -> v_mi, p_x, p_y, public.venue_mesa_margen_r(p_shape, v_seats, p_radius));
  if v_bloq then return jsonb_build_object('ok', false, 'error', 'mesa_sobre_estructura'); end if;

  v_maptables := case when jsonb_typeof(v_layout -> 'maps' -> v_mi -> 'tables') = 'array' then v_layout -> 'maps' -> v_mi -> 'tables' else '[]'::jsonb end;
  for g in select * from jsonb_array_elements(v_maptables) loop
    v_d := (coalesce((g ->> 'x')::numeric, 0) - p_x) ^ 2 + (coalesce((g ->> 'y')::numeric, 0) - p_y) ^ 2;
    -- no se pisan los cuerpos: distancia entre centros >= radio + radio + 8 px (con el tamaño real de cada mueble)
    if sqrt(v_d) < v_rad + public.venue_mesa_radio_r(g ->> 't', nullif(g ->> 'seats', '')::integer, nullif(g ->> 'w', '')::numeric, nullif(g ->> 'h', '')::numeric, nullif(g ->> 'r', '')::numeric) + 8 then return jsonb_build_object('ok', false, 'error', 'mesa_encima'); end if;
    if v_best is null or v_d < v_best then v_best := v_d; v_best_id := g ->> 'id'; end if;
  end loop;
  if v_best_id is not null then                                                                         -- hereda el área de la mesa más cercana (así se vende en la misma área)
    select t into v_tpl from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = v_best_id limit 1;
    v_zone := v_tpl ->> 'zone'; v_area := v_tpl ->> 'area';
  end if;
  if v_stool then v_zone := 'BARRA'; end if;
  loop                                                                                                  -- llave libre: B01… (taburetes) o X01… (mesas)
    v_key := case when v_stool then 'B' else 'X' end || lpad(v_n::text, 2, '0');
    exit when not exists (select 1 from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = v_key);
    v_n := v_n + 1;
    if v_n > 99 then return jsonb_build_object('ok', false, 'error', 'demasiadas_mesas'); end if;
  end loop;

  v_tbl := jsonb_build_object('key', v_key, 'label', v_key, 'seats', v_seats, 'price_cents', p_price_cents)
           || case when v_zone is not null then jsonb_build_object('zone', v_zone) else '{}'::jsonb end
           || case when v_area is not null then jsonb_build_object('area', v_area) else '{}'::jsonb end;
  v_geo := jsonb_build_object('t', p_shape, 'x', round(p_x), 'y', round(p_y), 'id', v_key, 'seats', v_seats)
           || case p_shape when 'square' then jsonb_build_object('w', 54) when 'rect' then jsonb_build_object('w', 108, 'h', 54) else '{}'::jsonb end
           || case when p_radius is not null then jsonb_build_object('r', p_radius) else '{}'::jsonb end;
  v_layout := jsonb_set(v_layout, '{tables}', (v_layout -> 'tables') || jsonb_build_array(v_tbl));
  v_layout := jsonb_set(v_layout, array['maps', v_mi::text, 'tables'], v_maptables || jsonb_build_array(v_geo));
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_build_object('ok', true, 'key', v_key);
end $$;

create or replace function public.venue_event_add_table(p_event_id uuid, p_map_id text, p_x numeric, p_y numeric, p_seats integer, p_price_cents integer, p_shape text default 'round', p_radius integer default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid; v_layout jsonb; v_mi integer := null; v_i integer; v_w numeric; v_h numeric; v_key text; v_n integer := 1;
  v_zone text; v_area text; v_best numeric := null; v_best_id text; v_d numeric; g jsonb; v_tpl jsonb; v_tbl jsonb; v_geo jsonb; v_maptables jsonb;
  v_stool boolean := (p_shape = 'stool'); v_seats integer; v_rad numeric; v_bloq boolean;
begin
  v_venue := public.venue_event_venue_id(p_event_id);
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_shape is null or p_shape not in ('round', 'square', 'rect', 'stool') then return jsonb_build_object('ok', false, 'error', 'forma_invalida'); end if;
  if p_radius is not null and (p_radius not in (24, 36, 48) or p_shape <> 'round') then return jsonb_build_object('ok', false, 'error', 'tamano_invalido'); end if;
  v_seats := case when v_stool then 1 else p_seats end;                                               -- el taburete SIEMPRE es de 1 silla
  if v_seats is null or v_seats < 1 or v_seats > 40 then return jsonb_build_object('ok', false, 'error', 'sillas_invalidas'); end if;
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 1000000 then return jsonb_build_object('ok', false, 'error', 'precio_invalido'); end if;
  if p_x is null or p_y is null or p_x < 0 or p_x > 2000 or p_y < 0 or p_y > 2000 then return jsonb_build_object('ok', false, 'error', 'fuera_del_plano'); end if;

  select layout into v_layout from public.venue_events where id = p_event_id for update;
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0
     or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' then raise exception 'sin_plano'; end if;
  for v_i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
    if v_layout -> 'maps' -> v_i ->> 'id' = p_map_id then v_mi := v_i; end if;
  end loop;
  if v_mi is null then return jsonb_build_object('ok', false, 'error', 'plano_invalido'); end if;
  if jsonb_array_length(v_layout -> 'tables') >= 300 then return jsonb_build_object('ok', false, 'error', 'demasiadas_mesas'); end if;

  v_w := coalesce((v_layout -> 'maps' -> v_mi -> 'room' ->> 'w')::numeric, 800);
  v_h := coalesce((v_layout -> 'maps' -> v_mi -> 'room' ->> 'h')::numeric, 520);
  if p_x > v_w or p_y > v_h then return jsonb_build_object('ok', false, 'error', 'fuera_del_plano'); end if;
  v_rad := public.venue_mesa_radio_r(p_shape, v_seats, case p_shape when 'square' then 54 when 'rect' then 108 else null end, case p_shape when 'rect' then 54 else null end, p_radius);
  v_bloq := public.venue_plano_bloquea_m(v_layout -> 'maps' -> v_mi, p_x, p_y, public.venue_mesa_margen_r(p_shape, v_seats, p_radius));
  if v_bloq then return jsonb_build_object('ok', false, 'error', 'mesa_sobre_estructura'); end if;

  v_maptables := case when jsonb_typeof(v_layout -> 'maps' -> v_mi -> 'tables') = 'array' then v_layout -> 'maps' -> v_mi -> 'tables' else '[]'::jsonb end;
  for g in select * from jsonb_array_elements(v_maptables) loop
    v_d := (coalesce((g ->> 'x')::numeric, 0) - p_x) ^ 2 + (coalesce((g ->> 'y')::numeric, 0) - p_y) ^ 2;
    -- no se pisan los cuerpos: distancia entre centros >= radio + radio + 8 px (con el tamaño real de cada mueble)
    if sqrt(v_d) < v_rad + public.venue_mesa_radio_r(g ->> 't', nullif(g ->> 'seats', '')::integer, nullif(g ->> 'w', '')::numeric, nullif(g ->> 'h', '')::numeric, nullif(g ->> 'r', '')::numeric) + 8 then return jsonb_build_object('ok', false, 'error', 'mesa_encima'); end if;
    if v_best is null or v_d < v_best then v_best := v_d; v_best_id := g ->> 'id'; end if;
  end loop;
  if v_best_id is not null then                                                                         -- hereda el área de la mesa más cercana (así se vende en la misma área)
    select t into v_tpl from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = v_best_id limit 1;
    v_zone := v_tpl ->> 'zone'; v_area := v_tpl ->> 'area';
  end if;
  if v_stool then v_zone := 'BARRA'; end if;
  loop                                                                                                  -- llave libre: B01… (taburetes) o X01… (mesas)
    v_key := case when v_stool then 'B' else 'X' end || lpad(v_n::text, 2, '0');
    exit when not exists (select 1 from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = v_key)
          and not exists (select 1 from public.venue_event_tables k where k.event_id = p_event_id and k.table_key = v_key);
    v_n := v_n + 1;
    if v_n > 99 then return jsonb_build_object('ok', false, 'error', 'demasiadas_mesas'); end if;
  end loop;

  v_tbl := jsonb_build_object('key', v_key, 'label', v_key, 'seats', v_seats, 'price_cents', p_price_cents)
           || case when v_zone is not null then jsonb_build_object('zone', v_zone) else '{}'::jsonb end
           || case when v_area is not null then jsonb_build_object('area', v_area) else '{}'::jsonb end;
  v_geo := jsonb_build_object('t', p_shape, 'x', round(p_x), 'y', round(p_y), 'id', v_key, 'seats', v_seats)
           || case p_shape when 'square' then jsonb_build_object('w', 54) when 'rect' then jsonb_build_object('w', 108, 'h', 54) else '{}'::jsonb end
           || case when p_radius is not null then jsonb_build_object('r', p_radius) else '{}'::jsonb end;
  v_layout := jsonb_set(v_layout, '{tables}', (v_layout -> 'tables') || jsonb_build_array(v_tbl));
  v_layout := jsonb_set(v_layout, array['maps', v_mi::text, 'tables'], v_maptables || jsonb_build_array(v_geo));
  update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  insert into public.venue_event_tables (event_id, table_key, label, seats, zone_name, price_cents) values (p_event_id, v_key, v_key, v_seats, v_zone, p_price_cents);
  return jsonb_build_object('ok', true, 'key', v_key);
end $$;

create or replace function public.venue_room_move_tables(p_room_id uuid, p_moves jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid; v_layout jsonb; v_total integer; mv jsonb; v_key text; v_x numeric; v_y numeric; i integer; j integer; v_hecho boolean; n integer := 0; v_vistas text[] := '{}'; v_bloq boolean;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_moves is null or jsonb_typeof(p_moves) <> 'array' then raise exception 'movimiento_invalido'; end if;
  v_total := jsonb_array_length(p_moves);
  if v_total < 1 or v_total > 40 then raise exception 'movimiento_invalido'; end if;
  select layout into v_layout from public.venue_rooms where id = p_room_id for update;
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0 then raise exception 'sin_plano'; end if;

  for mv in select * from jsonb_array_elements(p_moves) loop
    if jsonb_typeof(mv) is distinct from 'object' or jsonb_typeof(mv -> 'key') is distinct from 'string'
       or jsonb_typeof(mv -> 'x') is distinct from 'number' or jsonb_typeof(mv -> 'y') is distinct from 'number' then raise exception 'movimiento_invalido'; end if;
    v_key := mv ->> 'key'; v_x := (mv ->> 'x')::numeric; v_y := (mv ->> 'y')::numeric;
    if v_x < 0 or v_x > 2000 or v_y < 0 or v_y > 2000 or v_key = any (v_vistas) then raise exception 'movimiento_invalido'; end if;
    v_vistas := v_vistas || v_key;
    v_hecho := false;
    for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
      if jsonb_typeof(v_layout -> 'maps' -> i -> 'tables') = 'array' then
        for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'tables') - 1 loop
          if v_layout -> 'maps' -> i -> 'tables' -> j ->> 'id' = v_key then
            if v_x > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'w')::numeric, 800) or v_y > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'h')::numeric, 520) then raise exception 'movimiento_invalido'; end if;
            v_bloq := public.venue_plano_bloquea_m(v_layout -> 'maps' -> i, v_x, v_y, public.venue_mesa_margen_r(v_layout -> 'maps' -> i -> 'tables' -> j ->> 't', nullif(v_layout -> 'maps' -> i -> 'tables' -> j ->> 'seats', '')::integer, nullif(v_layout -> 'maps' -> i -> 'tables' -> j ->> 'r', '')::numeric));
            if v_bloq then raise exception 'mesa_sobre_estructura'; end if;
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'x'], to_jsonb(round(v_x)));
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'y'], to_jsonb(round(v_y)));
            v_hecho := true;
          end if;
        end loop;
      end if;
    end loop;
    if not v_hecho then raise exception 'mesa_no_existe'; end if;
    n := n + 1;
  end loop;
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return n;
end $$;

create or replace function public.venue_event_move_tables(p_event_id uuid, p_moves jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id);
  v_layout jsonb; v_total integer; mv jsonb; v_key text; v_x numeric; v_y numeric; r public.venue_event_tables%rowtype;
  i integer; j integer; v_hecho boolean; n integer := 0; v_vistas text[] := '{}'; v_bloq boolean;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_moves is null or jsonb_typeof(p_moves) <> 'array' then raise exception 'movimiento_invalido'; end if;
  v_total := jsonb_array_length(p_moves);
  if v_total < 1 or v_total > 40 then raise exception 'movimiento_invalido'; end if;

  select layout into v_layout from public.venue_events where id = p_event_id for update;     -- serializa dos movimientos a la vez
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0 then raise exception 'sin_plano'; end if;

  for mv in select * from jsonb_array_elements(p_moves) loop
    if jsonb_typeof(mv) is distinct from 'object' or jsonb_typeof(mv -> 'key') is distinct from 'string'
       or jsonb_typeof(mv -> 'x') is distinct from 'number' or jsonb_typeof(mv -> 'y') is distinct from 'number' then raise exception 'movimiento_invalido'; end if;
    v_key := mv ->> 'key'; v_x := (mv ->> 'x')::numeric; v_y := (mv ->> 'y')::numeric;
    if v_x < 0 or v_x > 2000 or v_y < 0 or v_y > 2000 or v_key = any (v_vistas) then raise exception 'movimiento_invalido'; end if;
    v_vistas := v_vistas || v_key;

    select * into r from public.venue_event_tables where event_id = p_event_id and table_key = v_key for update;
    if not found then raise exception 'mesa_no_existe'; end if;
    if r.status = 'sold' or (r.status = 'held' and r.held_until >= now()) then raise exception 'mesa_no_se_puede_mover'; end if;

    v_hecho := false;
    for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
      if jsonb_typeof(v_layout -> 'maps' -> i -> 'tables') = 'array' then
        for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'tables') - 1 loop
          if v_layout -> 'maps' -> i -> 'tables' -> j ->> 'id' = v_key then
            -- el limite es el tamano de ESE plano (maps[i].room; 800 x 520 si no trae)
            if v_x > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'w')::numeric, 800) or v_y > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'h')::numeric, 520) then raise exception 'movimiento_invalido'; end if;
            v_bloq := public.venue_plano_bloquea_m(v_layout -> 'maps' -> i, v_x, v_y, public.venue_mesa_margen_r(v_layout -> 'maps' -> i -> 'tables' -> j ->> 't', nullif(v_layout -> 'maps' -> i -> 'tables' -> j ->> 'seats', '')::integer, nullif(v_layout -> 'maps' -> i -> 'tables' -> j ->> 'r', '')::numeric));
            if v_bloq then raise exception 'mesa_sobre_estructura'; end if;
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'x'], to_jsonb(round(v_x)));
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'y'], to_jsonb(round(v_y)));
            v_hecho := true;
          end if;
        end loop;
      end if;
    end loop;
    if not v_hecho then raise exception 'mesa_sin_dibujo'; end if;
    n := n + 1;
  end loop;

  update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  return n;
end $$;

create or replace function public.venue_plano_mover_muebles(p_layout jsonb, p_moves jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare
  v_layout jsonb := p_layout; mv jsonb; v_id text; v_x numeric; v_y numeric; i integer; j integer; v_hecho boolean; v_vistas text[] := '{}';
  it jsonb; g jsonb; v_mi integer; v_ji integer; v_ox numeric; v_oy numeric; v_ra numeric;
begin
  if p_moves is null or jsonb_typeof(p_moves) <> 'array' or jsonb_array_length(p_moves) < 1 or jsonb_array_length(p_moves) > 40 then raise exception 'movimiento_invalido'; end if;
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0 then raise exception 'sin_plano'; end if;

  for mv in select * from jsonb_array_elements(p_moves) loop
    if jsonb_typeof(mv) is distinct from 'object' or jsonb_typeof(mv -> 'id') is distinct from 'string'
       or jsonb_typeof(mv -> 'x') is distinct from 'number' or jsonb_typeof(mv -> 'y') is distinct from 'number' then raise exception 'movimiento_invalido'; end if;
    v_id := mv ->> 'id'; v_x := (mv ->> 'x')::numeric; v_y := (mv ->> 'y')::numeric;
    if v_x < 0 or v_x > 2000 or v_y < 0 or v_y > 2000 or v_id = any (v_vistas) then raise exception 'movimiento_invalido'; end if;
    v_vistas := v_vistas || v_id;
    v_hecho := false;
    for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
      if jsonb_typeof(v_layout -> 'maps' -> i -> 'shapes') = 'array' then
        for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'shapes') - 1 loop
          it := v_layout -> 'maps' -> i -> 'shapes' -> j;
          if it ->> 'id' = v_id then
            if not public.venue_plano_es_mueble(it) then raise exception 'no_es_mueble'; end if;
            if v_x > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'w')::numeric, 800) or v_y > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'h')::numeric, 520) then raise exception 'movimiento_invalido'; end if;
            if public.venue_plano_bloquea_m(v_layout -> 'maps' -> i, v_x, v_y, 30) then raise exception 'mesa_sobre_estructura'; end if;
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'shapes', j::text, 'x'], to_jsonb(round(v_x)));
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'shapes', j::text, 'y'], to_jsonb(round(v_y)));
            v_hecho := true;
          end if;
        end loop;
      end if;
    end loop;
    if not v_hecho then raise exception 'mueble_no_existe'; end if;
  end loop;

  -- sin pisarse: ya con todo en su lugar nuevo, cada mueble movido queda lejos de los demás muebles y de las mesas de su plano
  for mv in select * from jsonb_array_elements(p_moves) loop
    v_id := mv ->> 'id'; v_mi := null; v_ji := null;
    for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
      if jsonb_typeof(v_layout -> 'maps' -> i -> 'shapes') = 'array' then
        for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'shapes') - 1 loop
          if v_layout -> 'maps' -> i -> 'shapes' -> j ->> 'id' = v_id then v_mi := i; v_ji := j; end if;
        end loop;
      end if;
    end loop;
    v_ox := (v_layout -> 'maps' -> v_mi -> 'shapes' -> v_ji ->> 'x')::numeric; v_oy := (v_layout -> 'maps' -> v_mi -> 'shapes' -> v_ji ->> 'y')::numeric;
    v_ra := greatest(coalesce((v_layout -> 'maps' -> v_mi -> 'shapes' -> v_ji ->> 'w')::numeric, 54), coalesce((v_layout -> 'maps' -> v_mi -> 'shapes' -> v_ji ->> 'h')::numeric, 54)) / 2;
    for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> v_mi -> 'shapes') - 1 loop
      it := v_layout -> 'maps' -> v_mi -> 'shapes' -> j;
      if j <> v_ji and public.venue_plano_es_mueble(it)
         and sqrt(((it ->> 'x')::numeric - v_ox) ^ 2 + ((it ->> 'y')::numeric - v_oy) ^ 2)
             < v_ra + greatest(coalesce((it ->> 'w')::numeric, 54), coalesce((it ->> 'h')::numeric, 54)) / 2 + 4 then raise exception 'mesa_encima'; end if;
    end loop;
    if jsonb_typeof(v_layout -> 'maps' -> v_mi -> 'tables') = 'array' then
      for g in select * from jsonb_array_elements(v_layout -> 'maps' -> v_mi -> 'tables') loop
        if sqrt((coalesce((g ->> 'x')::numeric, 0) - v_ox) ^ 2 + (coalesce((g ->> 'y')::numeric, 0) - v_oy) ^ 2)
           < v_ra + public.venue_mesa_radio_r(g ->> 't', nullif(g ->> 'seats', '')::integer, nullif(g ->> 'w', '')::numeric, nullif(g ->> 'h', '')::numeric, nullif(g ->> 'r', '')::numeric) + 8 then raise exception 'mesa_encima'; end if;
      end loop;
    end if;
  end loop;
  return v_layout;
end $$;

create or replace function public.venue_plano_poner_tamano(p_layout jsonb, p_key text, p_radius integer)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v_layout jsonb := p_layout; i integer; j integer; k integer; v_hecho boolean := false; g jsonb; v_x numeric; v_y numeric; v_ra numeric; v_t jsonb;
begin
  if p_radius is not null and p_radius not in (24, 36, 48) then raise exception 'tamano_invalido'; end if;
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0 then raise exception 'sin_plano'; end if;
  for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
    if jsonb_typeof(v_layout -> 'maps' -> i -> 'tables') = 'array' then
      for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'tables') - 1 loop
        v_t := v_layout -> 'maps' -> i -> 'tables' -> j;
        if v_t ->> 'id' = p_key then
          if v_t ->> 't' is distinct from 'round' then raise exception 'solo_redondas'; end if;
          v_x := (v_t ->> 'x')::numeric; v_y := (v_t ->> 'y')::numeric;
          v_ra := public.venue_mesa_radio_r('round', nullif(v_t ->> 'seats', '')::integer, null, null, p_radius);
          if public.venue_plano_bloquea_m(v_layout -> 'maps' -> i, v_x, v_y, v_ra) then raise exception 'mesa_sobre_estructura'; end if;
          for k in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'tables') - 1 loop
            g := v_layout -> 'maps' -> i -> 'tables' -> k;
            if k <> j and sqrt((coalesce((g ->> 'x')::numeric, 0) - v_x) ^ 2 + (coalesce((g ->> 'y')::numeric, 0) - v_y) ^ 2)
                          < v_ra + public.venue_mesa_radio_r(g ->> 't', nullif(g ->> 'seats', '')::integer, nullif(g ->> 'w', '')::numeric, nullif(g ->> 'h', '')::numeric, nullif(g ->> 'r', '')::numeric) + 8 then raise exception 'mesa_encima'; end if;
          end loop;
          v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text], case when p_radius is null then (v_t - 'r') else (v_t || jsonb_build_object('r', p_radius)) end);
          v_hecho := true;
        end if;
      end loop;
    end if;
  end loop;
  if not v_hecho then raise exception 'mesa_sin_dibujo'; end if;
  return v_layout;
end $$;

create or replace function public.venue_room_set_size(p_room_id uuid, p_key text, p_radius integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid; v_layout jsonb;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_rooms where id = p_room_id for update;
  v_layout := public.venue_plano_poner_tamano(v_layout, p_key, p_radius);
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_build_object('ok', true, 'key', p_key, 'radius', p_radius);
end $$;

create or replace function public.venue_event_set_size(p_event_id uuid, p_key text, p_radius integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid := public.venue_event_venue_id(p_event_id); v_layout jsonb; r public.venue_event_tables%rowtype;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_events where id = p_event_id for update;
  select * into r from public.venue_event_tables where event_id = p_event_id and table_key = p_key for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  if r.status = 'sold' or (r.status = 'held' and r.held_until >= now()) then return jsonb_build_object('ok', false, 'error', 'mesa_no_se_puede_editar'); end if;
  v_layout := public.venue_plano_poner_tamano(v_layout, p_key, p_radius);
  update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  return jsonb_build_object('ok', true, 'key', p_key, 'radius', p_radius);
end $$;

revoke all on function public.venue_mesa_radio_r(text, integer, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.venue_mesa_margen_r(text, integer, numeric) from public, anon, authenticated;
revoke all on function public.venue_plano_poner_tamano(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text, integer) from public, anon, authenticated;
grant execute on function public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text, integer) to authenticated;
revoke all on function public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text, integer) from public, anon, authenticated;
grant execute on function public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text, integer) to authenticated;
revoke all on function public.venue_room_move_tables(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_room_move_tables(uuid, jsonb) to authenticated;
revoke all on function public.venue_event_move_tables(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_event_move_tables(uuid, jsonb) to authenticated;
revoke all on function public.venue_plano_mover_muebles(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.venue_room_set_size(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.venue_room_set_size(uuid, text, integer) to authenticated;
revoke all on function public.venue_event_set_size(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.venue_event_set_size(uuid, text, integer) to authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: 1 sola firma de add_table por sala y por evento (2 filas en total para las dos), anon_alguna=false,
--    y mesa_chica_4_sillas=24 (antes de este SQL daba 36) ──
select (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('venue_room_add_table', 'venue_event_add_table')) as firmas_add_table,
       (select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('venue_room_add_table', 'venue_event_add_table', 'venue_room_move_tables', 'venue_event_move_tables', 'venue_room_set_size', 'venue_event_set_size', 'venue_mesa_radio_r', 'venue_mesa_margen_r', 'venue_plano_poner_tamano', 'venue_plano_mover_muebles')) as anon_alguna,
       public.venue_mesa_radio_r('round', 4, null, null, 24) as mesa_chica_4_sillas,
       public.venue_mesa_radio_r('round', 4, null, null, null) as mesa_mediana_4_sillas;
