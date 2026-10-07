-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · mesas y sillas POR EVENTO: agregar una mesa, cambiar sus sillas/precio y quitarla. (Mover mesas ya existe: venue_event_move_tables.)
-- ADITIVO: crea TRES funciones nuevas; no cambia ni borra datos existentes ni toca la plantilla de la sala ni los demás eventos.
-- Requiere 20261003_sala_mesas_inventario_por_evento.sql y 20261003_mesas_armar_grupo.sql ya aplicados (venue_event_tables, venue_plano_bloquea).
--
-- Reglas (pedido del PO 2026-10-07: «las mesas y sillas se personalizan por evento; el plano de la sala lo dibuja solo Miami DJ Beat»):
--   · Solo dueño y manager del local (y admin de la plataforma). El equipo («team») vende y mueve, no cambia inventario ni precios.
--   · Todo cambio vale SOLO para ESE evento: la plantilla de la sala (venue_rooms.layout) y los demás eventos no cambian.
--   · No se toca una mesa vendida ni con alguien pagando (la espera vigente); libres y apartadas sí se editan, y solo las libres se quitan.
--   · Una mesa nueva nace dentro del plano de ese evento: no sobre el escenario, baños o barra (mesa_sobre_estructura), no encima de otra (mesa_encima),
--     dentro del tamaño del plano (fuera_del_plano). Sillas 1–40, precio 0–10 000 USD (en centavos), máximo 300 mesas por evento.
--   · Las sillas y el precio se guardan en los TRES sitios que lee el sistema (venue_event_tables, venue_events.layout.tables y el dibujo del plano),
--     para que la sala de compra pública y la lista de mesas muestren siempre lo mismo.
--   · La sala de compra pública lee el plano y el inventario del evento cada pocos segundos: el cambio se ve solo.

create or replace function public.venue_event_add_table(p_event_id uuid, p_map_id text, p_x numeric, p_y numeric, p_seats integer, p_price_cents integer, p_shape text default 'round')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id);
  v_layout jsonb; v_mi integer := null; v_i integer; v_w numeric; v_h numeric; v_key text; v_n integer := 1;
  v_zone text; v_area text; v_best numeric := null; v_best_id text; v_d numeric; g jsonb; v_tpl jsonb; v_tbl jsonb; v_geo jsonb; v_maptables jsonb;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_seats is null or p_seats < 1 or p_seats > 40 then return jsonb_build_object('ok', false, 'error', 'sillas_invalidas'); end if;
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 1000000 then return jsonb_build_object('ok', false, 'error', 'precio_invalido'); end if;
  if p_shape is null or p_shape not in ('round', 'square', 'rect') then return jsonb_build_object('ok', false, 'error', 'forma_invalida'); end if;
  if p_x is null or p_y is null or p_x < 0 or p_x > 2000 or p_y < 0 or p_y > 2000 then return jsonb_build_object('ok', false, 'error', 'fuera_del_plano'); end if;

  select layout into v_layout from public.venue_events where id = p_event_id for update;            -- serializa con otros cambios del mismo evento
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

  -- La mesa nueva hereda la zona y el área de la mesa más cercana de ese plano (así se vende en la misma área).
  if v_best_id is not null then
    select t into v_tpl from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = v_best_id limit 1;
    v_zone := v_tpl ->> 'zone'; v_area := v_tpl ->> 'area';
  end if;

  loop                                                                                                 -- llave libre: X01, X02, … (nunca choca con la plantilla)
    v_key := 'X' || lpad(v_n::text, 2, '0');
    exit when not exists (select 1 from jsonb_array_elements(v_layout -> 'tables') t where t ->> 'key' = v_key)
          and not exists (select 1 from public.venue_event_tables k where k.event_id = p_event_id and k.table_key = v_key);
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
  update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  insert into public.venue_event_tables (event_id, table_key, label, seats, zone_name, price_cents) values (p_event_id, v_key, v_key, p_seats, v_zone, p_price_cents);
  return jsonb_build_object('ok', true, 'key', v_key);
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

create or replace function public.venue_event_remove_table(p_event_id uuid, p_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id);
  v_layout jsonb; r public.venue_event_tables%rowtype; v_i integer;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;

  select layout into v_layout from public.venue_events where id = p_event_id for update;
  select * into r from public.venue_event_tables where event_id = p_event_id and table_key = p_key for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  if not (r.status = 'available' or (r.status = 'held' and r.held_until < now())) then return jsonb_build_object('ok', false, 'error', 'mesa_no_se_puede_quitar'); end if;   -- apartada, vendida o con alguien pagando: no
  if (select count(*) from public.venue_event_tables k where k.event_id = p_event_id) <= 1 then return jsonb_build_object('ok', false, 'error', 'ultima_mesa'); end if;

  delete from public.venue_event_tables where id = r.id;
  if v_layout is not null and jsonb_typeof(v_layout -> 'tables') = 'array' then
    v_layout := jsonb_set(v_layout, '{tables}', coalesce((select jsonb_agg(t order by ord) from jsonb_array_elements(v_layout -> 'tables') with ordinality as x(t, ord) where t ->> 'key' <> p_key), '[]'::jsonb));
    if jsonb_typeof(v_layout -> 'maps') = 'array' then
      for v_i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
        if jsonb_typeof(v_layout -> 'maps' -> v_i -> 'tables') = 'array' then
          v_layout := jsonb_set(v_layout, array['maps', v_i::text, 'tables'], coalesce((select jsonb_agg(t order by ord) from jsonb_array_elements(v_layout -> 'maps' -> v_i -> 'tables') with ordinality as x(t, ord) where t ->> 'id' <> p_key), '[]'::jsonb));
        end if;
      end loop;
    end if;
    update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  end if;
  return jsonb_build_object('ok', true, 'key', p_key);
end $$;

revoke all on function public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text) from public, anon, authenticated;
grant execute on function public.venue_event_add_table(uuid, text, numeric, numeric, integer, integer, text) to authenticated;
revoke all on function public.venue_event_edit_table(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.venue_event_edit_table(uuid, text, integer, integer) to authenticated;
revoke all on function public.venue_event_remove_table(uuid, text) from public, anon, authenticated;
grant execute on function public.venue_event_remove_table(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura): 3 filas, anon_puede=false y authenticated_puede=true en las tres ──
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('venue_event_add_table', 'venue_event_edit_table', 'venue_event_remove_table') order by p.proname;
