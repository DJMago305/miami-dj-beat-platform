-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · MESAS DE LA TERRAZA: numeradas (T01…T12, como las nombra el personal) y MOVIBLES por evento (bodas, cumpleaños: la terraza se renta completa y se reacomoda).
-- Requiere 20261007_venue_taller_de_la_sala.sql y 20261007_venue_taburetes_de_barra.sql ya aplicados.
--
-- Qué son estas mesas: las 12 figuras cuadradas (54 x 54) que el plano trae dibujadas en la TERRAZA. NO son inventario de venta (la terraza no se vende mesa por mesa:
-- se renta completa), así que NO se tocan las ventas, ni el inventario, ni la sala pública, ni ninguna tabla. Solo se les pone nombre y se permite moverlas.
--
--   1) Rótulo: T01…T06 (fila de arriba, de izquierda a derecha) y T07…T12 (fila de abajo), en el plano base de la sala y en la copia de cada evento que no esté cancelado.
--      Idempotente: solo rotula las que no tienen rótulo; volver a correrlo no cambia nada.
--   2) «Mobiliario movible» = una figura cuadrada/rectangular chica (hasta 120 px) cuyo rótulo es T + número. No se agrega ninguna columna ni campo nuevo (así no se pierde si el
--      plano se vuelve a guardar desde el editor). La arquitectura (escenario, paredes, baños, barra, puertas, áreas) NO se puede mover con estas funciones: 'no_es_mueble'.
--   3) venue_room_move_shapes(sala, movimientos) y venue_event_move_shapes(evento, movimientos): mismas reglas de permiso que mover mesas (dueño y quien el dueño autorizó a diseñar la
--      sala, can_manage_venue_layout). Dentro del plano, nunca sobre la estructura (margen 30 px) y sin pisar a otro mueble ni a una mesa. En la plantilla vale para los eventos que se
--      creen después; en un evento, solo para ese evento (cada evento guarda su propia copia).

create or replace function public.venue_plano_es_mueble(p_it jsonb)
returns boolean language sql immutable set search_path to 'public' as $$
  select coalesce(p_it ->> 'k' = 'shape'
                  and coalesce(p_it ->> 'label', '') ~ '^T[0-9]{1,3}$'
                  and coalesce((p_it ->> 'w')::numeric, 999) <= 120
                  and coalesce((p_it ->> 'h')::numeric, 999) <= 120, false);
$$;

-- Mueve figuras-mueble dentro de un layout y devuelve el layout nuevo (la usan las dos funciones públicas; no se llama desde el navegador).
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
           < v_ra + public.venue_mesa_radio(g ->> 't', nullif(g ->> 'seats', '')::integer, nullif(g ->> 'w', '')::numeric, nullif(g ->> 'h', '')::numeric) + 8 then raise exception 'mesa_encima'; end if;
      end loop;
    end if;
  end loop;
  return v_layout;
end $$;

create or replace function public.venue_room_move_shapes(p_room_id uuid, p_moves jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid; v_layout jsonb;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_rooms where id = p_room_id for update;
  v_layout := public.venue_plano_mover_muebles(v_layout, p_moves);
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_array_length(p_moves);
end $$;

create or replace function public.venue_event_move_shapes(p_event_id uuid, p_moves jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid := public.venue_event_venue_id(p_event_id); v_layout jsonb;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_events where id = p_event_id for update;
  v_layout := public.venue_plano_mover_muebles(v_layout, p_moves);
  update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  return jsonb_array_length(p_moves);
end $$;

revoke all on function public.venue_plano_es_mueble(jsonb) from public, anon, authenticated;
revoke all on function public.venue_plano_mover_muebles(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.venue_room_move_shapes(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_room_move_shapes(uuid, jsonb) to authenticated;
revoke all on function public.venue_event_move_shapes(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_event_move_shapes(uuid, jsonb) to authenticated;

-- ── Rotular las 12 mesas de la terraza (plano base y copias de eventos no cancelados). Se identifican por su lugar exacto en el plano: cuadradas de 54 x 54,
--    en las filas y = 705 / 785 y columnas x = 250 + 160 · n (n = 0…5). Solo se rotulan las que no traen rótulo. ──
create or replace function public.venue_tmp_rotular_terraza(p_layout jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v_layout jsonb := p_layout; i integer; j integer; it jsonb; v_col numeric; v_n integer;
begin
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' then return p_layout; end if;
  for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
    if jsonb_typeof(v_layout -> 'maps' -> i -> 'shapes') = 'array' then
      for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'shapes') - 1 loop
        it := v_layout -> 'maps' -> i -> 'shapes' -> j;
        if it ->> 'k' = 'shape' and it ->> 'sub' = 'rect' and (it ->> 'w')::numeric = 54 and (it ->> 'h')::numeric = 54
           and (it ->> 'y')::numeric in (705, 785) and coalesce(it ->> 'label', '') = '' then
          v_col := ((it ->> 'x')::numeric - 250) / 160;
          if v_col = trunc(v_col) and v_col between 0 and 5 then
            v_n := case when (it ->> 'y')::numeric = 705 then 0 else 6 end + v_col::integer + 1;
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'shapes', j::text, 'label'], to_jsonb('T' || lpad(v_n::text, 2, '0')));
          end if;
        end if;
      end loop;
    end if;
  end loop;
  return v_layout;
end $$;

update public.venue_rooms set layout = public.venue_tmp_rotular_terraza(layout), updated_at = now()
 where layout is not null and layout is distinct from public.venue_tmp_rotular_terraza(layout);
update public.venue_events set layout = public.venue_tmp_rotular_terraza(layout), updated_at = now()
 where status <> 'cancelled' and layout is not null and layout is distinct from public.venue_tmp_rotular_terraza(layout);
drop function public.venue_tmp_rotular_terraza(jsonb);

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: 4 filas con anon_puede=false (las 2 públicas con authenticated_puede=true, las 2 internas con false);
--    y mesas_terraza_plano_base=12, rotulos=T01,T02,…,T12 ──
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('venue_plano_es_mueble', 'venue_plano_mover_muebles', 'venue_room_move_shapes', 'venue_event_move_shapes')
 order by p.proname;

select count(*) filter (where public.venue_plano_es_mueble(s)) as mesas_terraza_plano_base,
       string_agg(s ->> 'label', ',' order by s ->> 'label') filter (where public.venue_plano_es_mueble(s)) as rotulos
  from public.venue_rooms r, jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') s;
