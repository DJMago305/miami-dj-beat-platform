-- ============================================================================
-- ENTORNO: PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr) — *** NO APLICADO *** (preparado el 2026-10-03)
-- Quién lo aplica: el PO, en el SQL Editor de Supabase. ADITIVO: crea DOS funciones nuevas; no cambia ni borra datos.
-- Requiere 20261003_sala_mesas_inventario_por_evento.sql (venue_event_tables, venue_staff_set_table, venue_event_venue_id).
-- ============================================================================
-- ⚠️ ORDEN: la función venue_plano_bloquea de este script fue ampliada por 20261004_plano_formas.sql (figuras del editor de planos). Si vuelves a correr este
-- script, corre ese DESPUÉS para no volver a la versión anterior.
-- «ARMAR GRUPO»: un cliente llama con un grupo grande (p. ej. 20 personas) y el manager o el vendedor mueve y junta mesas EN EL MOMENTO,
-- forma un diseño rápido y las vende todas con un solo nombre.
--   · venue_event_move_tables(evento, [{key,x,y},…]) mueve mesas SOLO en el plano de ESE evento (venue_events.layout); la plantilla de la sala y los
--     demás eventos no cambian. No mueve mesas vendidas ni con alguien pagando (la espera vigente); apartadas y libres sí.
--   · venue_staff_set_tables(evento, [claves], acción, nombre, nota) aparta / vende a mano / libera VARIAS mesas de golpe, TODO O NADA: si una no se
--     puede, no se toca ninguna. Reusa venue_staff_set_table (mismas reglas y permisos por mesa).
--   · La arquitectura de la sala no cambia: no se puede soltar una mesa sobre el escenario, los baños ni la barra (mesa_sobre_estructura).
--   · Quién puede: dueño, manager y equipo (can_sell_venue) y admin de la plataforma. Máximo 40 mesas por movimiento o venta.
-- La página pública lee el plano del evento cada ~15 s: el cambio se ve solo, sin recargar.
-- ============================================================================
-- La arquitectura de la sala NO cambia (escenario, baños, barra); solo se reordenan las mesas. Una mesa no puede quedar encima de una estructura
-- (el escenario del plano y los elementos fijos con tipo «bano» o «barra»; la pista no cuenta). Margen de 22 px alrededor, por el tamaño de la mesa.
create or replace function public.venue_plano_bloquea(p_map jsonb, p_x numeric, p_y numeric)
returns boolean language plpgsql immutable set search_path to 'public' as $$
declare r jsonb; f jsonb;
begin
  r := p_map -> 'focal' -> 'rect';
  if jsonb_typeof(r) = 'array' and jsonb_array_length(r) = 4
     and p_x between (r ->> 0)::numeric - 22 and (r ->> 0)::numeric + (r ->> 2)::numeric + 22
     and p_y between (r ->> 1)::numeric - 22 and (r ->> 1)::numeric + (r ->> 3)::numeric + 22 then return true; end if;
  if jsonb_typeof(p_map -> 'fixed') = 'array' then
    for f in select * from jsonb_array_elements(p_map -> 'fixed') loop
      r := f -> 'r';
      if (f ->> 'k') in ('bano', 'barra') and jsonb_typeof(r) = 'array' and jsonb_array_length(r) = 4
         and p_x between (r ->> 0)::numeric - 22 and (r ->> 0)::numeric + (r ->> 2)::numeric + 22
         and p_y between (r ->> 1)::numeric - 22 and (r ->> 1)::numeric + (r ->> 3)::numeric + 22 then return true; end if;
    end loop;
  end if;
  return false;
end $$;

create or replace function public.venue_event_move_tables(p_event_id uuid, p_moves jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id);
  v_layout jsonb; v_total integer; mv jsonb; v_key text; v_x numeric; v_y numeric; r public.venue_event_tables%rowtype;
  i integer; j integer; v_hecho boolean; n integer := 0; v_vistas text[] := '{}';
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue)) then raise exception 'no_autorizado'; end if;
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
            -- el límite es el tamaño de ESE plano (maps[i].room; 800 x 520 si no trae)
            if v_x > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'w')::numeric, 800) or v_y > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'h')::numeric, 520) then raise exception 'movimiento_invalido'; end if;
            if public.venue_plano_bloquea(v_layout -> 'maps' -> i, v_x, v_y) then raise exception 'mesa_sobre_estructura'; end if;
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

create or replace function public.venue_staff_set_tables(p_event_id uuid, p_keys text[], p_action text, p_name text default null, p_note text default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid := public.venue_event_venue_id(p_event_id); k text; n integer := 0;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_keys is null or coalesce(array_length(p_keys, 1), 0) < 1 or array_length(p_keys, 1) > 40
     or (select count(distinct x) from unnest(p_keys) x) <> array_length(p_keys, 1) then raise exception 'grupo_invalido'; end if;
  foreach k in array p_keys loop
    perform public.venue_staff_set_table(p_event_id, k, p_action, p_name, p_note);   -- si una falla, se cancela TODO (una sola transacción)
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.venue_plano_bloquea(jsonb, numeric, numeric) from public, anon, authenticated;
revoke all on function public.venue_event_move_tables(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_event_move_tables(uuid, jsonb) to authenticated;
revoke all on function public.venue_staff_set_tables(uuid, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.venue_staff_set_tables(uuid, text[], text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- Comprobación: 2 filas (las dos funciones nuevas existen y solo las ejecuta "authenticated").
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('venue_event_move_tables', 'venue_staff_set_tables') order by p.proname;
