-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · SILLAS POR LADO EN MESAS RECTANGULARES Y CUADRADAS (pedido del PO 2026-10-07: «una silla a cada lado [cabeceras] y una silla en un lado y en el otro no, porque a veces se juntan 2 largas»;
-- «mesas de dos y de tres en las paredes»: la mesa cuadrada también se acomoda por lado, el que da a la pared va sin silla).
-- Requiere 20261007_venue_taller_de_la_sala.sql y 20261007_venue_evento_mesas_agregar_editar_quitar.sql ya aplicados. Sin tablas ni columnas nuevas.
--
-- Una mesa RECTANGULAR tiene 4 lados: dos largos (arriba / abajo) y dos cabeceras (izquierda / derecha). Cada lado largo lleva de 0 a 6 sillas y cada cabecera 0 o 1.
-- Una mesa CUADRADA lleva 0 o 1 silla por lado (de 1 a 4 sillas: 2 o 3 pegada a la pared).
-- La distribución se guarda en el dibujo de la mesa (maps[].tables[].chairs = {t, b, l, r}) y el total de sillas (seats) se actualiza en la lista de mesas, en el dibujo y,
-- en un evento, en el inventario. El precio y las ventas NO cambian. Total: de 1 a 14 sillas (rectangular) o de 1 a 4 (cuadrada). Solo mesas cuadradas y rectangulares ('solo_cuadradas_y_rectangulares').
-- venue_room_set_chairs(sala, mesa, arriba, abajo, izquierda, derecha): la mesa del plano base (vale para los eventos que se creen después).
-- venue_event_set_chairs(evento, mesa, ...): solo ESA mesa de ESE evento; no si ya se vendió o alguien la está pagando. Permiso: el de diseñar la sala (can_manage_venue_layout).

create or replace function public.venue_plano_poner_sillas(p_layout jsonb, p_key text, p_top integer, p_bottom integer, p_left integer, p_right integer)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v_layout jsonb := p_layout; i integer; j integer; v_hecho boolean := false; v_total integer; v_ch jsonb;
begin
  if p_top is null or p_bottom is null or p_left is null or p_right is null
     or p_top not between 0 and 6 or p_bottom not between 0 and 6 or p_left not between 0 and 1 or p_right not between 0 and 1 then raise exception 'sillas_invalidas'; end if;
  v_total := p_top + p_bottom + p_left + p_right;
  if v_total < 1 or v_total > 14 then raise exception 'sillas_invalidas'; end if;
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0 or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' then raise exception 'sin_plano'; end if;
  v_ch := jsonb_build_object('t', p_top, 'b', p_bottom, 'l', p_left, 'r', p_right);
  for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
    if jsonb_typeof(v_layout -> 'maps' -> i -> 'tables') = 'array' then
      for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'tables') - 1 loop
        if v_layout -> 'maps' -> i -> 'tables' -> j ->> 'id' = p_key then
          if v_layout -> 'maps' -> i -> 'tables' -> j ->> 't' not in ('rect', 'square') then raise exception 'solo_cuadradas_y_rectangulares'; end if;
          if v_layout -> 'maps' -> i -> 'tables' -> j ->> 't' = 'square' and (p_top > 1 or p_bottom > 1 or v_total > 4) then raise exception 'sillas_invalidas'; end if;
          v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'chairs'], v_ch);
          v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'seats'], to_jsonb(v_total));
          v_hecho := true;
        end if;
      end loop;
    end if;
  end loop;
  if not v_hecho then raise exception 'mesa_sin_dibujo'; end if;
  v_layout := jsonb_set(v_layout, '{tables}', coalesce((
    select jsonb_agg(case when x.t ->> 'key' = p_key then x.t || jsonb_build_object('seats', v_total) else x.t end order by x.ord)
      from jsonb_array_elements(v_layout -> 'tables') with ordinality as x(t, ord)), '[]'::jsonb));
  return v_layout;
end $$;

create or replace function public.venue_room_set_chairs(p_room_id uuid, p_key text, p_top integer, p_bottom integer, p_left integer, p_right integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid; v_layout jsonb;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_rooms where id = p_room_id for update;
  v_layout := public.venue_plano_poner_sillas(v_layout, p_key, p_top, p_bottom, p_left, p_right);
  update public.venue_rooms set layout = v_layout, updated_at = now() where id = p_room_id;
  return jsonb_build_object('ok', true, 'key', p_key, 'seats', p_top + p_bottom + p_left + p_right);
end $$;

create or replace function public.venue_event_set_chairs(p_event_id uuid, p_key text, p_top integer, p_bottom integer, p_left integer, p_right integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid := public.venue_event_venue_id(p_event_id); v_layout jsonb; r public.venue_event_tables%rowtype;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select layout into v_layout from public.venue_events where id = p_event_id for update;
  select * into r from public.venue_event_tables where event_id = p_event_id and table_key = p_key for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  if r.status = 'sold' or (r.status = 'held' and r.held_until >= now()) then return jsonb_build_object('ok', false, 'error', 'mesa_no_se_puede_editar'); end if;
  v_layout := public.venue_plano_poner_sillas(v_layout, p_key, p_top, p_bottom, p_left, p_right);
  update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  update public.venue_event_tables set seats = p_top + p_bottom + p_left + p_right where id = r.id;
  return jsonb_build_object('ok', true, 'key', p_key, 'seats', p_top + p_bottom + p_left + p_right);
end $$;

revoke all on function public.venue_plano_poner_sillas(jsonb, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.venue_room_set_chairs(uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.venue_room_set_chairs(uuid, text, integer, integer, integer, integer) to authenticated;
revoke all on function public.venue_event_set_chairs(uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.venue_event_set_chairs(uuid, text, integer, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: 3 filas con anon_puede=false; las 2 públicas con authenticated_puede=true y la interna con false ──
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('venue_plano_poner_sillas', 'venue_room_set_chairs', 'venue_event_set_chairs')
 order by p.proname;
