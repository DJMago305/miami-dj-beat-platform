-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · TALLER DE MONTAJE DE LA SALA (pedido del PO 2026-10-07): el equipo autorizado arma la sala física DIRECTAMENTE sobre el plano base (la plantilla de la sala),
-- sin necesidad de crear ni elegir un evento: mover mesas, agregar mesas (forma y sillas), editar sillas y precio sugerido, y eliminar mesas.
-- Requiere 20261007_venue_autorizaciones_del_owner.sql ya aplicado (can_manage_venue_layout = dueño o quien el dueño autorizó con «Diseñar y mover la sala»).
--
-- Reglas (igual que dentro de un evento, pero sobre venue_rooms.layout):
--   · Solo se toca el MOBILIARIO (las mesas): el dibujo de la arquitectura (escenario, paredes, baños, barra, puertas) NO se puede cambiar desde aquí;
--     venue_room_set_layout (el editor de planos) sigue siendo solo de Miami DJ Beat. Una mesa no puede quedar sobre el escenario, los baños o la barra (mesa_sobre_estructura).
--   · Lo que cambia aquí vale para los eventos que se creen DESPUÉS (cada evento se crea con una copia del plano base). Los eventos que ya existen no cambian.
--   · Límites: hasta 300 mesas, 1–40 sillas, precio sugerido 0–10 000 USD (en centavos), dentro del tamaño del plano, sin dos mesas encimadas.
--   · Quién: dueño, quien tenga «Diseñar y mover la sala», y el admin de la plataforma. Todo en una sola transacción (todo o nada).

create or replace function public.venue_room_move_tables(p_room_id uuid, p_moves jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid; v_layout jsonb; v_total integer; mv jsonb; v_key text; v_x numeric; v_y numeric; i integer; j integer; v_hecho boolean; n integer := 0; v_vistas text[] := '{}';
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
            if public.venue_plano_bloquea(v_layout -> 'maps' -> i, v_x, v_y) then raise exception 'mesa_sobre_estructura'; end if;
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

create or replace function public.venue_room_add_table(p_room_id uuid, p_map_id text, p_x numeric, p_y numeric, p_seats integer, p_price_cents integer, p_shape text default 'round')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid; v_layout jsonb; v_mi integer := null; v_i integer; v_w numeric; v_h numeric; v_key text; v_n integer := 1;
  v_zone text; v_area text; v_best numeric := null; v_best_id text; v_d numeric; g jsonb; v_tpl jsonb; v_tbl jsonb; v_geo jsonb; v_maptables jsonb;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_seats is null or p_seats < 1 or p_seats > 40 then return jsonb_build_object('ok', false, 'error', 'sillas_invalidas'); end if;
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 1000000 then return jsonb_build_object('ok', false, 'error', 'precio_invalido'); end if;
  if p_shape is null or p_shape not in ('round', 'square', 'rect') then return jsonb_build_object('ok', false, 'error', 'forma_invalida'); end if;
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
  if public.venue_plano_bloquea(v_layout -> 'maps' -> v_mi, p_x, p_y) then return jsonb_build_object('ok', false, 'error', 'mesa_sobre_estructura'); end if;

  v_maptables := case when jsonb_typeof(v_layout -> 'maps' -> v_mi -> 'tables') = 'array' then v_layout -> 'maps' -> v_mi -> 'tables' else '[]'::jsonb end;
  for g in select * from jsonb_array_elements(v_maptables) loop
    v_d := (coalesce((g ->> 'x')::numeric, 0) - p_x) ^ 2 + (coalesce((g ->> 'y')::numeric, 0) - p_y) ^ 2;
    if abs(coalesce((g ->> 'x')::numeric, 0) - p_x) < 34 and abs(coalesce((g ->> 'y')::numeric, 0) - p_y) < 34 then return jsonb_build_object('ok', false, 'error', 'mesa_encima'); end if;
    if v_best is null or v_d < v_best then v_best := v_d; v_best_id := g ->> 'id'; end if;
  end loop;
  if v_best_id is not null then
    select t into v_tpl from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = v_best_id limit 1;
    v_zone := v_tpl ->> 'zone'; v_area := v_tpl ->> 'area';
  end if;
  loop
    v_key := 'X' || lpad(v_n::text, 2, '0');
    exit when not exists (select 1 from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = v_key);
    v_n := v_n + 1;
    if v_n > 99 then return jsonb_build_object('ok', false, 'error', 'demasiadas_mesas'); end if;
  end loop;

  v_tbl := jsonb_build_object('key', v_key, 'label', v_key, 'seats', p_seats, 'price_cents', p_price_cents)
           || case when v_zone is not null then jsonb_build_object('zone', v_zone) else '{}'::jsonb end
           || case when v_area is not null then jsonb_build_object('area', v_area) else '{}'::jsonb end;
  v_geo := jsonb_build_object('t', p_shape, 'x', round(p_x), 'y', round(p_y), 'id', v_key, 'seats', p_seats)
           || case p_shape when 'square' then jsonb_build_object('w', 54) when 'rect' then jsonb_build_object('w', 108, 'h', 54) else '{}'::jsonb end;
  v_layout := jsonb_set(v_layout, '{tables}', (v_layout -> 'tables') || jsonb_build_array(v_tbl));
  v_layout := jsonb_set(v_layout, array['maps', v_mi::text, 'tables'], v_maptables || jsonb_build_array(v_geo));
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_build_object('ok', true, 'key', v_key);
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

create or replace function public.venue_room_remove_table(p_room_id uuid, p_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid; v_layout jsonb; v_i integer;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_rooms where id = p_room_id for update;
  if v_layout is null or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' then raise exception 'sin_plano'; end if;
  if not exists (select 1 from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = p_key) then raise exception 'mesa_no_existe'; end if;
  if jsonb_array_length(v_layout -> 'tables') <= 1 then return jsonb_build_object('ok', false, 'error', 'ultima_mesa'); end if;
  v_layout := jsonb_set(v_layout, '{tables}', coalesce((select jsonb_agg(t order by ord) from jsonb_array_elements(v_layout -> 'tables') with ordinality as x(t, ord) where t ->> 'key' <> p_key), '[]'::jsonb));
  if jsonb_typeof(v_layout -> 'maps') = 'array' then
    for v_i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
      if jsonb_typeof(v_layout -> 'maps' -> v_i -> 'tables') = 'array' then
        v_layout := jsonb_set(v_layout, array['maps', v_i::text, 'tables'], coalesce((select jsonb_agg(t order by ord) from jsonb_array_elements(v_layout -> 'maps' -> v_i -> 'tables') with ordinality as x(t, ord) where t ->> 'id' <> p_key), '[]'::jsonb));
      end if;
    end loop;
  end if;
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_build_object('ok', true, 'key', p_key);
end $$;

revoke all on function public.venue_room_move_tables(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_room_move_tables(uuid, jsonb) to authenticated;
revoke all on function public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text) from public, anon, authenticated;
grant execute on function public.venue_room_add_table(uuid, text, numeric, numeric, integer, integer, text) to authenticated;
revoke all on function public.venue_room_edit_table(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.venue_room_edit_table(uuid, text, integer, integer) to authenticated;
revoke all on function public.venue_room_remove_table(uuid, text) from public, anon, authenticated;
grant execute on function public.venue_room_remove_table(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura): 4 filas, anon_puede=false y authenticated_puede=true en las cuatro ──
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('venue_room_move_tables', 'venue_room_add_table', 'venue_room_edit_table', 'venue_room_remove_table') order by p.proname;
