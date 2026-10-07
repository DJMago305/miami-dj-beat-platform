-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · LAS MESAS CHOCAN POR SU TAMAÑO REAL, NO POR UN CÍRCULO (reporte del PO 2026-10-07: «no deja agregar» una mesa larga en la hilera del medio).
-- Problema: la regla de «mesa encima» trataba a TODA mesa como un círculo (la rectangular de 108 x 54 contaba como un círculo de radio 54), así que exigía 116 px entre dos mesas largas
-- aunque en el sentido corto solo hacen falta 62: entre tus X10/X12/X11 (y = 232) y la hilera nueva (y = 120) hay 112 y el servidor la rechazaba por 4 px.
-- Arreglo: nueva función venue_mesa_choca(mesa_a, mesa_b, separación) que compara las FORMAS reales: redonda y taburete = círculo; cuadrada y rectangular = rectángulo con su giro (rot). Siempre se deja
-- la separación de 8 px de siempre entre un mueble y otro. Es más exacta que la vieja: de frente y de lado (lo que se usa en filas y hileras) nunca pide más que antes y para las largas pide mucho menos;
-- solo en las esquinas (mesa cuadrada o larga en diagonal) pide un poco más, porque el círculo viejo cortaba las esquinas y dejaba que se montaran.
-- Se actualizan las 4 funciones que la usaban, sin cambiar firmas ni permisos: venue_room_add_table, venue_event_add_table, venue_plano_mover_muebles (mesas de la terraza T##) y venue_plano_poner_tamano.
-- NO cambia mesas, precios, ventas ni el dibujo. Tampoco cambia la regla contra la estructura (escenario, baños, barra, paredes), que sigue igual.

create or replace function public.venue_mesa_choca(p_a jsonb, p_b jsonb, p_gap numeric default 8)
returns boolean language plpgsql immutable set search_path to 'public' as $$
declare
  ta text := p_a ->> 't'; tb text := p_b ->> 't';
  ax numeric := coalesce((p_a ->> 'x')::numeric, 0); ay numeric := coalesce((p_a ->> 'y')::numeric, 0);
  bx numeric := coalesce((p_b ->> 'x')::numeric, 0); bye numeric := coalesce((p_b ->> 'y')::numeric, 0);
  a_circ boolean := ta in ('round', 'stool'); b_circ boolean := tb in ('round', 'stool');
  ra numeric; rb numeric; ahw numeric; ahh numeric; bhw numeric; bhh numeric; aang numeric; bang numeric;
  cx numeric; cy numeric; bw numeric; bh numeric; ang numeric; lx numeric; ly numeric; ex numeric; ey numeric;
  dx numeric; dy numeric; ux numeric; uy numeric; ra_p numeric; rb_p numeric; i integer;
begin
  if a_circ then ra := public.venue_mesa_radio_r(ta, nullif(p_a ->> 'seats', '')::integer, null, null, nullif(p_a ->> 'r', '')::numeric); end if;
  if b_circ then rb := public.venue_mesa_radio_r(tb, nullif(p_b ->> 'seats', '')::integer, null, null, nullif(p_b ->> 'r', '')::numeric); end if;
  if not a_circ then ahw := coalesce(nullif(p_a ->> 'w', '')::numeric, case when ta = 'square' then 54 else 108 end) / 2; ahh := case when ta = 'square' then ahw else coalesce(nullif(p_a ->> 'h', '')::numeric, 54) / 2 end; aang := coalesce(nullif(p_a ->> 'rot', '')::numeric, 0) * pi() / 180; end if;
  if not b_circ then bhw := coalesce(nullif(p_b ->> 'w', '')::numeric, case when tb = 'square' then 54 else 108 end) / 2; bhh := case when tb = 'square' then bhw else coalesce(nullif(p_b ->> 'h', '')::numeric, 54) / 2 end; bang := coalesce(nullif(p_b ->> 'rot', '')::numeric, 0) * pi() / 180; end if;

  if a_circ and b_circ then
    return sqrt((ax - bx) ^ 2 + (ay - bye) ^ 2) < ra + rb + p_gap;
  end if;
  if a_circ or b_circ then
    -- círculo contra rectángulo: se lleva el centro del círculo al marco del rectángulo y se mide la distancia al borde
    if a_circ then cx := ax; cy := ay; bw := bhw; bh := bhh; ang := bang; dx := ax - bx; dy := ay - bye; ra_p := ra;
    else cx := bx; cy := bye; bw := ahw; bh := ahh; ang := aang; dx := bx - ax; dy := bye - ay; ra_p := rb; end if;
    lx := dx * cos(ang) + dy * sin(ang); ly := -dx * sin(ang) + dy * cos(ang);
    ex := greatest(abs(lx) - bw, 0); ey := greatest(abs(ly) - bh, 0);
    return sqrt(ex * ex + ey * ey) < ra_p + p_gap - 0.000001;                                -- (la milésima evita falsos choques por redondeo en el giro)
  end if;
  -- rectángulo contra rectángulo (con giro): ejes separadores; cada uno se engorda la mitad de la separación
  ahw := ahw + p_gap / 2; ahh := ahh + p_gap / 2; bhw := bhw + p_gap / 2; bhh := bhh + p_gap / 2;
  dx := bx - ax; dy := bye - ay;
  for i in 0 .. 3 loop
    case i
      when 0 then ux := cos(aang); uy := sin(aang);
      when 1 then ux := -sin(aang); uy := cos(aang);
      when 2 then ux := cos(bang); uy := sin(bang);
      else ux := -sin(bang); uy := cos(bang);
    end case;
    ra_p := ahw * abs(ux * cos(aang) + uy * sin(aang)) + ahh * abs(-ux * sin(aang) + uy * cos(aang));
    rb_p := bhw * abs(ux * cos(bang) + uy * sin(bang)) + bhh * abs(-ux * sin(bang) + uy * cos(bang));
    if abs(dx * ux + dy * uy) >= ra_p + rb_p - 0.000001 then return false; end if;
  end loop;
  return true;
end $$;

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
    if public.venue_mesa_choca(jsonb_build_object('t', p_shape, 'x', p_x, 'y', p_y, 'seats', v_seats, 'w', case p_shape when 'square' then 54 when 'rect' then 108 end, 'h', case p_shape when 'rect' then 54 end, 'r', p_radius), g, 8) then return jsonb_build_object('ok', false, 'error', 'mesa_encima'); end if;
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
    if public.venue_mesa_choca(jsonb_build_object('t', p_shape, 'x', p_x, 'y', p_y, 'seats', v_seats, 'w', case p_shape when 'square' then 54 when 'rect' then 108 end, 'h', case p_shape when 'rect' then 54 end, 'r', p_radius), g, 8) then return jsonb_build_object('ok', false, 'error', 'mesa_encima'); end if;
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

create or replace function public.venue_plano_mover_muebles(p_layout jsonb, p_moves jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare
  v_layout jsonb := p_layout; mv jsonb; v_id text; v_x numeric; v_y numeric; i integer; j integer; v_hecho boolean; v_vistas text[] := '{}';
  it jsonb; g jsonb; v_mi integer; v_ji integer; v_ox numeric; v_oy numeric; v_ra numeric; v_mu jsonb;
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
    v_mu := jsonb_build_object('t', case when v_layout -> 'maps' -> v_mi -> 'shapes' -> v_ji ->> 'sub' = 'ellipse' then 'round' else 'rect' end, 'x', v_ox, 'y', v_oy,
      'w', coalesce((v_layout -> 'maps' -> v_mi -> 'shapes' -> v_ji ->> 'w')::numeric, 54), 'h', coalesce((v_layout -> 'maps' -> v_mi -> 'shapes' -> v_ji ->> 'h')::numeric, 54), 'r', v_ra,
      'rot', coalesce((v_layout -> 'maps' -> v_mi -> 'shapes' -> v_ji ->> 'rot')::numeric, 0));
    for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> v_mi -> 'shapes') - 1 loop
      it := v_layout -> 'maps' -> v_mi -> 'shapes' -> j;
      if j <> v_ji and public.venue_plano_es_mueble(it)
         and sqrt(((it ->> 'x')::numeric - v_ox) ^ 2 + ((it ->> 'y')::numeric - v_oy) ^ 2)
             < v_ra + greatest(coalesce((it ->> 'w')::numeric, 54), coalesce((it ->> 'h')::numeric, 54)) / 2 + 4 then raise exception 'mesa_encima'; end if;
    end loop;
    if jsonb_typeof(v_layout -> 'maps' -> v_mi -> 'tables') = 'array' then
      for g in select * from jsonb_array_elements(v_layout -> 'maps' -> v_mi -> 'tables') loop
        if public.venue_mesa_choca(v_mu, g, 8) then raise exception 'mesa_encima'; end if;
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
            if k <> j and public.venue_mesa_choca(jsonb_build_object('t', 'round', 'x', v_x, 'y', v_y, 'seats', nullif(v_t ->> 'seats', '')::integer, 'r', p_radius), g, 8) then raise exception 'mesa_encima'; end if;
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


revoke all on function public.venue_mesa_choca(jsonb, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.venue_plano_poner_tamano(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text, integer) from public, anon, authenticated;
grant execute on function public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text, integer) to authenticated;
revoke all on function public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text, integer) from public, anon, authenticated;
grant execute on function public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text, integer) to authenticated;
revoke all on function public.venue_plano_mover_muebles(jsonb, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: filas_mesas_largas=false (112 px entre filas ya cabe), pegadas=true (50 px no cabe), anon_alguna=false, firmas_add_table=2, funciones_temporales=0 ──
select public.venue_mesa_choca('{"t":"rect","x":320,"y":232,"w":108,"h":54}'::jsonb, '{"t":"rect","x":320,"y":120,"w":108,"h":54}'::jsonb, 8) as filas_mesas_largas,
       public.venue_mesa_choca('{"t":"rect","x":320,"y":232,"w":108,"h":54}'::jsonb, '{"t":"rect","x":320,"y":182,"w":108,"h":54}'::jsonb, 8) as pegadas,
       (select count(*) from pg_proc where proname = 'venue_mesa_choca' and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))) > 0 as anon_alguna,
       (select count(*) from pg_proc where proname in ('venue_room_add_table', 'venue_event_add_table')) as firmas_add_table,
       (select count(*) from pg_proc where proname like 'venue_tmp_%') as funciones_temporales;
