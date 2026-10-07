-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · SILLAS Y TABURETES DE BARRA (asientos individuales): una «mesa» de 1 silla, dibujada como un círculo chico, que se puede poner a lo largo de la barra.
-- Requiere 20261007_venue_taller_de_la_sala.sql, 20261007_venue_evento_mesas_agregar_editar_quitar.sql y 20261007_venue_autorizaciones_del_owner.sql ya aplicados.
--
-- Cómo funciona (sin tablas ni columnas nuevas; la arquitectura de la sala no se toca):
--   · Un taburete ES una mesa de 1 silla: mismo inventario (venue_event_tables), misma venta manual, mismo pase QR individual (1 silla = 1 pase).
--     Se reconoce por su dibujo: maps[].tables[].t = 'stool'. Llave B01, B02, … (las mesas siguen siendo X01…). Zona «BARRA». Capacidad inmutable: 1.
--   · Tamaños reales y cercanía a la barra: cada mueble tiene su radio (taburete 13 · cóctel 24 · estándar 36 · familiar/VIP 48 · cuadrada 27 · rectangular 54 px). El margen a la estructura es su radio (redondas), 22 px (cuadrada/rectangular, como siempre) y 16 px para el taburete: puede ir pegado al mostrador,
--     pero NUNCA encima de la barra, del escenario, de un baño, de una pared ni de una puerta. venue_plano_bloquea (la de siempre) NO se modifica:
--     se agrega venue_plano_bloquea_m con el margen como parámetro (es la misma función con «22» convertido en parámetro). Dos muebles no se pisan: distancia entre centros >= radio + radio + 8 px.
--   · Se reemplazan (misma firma, mismo permiso): venue_room_add_table, venue_event_add_table (aceptan la forma 'stool'),
--     venue_room_move_tables, venue_event_move_tables (usan el margen del taburete para los taburetes) y venue_room_edit_table, venue_event_edit_table
--     (un taburete no cambia de capacidad: 'taburete_una_silla').
--   · El precio sigue siendo price_cents: 0 = cortesía (la venta manual ya tiene el método «cortesía»).

-- 1) Misma función de estructura, con el margen como parámetro (la original queda intacta).
create or replace function public.venue_plano_bloquea_m(p_map jsonb, p_x numeric, p_y numeric, p_m numeric)
returns boolean language plpgsql immutable set search_path to 'public' as $$
declare v_n integer; i integer; j integer; xi numeric; yi numeric; xj numeric; yj numeric; v_in boolean; v_near boolean; r jsonb; f jsonb; it jsonb; k text; a numeric; dx numeric; dy numeric; lx numeric; ly numeric; ea numeric; eb numeric; l2 numeric; tt numeric; cx numeric; cy numeric; blk boolean; elip boolean;
begin
  r := p_map -> 'focal' -> 'rect';
  if jsonb_typeof(r) = 'array' and jsonb_array_length(r) = 4
     and p_x between (r ->> 0)::numeric - p_m and (r ->> 0)::numeric + (r ->> 2)::numeric + p_m
     and p_y between (r ->> 1)::numeric - p_m and (r ->> 1)::numeric + (r ->> 3)::numeric + p_m then return true; end if;
  if jsonb_typeof(p_map -> 'fixed') = 'array' then
    for f in select * from jsonb_array_elements(p_map -> 'fixed') loop
      r := f -> 'r';
      if (f ->> 'k') in ('bano', 'barra') and jsonb_typeof(r) = 'array' and jsonb_array_length(r) = 4
         and p_x between (r ->> 0)::numeric - p_m and (r ->> 0)::numeric + (r ->> 2)::numeric + p_m
         and p_y between (r ->> 1)::numeric - p_m and (r ->> 1)::numeric + (r ->> 3)::numeric + p_m then return true; end if;
    end loop;
  end if;
  if jsonb_typeof(p_map -> 'shapes') = 'array' then
    for it in select * from jsonb_array_elements(p_map -> 'shapes') loop
      continue when not public.venue_plano_figura_valida(it);
      k := it ->> 'k';
      blk := case when it ->> 'bloquea' = 'true' then true when it ->> 'bloquea' = 'false' then false
                  else (k in ('stage', 'wall') or (k = 'zone' and (it ->> 'sub') in ('barra', 'bano'))) end;
      continue when not blk or k in ('text', 'chair');
      if k = 'poly' then                                -- dentro del contorno (regla par-impar, sirve con una L) o a menos de p_m px de su borde
        v_n := jsonb_array_length(it -> 'pts'); v_in := false; v_near := false;
        for i in 0 .. v_n - 1 loop
          j := case when i = 0 then v_n - 1 else i - 1 end;
          xi := (it -> 'pts' -> i ->> 0)::numeric; yi := (it -> 'pts' -> i ->> 1)::numeric; xj := (it -> 'pts' -> j ->> 0)::numeric; yj := (it -> 'pts' -> j ->> 1)::numeric;
          if (yi > p_y) <> (yj > p_y) then
            if p_x < (xj - xi) * (p_y - yi) / (yj - yi) + xi then v_in := not v_in; end if;
          end if;
          dx := xi - xj; dy := yi - yj; l2 := dx * dx + dy * dy;
          tt := case when l2 = 0 then 0 else greatest(0, least(1, ((p_x - xj) * dx + (p_y - yj) * dy) / l2)) end;
          cx := xj + tt * dx; cy := yj + tt * dy;
          if sqrt((p_x - cx) * (p_x - cx) + (p_y - cy) * (p_y - cy)) <= p_m then v_near := true; end if;
        end loop;
        if v_in or v_near then return true; end if;
        continue;
      end if;
      if k = 'wall' then
        dx := (it ->> 'x2')::numeric - (it ->> 'x1')::numeric; dy := (it ->> 'y2')::numeric - (it ->> 'y1')::numeric; l2 := dx * dx + dy * dy;
        tt := case when l2 = 0 then 0 else greatest(0, least(1, ((p_x - (it ->> 'x1')::numeric) * dx + (p_y - (it ->> 'y1')::numeric) * dy) / l2)) end;
        cx := (it ->> 'x1')::numeric + tt * dx; cy := (it ->> 'y1')::numeric + tt * dy;
        if sqrt((p_x - cx) * (p_x - cx) + (p_y - cy) * (p_y - cy)) <= p_m + coalesce((it ->> 'th')::numeric, 6) / 2 then return true; end if;
      else
        a := coalesce((it ->> 'rot')::numeric, 0) * pi() / 180; dx := p_x - (it ->> 'x')::numeric; dy := p_y - (it ->> 'y')::numeric;
        lx := dx * cos(a) + dy * sin(a); ly := -dx * sin(a) + dy * cos(a);
        if k = 'door' then
          if abs(lx) <= (it ->> 'w')::numeric / 2 + p_m and abs(ly) <= 3.5 + p_m then return true; end if;
        else
          elip := (k = 'shape' and it ->> 'sub' = 'ellipse') or (k = 'stage' and it ->> 'shape' = 'oval');
          if elip then
            ea := (it ->> 'w')::numeric / 2 + p_m; eb := (it ->> 'h')::numeric / 2 + p_m;
            if (lx * lx) / (ea * ea) + (ly * ly) / (eb * eb) <= 1 then return true; end if;
          elsif abs(lx) <= (it ->> 'w')::numeric / 2 + p_m and abs(ly) <= (it ->> 'h')::numeric / 2 + p_m then return true; end if;
        end if;
      end if;
    end loop;
  end if;
  return false;
end $$;

-- Tamaño REAL de cada mueble (radio del cuerpo, en px del plano): taburete 13 · mesa cóctel (1-2 sillas) 24 · mesa estándar (3-6) 36 · mesa familiar/VIP (7+) 48 · cuadrada 27 · rectangular 54.
create or replace function public.venue_mesa_radio(p_t text, p_seats integer, p_w numeric default null, p_h numeric default null)
returns numeric language sql immutable set search_path to 'public' as $$
  select case p_t
    when 'stool'  then 13::numeric
    when 'square' then coalesce(p_w, 54) / 2
    when 'rect'   then greatest(coalesce(p_w, 108), coalesce(p_h, 54)) / 2
    else case when coalesce(p_seats, 4) <= 2 then 24::numeric when coalesce(p_seats, 4) <= 6 then 36::numeric else 48::numeric end end;
$$;
-- Margen de seguridad a la estructura (pared, escenario, baño, barra, puerta): taburete 16 (puede ir pegado al mostrador) · mesa redonda = su radio · cuadrada/rectangular 22 (como siempre).
create or replace function public.venue_mesa_margen(p_t text, p_seats integer)
returns numeric language sql immutable set search_path to 'public' as $$
  select case p_t when 'stool' then 16::numeric when 'square' then 22::numeric when 'rect' then 22::numeric else public.venue_mesa_radio(p_t, p_seats) end;
$$;

create or replace function public.venue_plano_es_taburete(p_layout jsonb, p_key text)
returns boolean language sql stable set search_path to 'public' as $$
  select coalesce((
    select true
      from jsonb_array_elements(case when jsonb_typeof(p_layout -> 'maps') = 'array' then p_layout -> 'maps' else '[]'::jsonb end) m,
           jsonb_array_elements(case when jsonb_typeof(m -> 'tables') = 'array' then m -> 'tables' else '[]'::jsonb end) g
     where g ->> 'id' = p_key and g ->> 't' = 'stool' limit 1), false);
$$;

create or replace function public.venue_room_add_table(p_room_id uuid, p_map_id text, p_x numeric, p_y numeric, p_seats integer, p_price_cents integer, p_shape text default 'round')
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
  v_rad := public.venue_mesa_radio(p_shape, v_seats, case p_shape when 'square' then 54 when 'rect' then 108 else null end, case p_shape when 'rect' then 54 else null end);
  v_bloq := public.venue_plano_bloquea_m(v_layout -> 'maps' -> v_mi, p_x, p_y, public.venue_mesa_margen(p_shape, v_seats));
  if v_bloq then return jsonb_build_object('ok', false, 'error', 'mesa_sobre_estructura'); end if;

  v_maptables := case when jsonb_typeof(v_layout -> 'maps' -> v_mi -> 'tables') = 'array' then v_layout -> 'maps' -> v_mi -> 'tables' else '[]'::jsonb end;
  for g in select * from jsonb_array_elements(v_maptables) loop
    v_d := (coalesce((g ->> 'x')::numeric, 0) - p_x) ^ 2 + (coalesce((g ->> 'y')::numeric, 0) - p_y) ^ 2;
    -- no se pisan los cuerpos: distancia entre centros >= radio + radio + 8 px (con el tamaño real de cada mueble)
    if sqrt(v_d) < v_rad + public.venue_mesa_radio(g ->> 't', nullif(g ->> 'seats', '')::integer, nullif(g ->> 'w', '')::numeric, nullif(g ->> 'h', '')::numeric) + 8 then return jsonb_build_object('ok', false, 'error', 'mesa_encima'); end if;
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
           || case p_shape when 'square' then jsonb_build_object('w', 54) when 'rect' then jsonb_build_object('w', 108, 'h', 54) else '{}'::jsonb end;
  v_layout := jsonb_set(v_layout, '{tables}', (v_layout -> 'tables') || jsonb_build_array(v_tbl));
  v_layout := jsonb_set(v_layout, array['maps', v_mi::text, 'tables'], v_maptables || jsonb_build_array(v_geo));
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_build_object('ok', true, 'key', v_key);
end $$;

create or replace function public.venue_event_add_table(p_event_id uuid, p_map_id text, p_x numeric, p_y numeric, p_seats integer, p_price_cents integer, p_shape text default 'round')
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
  v_rad := public.venue_mesa_radio(p_shape, v_seats, case p_shape when 'square' then 54 when 'rect' then 108 else null end, case p_shape when 'rect' then 54 else null end);
  v_bloq := public.venue_plano_bloquea_m(v_layout -> 'maps' -> v_mi, p_x, p_y, public.venue_mesa_margen(p_shape, v_seats));
  if v_bloq then return jsonb_build_object('ok', false, 'error', 'mesa_sobre_estructura'); end if;

  v_maptables := case when jsonb_typeof(v_layout -> 'maps' -> v_mi -> 'tables') = 'array' then v_layout -> 'maps' -> v_mi -> 'tables' else '[]'::jsonb end;
  for g in select * from jsonb_array_elements(v_maptables) loop
    v_d := (coalesce((g ->> 'x')::numeric, 0) - p_x) ^ 2 + (coalesce((g ->> 'y')::numeric, 0) - p_y) ^ 2;
    -- no se pisan los cuerpos: distancia entre centros >= radio + radio + 8 px (con el tamaño real de cada mueble)
    if sqrt(v_d) < v_rad + public.venue_mesa_radio(g ->> 't', nullif(g ->> 'seats', '')::integer, nullif(g ->> 'w', '')::numeric, nullif(g ->> 'h', '')::numeric) + 8 then return jsonb_build_object('ok', false, 'error', 'mesa_encima'); end if;
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
           || case p_shape when 'square' then jsonb_build_object('w', 54) when 'rect' then jsonb_build_object('w', 108, 'h', 54) else '{}'::jsonb end;
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
            v_bloq := public.venue_plano_bloquea_m(v_layout -> 'maps' -> i, v_x, v_y, public.venue_mesa_margen(v_layout -> 'maps' -> i -> 'tables' -> j ->> 't', nullif(v_layout -> 'maps' -> i -> 'tables' -> j ->> 'seats', '')::integer));
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

-- Mover mesas del evento (misma función de siempre; solo cambia el margen para los taburetes).
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
            v_bloq := public.venue_plano_bloquea_m(v_layout -> 'maps' -> i, v_x, v_y, public.venue_mesa_margen(v_layout -> 'maps' -> i -> 'tables' -> j ->> 't', nullif(v_layout -> 'maps' -> i -> 'tables' -> j ->> 'seats', '')::integer));
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

create or replace function public.venue_room_edit_table(p_room_id uuid, p_key text, p_seats integer default null, p_price_cents integer default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid; v_layout jsonb; v_i integer; v_seats integer; v_price integer;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_seats is null and p_price_cents is null then return jsonb_build_object('ok', false, 'error', 'sin_cambios'); end if;
  if p_seats is not null and (p_seats < 1 or p_seats > 40) then return jsonb_build_object('ok', false, 'error', 'sillas_invalidas'); end if;
  if p_price_cents is not null and (p_price_cents < 0 or p_price_cents > 1000000) then return jsonb_build_object('ok', false, 'error', 'precio_invalido'); end if;
  select layout into v_layout from public.venue_rooms where id = p_room_id for update;
  if v_layout is null or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' then raise exception 'sin_plano'; end if;
  if p_seats is not null and p_seats <> 1 and public.venue_plano_es_taburete(v_layout, p_key) then return jsonb_build_object('ok', false, 'error', 'taburete_una_silla'); end if;
  select coalesce(p_seats, (t ->> 'seats')::integer), coalesce(p_price_cents, (t ->> 'price_cents')::integer) into v_seats, v_price
    from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = p_key limit 1;
  if not found then raise exception 'mesa_no_existe'; end if;
  v_layout := jsonb_set(v_layout, '{tables}', coalesce((
    select jsonb_agg(case when x.t ->> 'key' = p_key then x.t || jsonb_build_object('seats', v_seats, 'price_cents', v_price) else x.t end order by x.ord)
      from jsonb_array_elements(v_layout -> 'tables') with ordinality as x(t, ord)), '[]'::jsonb));
  if jsonb_typeof(v_layout -> 'maps') = 'array' then
    for v_i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
      if jsonb_typeof(v_layout -> 'maps' -> v_i -> 'tables') = 'array' then
        v_layout := jsonb_set(v_layout, array['maps', v_i::text, 'tables'], coalesce((
          select jsonb_agg(case when x.t ->> 'id' = p_key then x.t || jsonb_build_object('seats', v_seats) else x.t end order by x.ord)
            from jsonb_array_elements(v_layout -> 'maps' -> v_i -> 'tables') with ordinality as x(t, ord)), '[]'::jsonb));
      end if;
    end loop;
  end if;
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_build_object('ok', true, 'key', p_key, 'seats', v_seats, 'price_cents', v_price);
end $$;

create or replace function public.venue_event_edit_table(p_event_id uuid, p_key text, p_seats integer default null, p_price_cents integer default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id);
  v_layout jsonb; r public.venue_event_tables%rowtype; v_i integer; v_new_seats integer; v_new_price integer;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_seats is null and p_price_cents is null then return jsonb_build_object('ok', false, 'error', 'sin_cambios'); end if;
  if p_seats is not null and (p_seats < 1 or p_seats > 40) then return jsonb_build_object('ok', false, 'error', 'sillas_invalidas'); end if;
  if p_price_cents is not null and (p_price_cents < 0 or p_price_cents > 1000000) then return jsonb_build_object('ok', false, 'error', 'precio_invalido'); end if;

  select layout into v_layout from public.venue_events where id = p_event_id for update;
  select * into r from public.venue_event_tables where event_id = p_event_id and table_key = p_key for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  if r.status = 'sold' or (r.status = 'held' and r.held_until >= now()) then return jsonb_build_object('ok', false, 'error', 'mesa_no_se_puede_editar'); end if;

  if p_seats is not null and p_seats <> 1 and public.venue_plano_es_taburete(v_layout, p_key) then return jsonb_build_object('ok', false, 'error', 'taburete_una_silla'); end if;
  v_new_seats := coalesce(p_seats, r.seats); v_new_price := coalesce(p_price_cents, r.price_cents);
  update public.venue_event_tables set seats = v_new_seats, price_cents = v_new_price where id = r.id;

  if v_layout is not null and jsonb_typeof(v_layout -> 'tables') = 'array' then
    v_layout := jsonb_set(v_layout, '{tables}', coalesce((
      select jsonb_agg(case when x.t ->> 'key' = p_key then x.t || jsonb_build_object('seats', v_new_seats, 'price_cents', v_new_price) else x.t end order by x.ord)
        from jsonb_array_elements(v_layout -> 'tables') with ordinality as x(t, ord)), '[]'::jsonb));
    if jsonb_typeof(v_layout -> 'maps') = 'array' then
      for v_i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
        if jsonb_typeof(v_layout -> 'maps' -> v_i -> 'tables') = 'array' then
          v_layout := jsonb_set(v_layout, array['maps', v_i::text, 'tables'], coalesce((
            select jsonb_agg(case when x.t ->> 'id' = p_key then x.t || jsonb_build_object('seats', v_new_seats) else x.t end order by x.ord)
              from jsonb_array_elements(v_layout -> 'maps' -> v_i -> 'tables') with ordinality as x(t, ord)), '[]'::jsonb));
        end if;
      end loop;
    end if;
    update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  end if;
  return jsonb_build_object('ok', true, 'key', p_key, 'seats', v_new_seats, 'price_cents', v_new_price);
end $$;

revoke all on function public.venue_plano_bloquea_m(jsonb, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.venue_plano_es_taburete(jsonb, text) from public, anon, authenticated;
revoke all on function public.venue_mesa_radio(text, integer, numeric, numeric) from public, anon, authenticated;
revoke all on function public.venue_mesa_margen(text, integer) from public, anon, authenticated;
revoke all on function public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text) from public, anon, authenticated;
grant execute on function public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text) to authenticated;
revoke all on function public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text) from public, anon, authenticated;
grant execute on function public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text) to authenticated;
revoke all on function public.venue_room_move_tables(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_room_move_tables(uuid, jsonb) to authenticated;
revoke all on function public.venue_event_move_tables(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_event_move_tables(uuid, jsonb) to authenticated;
revoke all on function public.venue_room_edit_table(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.venue_room_edit_table(uuid, text, integer, integer) to authenticated;
revoke all on function public.venue_event_edit_table(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.venue_event_edit_table(uuid, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: 10 filas con anon_puede=false; las 6 funciones del taller (add/move/edit de sala y de evento) con authenticated_puede=true y las 4 internas con false;
--    y la prueba de la barra: mesa_a_21px=true (una mesa NO cabe), taburete_a_21px=false (un taburete SÍ), taburete_dentro=true (encima de la barra NO),
--    radios=13,24,36,48 (taburete, cóctel, estándar, familiar) ──
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('venue_plano_bloquea_m', 'venue_plano_es_taburete', 'venue_mesa_radio', 'venue_mesa_margen', 'venue_room_add_table', 'venue_event_add_table', 'venue_room_move_tables', 'venue_event_move_tables', 'venue_room_edit_table', 'venue_event_edit_table')
 order by p.proname;

select public.venue_plano_bloquea_m('{"fixed":[{"k":"barra","r":[100,100,200,40]}]}'::jsonb, 150, 79, public.venue_mesa_margen('square', 4))   as mesa_a_21px,
       public.venue_plano_bloquea_m('{"fixed":[{"k":"barra","r":[100,100,200,40]}]}'::jsonb, 150, 79, public.venue_mesa_margen('stool', 1))    as taburete_a_21px,
       public.venue_plano_bloquea_m('{"fixed":[{"k":"barra","r":[100,100,200,40]}]}'::jsonb, 150, 120, public.venue_mesa_margen('stool', 1))   as taburete_dentro,
       concat_ws(',', public.venue_mesa_radio('stool', 1), public.venue_mesa_radio('round', 2), public.venue_mesa_radio('round', 6), public.venue_mesa_radio('round', 10)) as radios;
