-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · GIRAR UNA MESA (con sus sillas): pedido del PO 2026-10-07 («muchas veces las sillas no están en la posición que quiero»).
-- Requiere 20261007_venue_taller_de_la_sala.sql y 20261007_venue_evento_mesas_agregar_editar_quitar.sql ya aplicados. Sin tablas ni columnas nuevas.
--
-- El giro es un número (grados, 0-359) que se guarda en el dibujo de la mesa (maps[].tables[].rot); la lista de mesas, los precios, las sillas y las ventas NO cambian.
-- venue_room_rotate_table(sala, mesa, grados): la mesa del plano base (vale para los eventos que se creen después).
-- venue_event_rotate_table(evento, mesa, grados): solo ESA mesa de ESE evento; igual que mover: no si ya se vendió o alguien la está pagando.
-- Permiso: el mismo de mover mesas (dueño y quien el dueño autorizó a diseñar la sala, can_manage_venue_layout).

create or replace function public.venue_plano_girar_mesa(p_layout jsonb, p_key text, p_rot integer)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v_layout jsonb := p_layout; i integer; j integer; v_hecho boolean := false; v_rot integer;
begin
  if p_rot is null then raise exception 'giro_invalido'; end if;
  v_rot := ((p_rot % 360) + 360) % 360;
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0 then raise exception 'sin_plano'; end if;
  for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
    if jsonb_typeof(v_layout -> 'maps' -> i -> 'tables') = 'array' then
      for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'tables') - 1 loop
        if v_layout -> 'maps' -> i -> 'tables' -> j ->> 'id' = p_key then
          v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'rot'], to_jsonb(v_rot));
          v_hecho := true;
        end if;
      end loop;
    end if;
  end loop;
  if not v_hecho then raise exception 'mesa_sin_dibujo'; end if;
  return v_layout;
end $$;

create or replace function public.venue_room_rotate_table(p_room_id uuid, p_key text, p_rot integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid; v_layout jsonb;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_rooms where id = p_room_id for update;
  v_layout := public.venue_plano_girar_mesa(v_layout, p_key, p_rot);
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_build_object('ok', true, 'key', p_key, 'rot', ((p_rot % 360) + 360) % 360);
end $$;

create or replace function public.venue_event_rotate_table(p_event_id uuid, p_key text, p_rot integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid := public.venue_event_venue_id(p_event_id); v_layout jsonb; r public.venue_event_tables%rowtype;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_events where id = p_event_id for update;
  select * into r from public.venue_event_tables where event_id = p_event_id and table_key = p_key for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  if r.status = 'sold' or (r.status = 'held' and r.held_until >= now()) then raise exception 'mesa_no_se_puede_mover'; end if;
  v_layout := public.venue_plano_girar_mesa(v_layout, p_key, p_rot);
  update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  return jsonb_build_object('ok', true, 'key', p_key, 'rot', ((p_rot % 360) + 360) % 360);
end $$;

revoke all on function public.venue_plano_girar_mesa(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.venue_room_rotate_table(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.venue_room_rotate_table(uuid, text, integer) to authenticated;
revoke all on function public.venue_event_rotate_table(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.venue_event_rotate_table(uuid, text, integer) to authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: 3 filas con anon_puede=false; las 2 públicas con authenticated_puede=true y la interna con false ──
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('venue_plano_girar_mesa', 'venue_room_rotate_table', 'venue_event_rotate_table')
 order by p.proname;
