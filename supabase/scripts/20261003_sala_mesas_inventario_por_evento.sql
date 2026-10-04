-- ============================================================================
-- ENTORNO: PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr) — *** NO APLICADO *** (preparado el 2026-10-03)
-- Quién lo aplica: el PO, en el SQL Editor de Supabase. Es ADITIVO: no borra ni cambia datos existentes.
-- Antes de aplicarlo: leer docs/tickets/2026-10-02-TICKET-sala-de-mesas-fase-2-venta-sin-sobreventa.md (§3, §3f, §4).
-- Probado: supabase/tests/sala_mesas_inventario.test.mjs corre este archivo en un Postgres real embebido (PGlite) con los mismos
--          roles (anon / authenticated / service_role) y las mismas funciones de permisos del local.
-- ============================================================================
-- SALA DE MESAS · FASE 2 · INVENTARIO POR EVENTO
--
-- Regla del PO (2026-10-03): cada evento (cada día) tiene SU sala y vende SUS mesas por separado: la misma mesa se puede vender
-- cada día y se marca de forma independiente. Por eso el inventario es UNA FILA POR MESA *Y* POR EVENTO (unique(event_id, table_key)).
--
-- Quién puede qué (reusa los roles del local ya instalados: venue_role / can_sell_venue / can_manage_venue_layout):
--   · Cliente sin sesión ........ ve qué mesas están libres (venue_event_tables_public) y paga; NUNCA escribe directo.
--   · Dueño y manager ........... abren la venta de mesas de un evento (venue_event_open_tables), fijan el mapa de la sala.
--   · Dueño, manager y equipo ... ven todo el inventario (RLS) y aparten / venden a mano / liberan (venue_staff_set_table).
--   · service_role (Edge Functions) toma la reserva temporal, la libera y confirma la venta tras el pago de Stripe.
-- Anti-sobreventa: TODO cambio de estado es un UPDATE atómico dentro de una función (si dos personas piden la misma mesa gana una;
-- la otra recibe 'mesa_no_disponible' y no se toma NINGUNA de sus mesas).
--
-- Formato del mapa (venue_rooms.layout = plantilla de la sala; venue_events.layout = copia del evento):
--   { "tables": [ { "key":"M1", "label":"M1", "seats":4, "zone":"Zona 1 · Frente al escenario", "price_cents":40000 }, ... ] }
--   (la geometría para dibujar el plano puede ir en otras claves del mismo json: la base solo lee "tables".)
-- ============================================================================

-- ── 1. Columnas aditivas ─────────────────────────────────────────────────────
alter table public.venue_events
  add column if not exists layout jsonb not null default '{}'::jsonb,        -- mapa DEL EVENTO (copia de la plantilla al abrir ventas)
  add column if not exists tables_open boolean not null default false;       -- venta de mesas abierta para este evento

alter table public.venue_ticket_orders
  add column if not exists kind text not null default 'tickets',             -- 'tickets' (entradas) | 'tables' (mesas)
  add column if not exists reservation_name text;                            -- nombre de la reserva («Team Alicia»); lo único obligatorio es quien renta
alter table public.venue_ticket_orders drop constraint if exists venue_ticket_orders_kind_check;
alter table public.venue_ticket_orders add constraint venue_ticket_orders_kind_check check (kind in ('tickets', 'tables'));

-- ── 2. Inventario: una fila por mesa y evento ────────────────────────────────
create table if not exists public.venue_event_tables (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.venue_events(id) on delete cascade,
  table_key        text not null,                                          -- «M4»: la etiqueta NO depende de la posición
  label            text not null,
  seats            integer not null default 4 check (seats between 1 and 40),
  zone_name        text,
  price_cents      integer not null check (price_cents >= 0),              -- el precio sale de AQUÍ; el navegador nunca lo manda
  status           text not null default 'available' check (status in ('available', 'held', 'reserved', 'sold')),
  held_until       timestamptz,                                            -- reserva temporal (mientras se paga)
  hold_token       uuid,                                                   -- secreto de quien tiene la reserva temporal
  hold_ip          text,                                                   -- IP de quien aparta (tope de mesas apartadas por IP)
  buyer_name       text,                                                   -- quien renta
  reservation_name text,                                                   -- nombre de la reserva
  note             text,
  sold_via         text check (sold_via in ('online', 'manager')),
  order_id         uuid references public.venue_ticket_orders(id) on delete set null,
  updated_at       timestamptz not null default now(),
  constraint venue_event_tables_unica unique (event_id, table_key)
);
create index if not exists venue_event_tables_event_status_idx on public.venue_event_tables (event_id, status);
create index if not exists venue_event_tables_hold_idx on public.venue_event_tables (hold_token) where hold_token is not null;
alter table public.venue_event_tables add column if not exists hold_ip text;   -- (por si la tabla ya existía sin la columna)
create index if not exists venue_event_tables_hold_ip_idx on public.venue_event_tables (hold_ip) where hold_ip is not null;

-- ── 3. Helper: de qué local es un evento ────────────────────────────────────
create or replace function public.venue_event_venue_id(p_event_id uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select r.venue_id from public.venue_events e join public.venue_rooms r on r.id = e.room_id where e.id = p_event_id;
$$;

-- ── 4. RLS: el staff del local LEE el inventario; NADIE escribe directo (solo las funciones de abajo) ──
alter table public.venue_event_tables enable row level security;
drop policy if exists venue_event_tables_staff_read on public.venue_event_tables;
create policy venue_event_tables_staff_read on public.venue_event_tables
  for select using (
    public.is_platform_admin(auth.uid())
    or public.can_sell_venue(public.venue_event_venue_id(event_id))
  );
revoke all on public.venue_event_tables from public, anon, authenticated;
grant select on public.venue_event_tables to authenticated;

-- ── 5. Mapa de la sala (plantilla): lo fija el dueño o el manager (valida todo o nada; devuelve cuántas mesas fijó) ───────────
-- La version simple que ya existe en produccion (de 20261003_sala_mesas_inventario_por_evento.sql) devolvia void y solo revisaba que el mapa fuera un objeto:
-- Postgres no deja cambiar el tipo de retorno con CREATE OR REPLACE, asi que se reemplaza (nada mas la usa: la pantalla Mesas es quien la va a llamar).
drop function if exists public.venue_room_set_layout(uuid, jsonb);
create or replace function public.venue_room_set_layout(p_room_id uuid, p_layout jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid; v_total integer; v_unicas integer; t jsonb;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;

  if p_layout is null or jsonb_typeof(p_layout) is distinct from 'object' or jsonb_typeof(p_layout -> 'tables') is distinct from 'array' then
    raise exception 'mapa_invalido';
  end if;
  if p_layout ? 'maps' and jsonb_typeof(p_layout -> 'maps') is distinct from 'array' then raise exception 'mapa_invalido'; end if;   -- el dibujo del plano, si viene, debe ser una lista
  v_total := jsonb_array_length(p_layout -> 'tables');
  if v_total < 1 or v_total > 300 then raise exception 'mapa_invalido'; end if;

  for t in select * from jsonb_array_elements(p_layout -> 'tables') loop
    if jsonb_typeof(t) is distinct from 'object'
       or jsonb_typeof(t -> 'key') is distinct from 'string' or length(btrim(t ->> 'key')) = 0 or length(t ->> 'key') > 20
       or jsonb_typeof(t -> 'price_cents') is distinct from 'number'
       or (t ->> 'price_cents')::numeric <> trunc((t ->> 'price_cents')::numeric)
       or (t ->> 'price_cents')::numeric not between 0 and 1000000
       or (t ? 'seats' and (jsonb_typeof(t -> 'seats') is distinct from 'number'
                            or (t ->> 'seats')::numeric <> trunc((t ->> 'seats')::numeric)
                            or (t ->> 'seats')::numeric not between 1 and 40)) then
      raise exception 'mapa_invalido';
    end if;
  end loop;
  select count(distinct x ->> 'key') into v_unicas from jsonb_array_elements(p_layout -> 'tables') x;
  if v_unicas <> v_total then raise exception 'mapa_invalido'; end if;   -- llaves repetidas

  update public.venue_rooms set layout = p_layout, updated_at = now() where id = p_room_id;
  return v_total;
end $$;

-- ── 6. Abrir la venta de mesas de un evento: copia el mapa y crea una fila por mesa ──────
-- Idempotente: volver a correrla NO pisa mesas ya vendidas, apartadas o en espera (ON CONFLICT DO NOTHING).
-- La versión anterior (solo p_event_id) se reemplaza: con las dos firmas a la vez, llamar con un solo argumento sería ambiguo.
drop function if exists public.venue_event_open_tables(uuid);
-- Abre la venta de mesas de un evento: copia el mapa de la sala y crea una fila por mesa. Idempotente: volver a correrla NO pisa mesas vendidas,
-- apartadas ni en espera (ON CONFLICT DO NOTHING).
-- ÁREAS (p_maps): una sala puede tener varios planos (Sala principal, VIP, Terraza…). Normalmente se venden todos juntos (p_maps = null). Un plano marcado «siempre»: true
-- (una terraza pública, abierta siempre) entra en todo evento y no se puede cerrar. Para un evento especial
-- (p. ej. el VIP separado por una pared) se pasa la lista de planos que SÍ se venden: solo esos quedan en el evento. También sirve para cerrar o volver a abrir un área
-- después de abrir la venta: se quitan las mesas libres del área cerrada, pero si ya hay ventas, reservas o alguien pagando en ella se rechaza (area_con_ventas).
create or replace function public.venue_event_open_tables(p_event_id uuid, p_maps text[] default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id); v_layout jsonb; v_ev jsonb; v_room jsonb; n integer; v_total integer; v_unicas integer;
  v_id text; m jsonb; mt jsonb; v_tb jsonb; v_maps jsonb := '[]'::jsonb; v_tabs jsonb := '[]'::jsonb; v_keys text[]; v_desde_ev boolean; v_siempre text[];
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select e.layout, r.layout into v_ev, v_room from public.venue_events e join public.venue_rooms r on r.id = e.room_id where e.id = p_event_id for update of e;
  v_layout := case when v_ev ? 'tables' then v_ev else v_room end;
  if v_layout is null or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' or jsonb_array_length(v_layout -> 'tables') = 0 then
    raise exception 'sin_mapa';
  end if;

  if p_maps is not null then
    if coalesce(array_length(p_maps, 1), 0) not between 1 and 12 or (select count(distinct x) from unnest(p_maps) x) <> array_length(p_maps, 1) or array_position(p_maps, null) is not null then
      raise exception 'areas_invalidas';
    end if;
    -- Las áreas marcadas «siempre abiertas» (p. ej. una terraza pública) no se cierran: entran en todo evento aunque no se elijan.
    select coalesce(array_agg(x ->> 'id'), '{}') into v_siempre from jsonb_array_elements(case when jsonb_typeof(v_room -> 'maps') = 'array' then v_room -> 'maps' else '[]'::jsonb end) x
     where x ->> 'siempre' = 'true' and not ((x ->> 'id') = any (p_maps));
    p_maps := p_maps || v_siempre;
    foreach v_id in array p_maps loop
      m := null; v_desde_ev := false;
      select x into m from jsonb_array_elements(case when jsonb_typeof(v_ev -> 'maps') = 'array' then v_ev -> 'maps' else '[]'::jsonb end) x where x ->> 'id' = v_id limit 1;
      if m is not null then v_desde_ev := true; end if;
      if m is null then
        select x into m from jsonb_array_elements(case when jsonb_typeof(v_room -> 'maps') = 'array' then v_room -> 'maps' else '[]'::jsonb end) x where x ->> 'id' = v_id limit 1;
      end if;
      if m is null then raise exception 'areas_invalidas'; end if;
      v_maps := v_maps || jsonb_build_array(m);
      for v_tb in select * from jsonb_array_elements(case when jsonb_typeof(m -> 'tables') = 'array' then m -> 'tables' else '[]'::jsonb end) loop
        select x into mt from jsonb_array_elements(case when v_desde_ev then v_ev -> 'tables' else v_room -> 'tables' end) x where x ->> 'key' = v_tb ->> 'id' limit 1;
        if mt is not null then v_tabs := v_tabs || jsonb_build_array(mt); end if;
      end loop;
    end loop;
    if jsonb_array_length(v_tabs) = 0 then raise exception 'sin_mapa'; end if;
    v_layout := jsonb_set(jsonb_set(v_layout, '{maps}', v_maps), '{tables}', v_tabs);
    select coalesce(array_agg(x ->> 'key'), '{}') into v_keys from jsonb_array_elements(v_tabs) x;
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

-- ── 7. Lo que ve el público (sin sesión): qué mesas hay y cuáles están libres. Sin nombres ni estados internos. ──
create or replace function public.venue_event_tables_public(p_event_id uuid)
returns table (table_key text, label text, seats integer, zone_name text, price_cents integer, available boolean)
language sql stable security definer set search_path to 'public' as $$
  select t.table_key, t.label, t.seats, t.zone_name, t.price_cents,
         (t.status = 'available' or (t.status = 'held' and t.held_until < now())) as available
    from public.venue_event_tables t join public.venue_events e on e.id = t.event_id
   where t.event_id = p_event_id and e.tables_open and e.status = 'announced'
   order by t.table_key;
$$;

-- ── 8. Reserva temporal al pasar a pagar (la usa la Edge Function de pago; NO el navegador) ───────────────────────────
-- Igual que Ticketmaster (investigado 2026-10-03; ver el ticket §3g): las mesas que se ELIGEN en el plano NO quedan reservadas; el
-- reloj de la reserva arranca cuando el cliente pulsa «Comprar» («Get Tickets»). Entonces:
--  · Todo o nada: si UNA mesa ya no está libre, no se toma NINGUNA y el cliente vuelve al plano con el aviso.
--  · Una reserva vencida cuenta como libre en la misma consulta que la reclama (vencimiento «perezoso»: la corrección no depende de que
--    corra ninguna limpieza).
--  · Duración: p_minutes (por defecto 35). Stripe no admite sesiones de pago de menos de 30 min: la sesión vence a los ~31 y la reserva a
--    los 35, así una sesión pagada siempre encuentra su reserva viva. (Decisión del PO: ver ticket §3g.)
--  · Tope por IP: una misma IP no puede tener más de 12 mesas apartadas a la vez (contra quien quiera acaparar la sala).
create or replace function public.venue_event_hold_tables(p_event_id uuid, p_keys text[], p_hold_token uuid default null,
                                                         p_minutes integer default 35, p_ip text default null)
returns table (hold_token uuid, held_until timestamptz, total_cents integer, keys text[])
language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
declare v_token uuid := coalesce(p_hold_token, gen_random_uuid()); v_until timestamptz;
        v_keys text[]; n integer; v_ip_held integer;
begin
  select array_agg(distinct k) into v_keys from unnest(p_keys) k where k is not null and k <> '';
  if v_keys is null or cardinality(v_keys) = 0 then raise exception 'sin_mesas'; end if;
  if cardinality(v_keys) > 12 then raise exception 'demasiadas_mesas'; end if;
  perform 1 from public.venue_events e
    where e.id = p_event_id and e.tables_open and e.status = 'announced' and (e.event_date is null or e.event_date >= current_date);
  if not found then raise exception 'evento_sin_venta_de_mesas'; end if;
  v_until := now() + make_interval(mins => least(greatest(coalesce(p_minutes, 35), 1), 60));
  if p_ip is not null then                         -- tope de mesas apartadas por IP (las de otros tokens)
    select count(*) into v_ip_held from public.venue_event_tables t
     where t.hold_ip = p_ip and t.status = 'held' and t.held_until > now() and t.hold_token is distinct from v_token;
    if v_ip_held + cardinality(v_keys) > 12 then raise exception 'demasiados_apartados'; end if;
  end if;
  -- suelta lo que este mismo token tenía y ya no pide
  update public.venue_event_tables set status = 'available', held_until = null, hold_token = null, hold_ip = null, updated_at = now()
   where event_id = p_event_id and hold_token = v_token and status = 'held' and table_key <> all (v_keys);
  -- toma las pedidas: libres, con espera vencida, o ya en espera de este mismo token
  update public.venue_event_tables set status = 'held', held_until = v_until, hold_token = v_token, hold_ip = p_ip, updated_at = now()
   where event_id = p_event_id and table_key = any (v_keys)
     and (status = 'available' or (status = 'held' and (held_until < now() or hold_token = v_token)));
  get diagnostics n = row_count;
  if n <> cardinality(v_keys) then raise exception 'mesa_no_disponible'; end if;
  return query select v_token, v_until,
    (select sum(t.price_cents)::integer from public.venue_event_tables t where t.event_id = p_event_id and t.table_key = any (v_keys)), v_keys;
end $$;

create or replace function public.venue_event_release_tables(p_hold_token uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  update public.venue_event_tables set status = 'available', held_until = null, hold_token = null, hold_ip = null, updated_at = now()
   where hold_token = p_hold_token and status = 'held';
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 9. Confirmar la venta tras el pago (la usa el webhook de Stripe) ────────────────────
-- Devuelve cuántas mesas quedaron vendidas; si es MENOS que las pagadas (alguien tomó una mesa tras vencer la espera), el
-- webhook debe marcar el pedido para reembolso manual. El nombre de quien renta es lo único obligatorio.
create or replace function public.venue_event_confirm_tables(p_hold_token uuid, p_order_id uuid, p_buyer_name text, p_reservation_name text default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  if coalesce(btrim(p_buyer_name), '') = '' then raise exception 'falta_nombre_de_quien_renta'; end if;
  update public.venue_event_tables
     set status = 'sold', sold_via = 'online', held_until = null, hold_token = null, hold_ip = null,
         buyer_name = btrim(p_buyer_name), reservation_name = coalesce(nullif(btrim(p_reservation_name), ''), btrim(p_buyer_name)),
         order_id = p_order_id, updated_at = now()
   where hold_token = p_hold_token and status = 'held';
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 10. El staff del local aparta, vende a mano o libera (dueño, manager y equipo) ─────
create or replace function public.venue_staff_set_table(p_event_id uuid, p_key text, p_action text, p_name text default null, p_note text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid := public.venue_event_venue_id(p_event_id); r public.venue_event_tables%rowtype; v_libre boolean;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue)) then raise exception 'no_autorizado'; end if;
  select * into r from public.venue_event_tables where event_id = p_event_id and table_key = p_key for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  v_libre := r.status = 'available' or (r.status = 'held' and r.held_until < now());
  if p_action = 'reserve' then            -- apartar (se ve «reservada» para el público)
    if not (v_libre or r.status = 'reserved') then raise exception 'mesa_no_disponible'; end if;
    update public.venue_event_tables set status = 'reserved', held_until = null, hold_token = null, hold_ip = null, buyer_name = nullif(btrim(p_name), ''),
           reservation_name = nullif(btrim(p_name), ''), note = p_note, sold_via = null, updated_at = now() where id = r.id;
    return 'reserved';
  elsif p_action = 'sell' then            -- vendida a mano (efectivo u otro): exige el nombre de quien renta
    if coalesce(btrim(p_name), '') = '' then raise exception 'falta_nombre_de_quien_renta'; end if;
    if not (v_libre or r.status = 'reserved') then raise exception 'mesa_no_disponible'; end if;
    update public.venue_event_tables set status = 'sold', sold_via = 'manager', held_until = null, hold_token = null, hold_ip = null, buyer_name = btrim(p_name),
           reservation_name = btrim(p_name), note = p_note, updated_at = now() where id = r.id;
    return 'sold';
  elsif p_action = 'release' then         -- volver a disponible
    if r.status = 'sold' and r.sold_via = 'online' then raise exception 'vendida_en_linea_requiere_reembolso'; end if;
    update public.venue_event_tables set status = 'available', held_until = null, hold_token = null, hold_ip = null, buyer_name = null, reservation_name = null,
           note = null, sold_via = null, order_id = null, updated_at = now() where id = r.id;
    return 'available';
  end if;
  raise exception 'accion_invalida';
end $$;

-- ── 11. Permisos de ejecución: cada función solo para quien debe ─────────────────────────
revoke all on function public.venue_event_venue_id(uuid) from public, anon, authenticated;
grant execute on function public.venue_event_venue_id(uuid) to authenticated, service_role;     -- la usa la política RLS

revoke all on function public.venue_room_set_layout(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_room_set_layout(uuid, jsonb) to authenticated;

revoke all on function public.venue_event_open_tables(uuid, text[]) from public, anon, authenticated;
grant execute on function public.venue_event_open_tables(uuid, text[]) to authenticated;

revoke all on function public.venue_event_tables_public(uuid) from public, anon, authenticated;
grant execute on function public.venue_event_tables_public(uuid) to anon, authenticated;

revoke all on function public.venue_staff_set_table(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.venue_staff_set_table(uuid, text, text, text, text) to authenticated;

-- Reserva temporal / liberar / confirmar: SOLO las Edge Functions (service_role). El navegador nunca las llama directo
-- (así nadie puede acaparar mesas desde la consola: el límite por IP vive en la Edge Function de pago).
revoke all on function public.venue_event_hold_tables(uuid, text[], uuid, integer, text) from public, anon, authenticated;
grant execute on function public.venue_event_hold_tables(uuid, text[], uuid, integer, text) to service_role;
revoke all on function public.venue_event_release_tables(uuid) from public, anon, authenticated;
grant execute on function public.venue_event_release_tables(uuid) to service_role;
revoke all on function public.venue_event_confirm_tables(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.venue_event_confirm_tables(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
