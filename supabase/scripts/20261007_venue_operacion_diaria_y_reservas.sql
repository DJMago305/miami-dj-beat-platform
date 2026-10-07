-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · OPERACIÓN DIARIA + RESERVA DIRECTA CON HORA LÍMITE (pedido del PO 2026-10-07):
--   «El local opera mesas todos los días, incluso sin conciertos de paga (grupos grandes, VIPs, familiares): hay que controlar la hora de llegada y liberar la mesa si no se presentan.»
-- Requiere 20261006_venue_ticket_guests.sql, 20261003_sala_mesas_inventario_por_evento.sql, 20261007_venue_venta_manual_mesas.sql y 20261007_venue_autorizaciones_del_owner.sql ya aplicados.
--
-- Qué hace:
--   1) Un tipo nuevo de evento: status 'operation' = «Operación de hoy». Es un evento interno: la sala pública NUNCA lo muestra ni se puede comprar en línea
--      (venue_event_tables_public y la compra solo miran eventos 'announced'). Sirve de contenedor del día para apartar y vender mesas sin concierto.
--   2) venue_open_day(sala): crea (o devuelve) la «Operación de hoy» del día de negocio (6:00–6:00, hora de Miami) con una copia del plano de la sala.
--      Idempotente y a prueba de dos clics a la vez. Lo puede pedir quien vende o quien diseña la sala (no cambia nada de la plantilla).
--   3) venue_staff_reserve_table(evento, mesa, titular, teléfono, personas, hora límite, tipo, nota): RESERVA DIRECTA, todo o nada:
--        · la mesa queda 'reserved' (apartada; la sala pública la ve «RESERVADA») con la hora límite en venue_event_tables.arrive_by;
--        · crea la orden (status 'reserved_manual') y emite los pases QR SOLO de las personas indicadas (≤ sillas de la mesa), listos para compartir;
--        · tipo: 'courtesy' (cortesía / familiar), 'min_spend' (consumo mínimo) o 'door' (cobro en puerta). Cortesía: saldo 0; los otros dos: el precio de lista queda por cobrar.
--      (No se usa status 'held': ese es la espera del pago en línea y se libera sola al vencer; una reserva debe esperar al personal.)
--   4) venue_event_table_arrivals(evento): por mesa con orden, cuántos pases hay y cuántos ya ingresaron (para la alerta «Tolerancia vencida»; el equipo no ve nombres ni contactos).
--   5) Liberar una mesa (venue_staff_set_table): ahora también ANULA los pases de una reserva con orden (si alguien ya ingresó: 'mesa_con_ingresos') y borra la hora límite.
--      Vender a mano una mesa que tenía reserva con orden: si nadie ha ingresado, la reserva se cancela y se crea la venta; si ya hay gente adentro, se avisa ('mesa_con_ingresos').
--   6) El método de pago 'min_spend' (consumo mínimo) se admite en las órdenes.
-- No toca Stripe, ni el correo, ni las ventas en línea, ni la plantilla de la sala.

alter table public.venue_events drop constraint if exists venue_events_status_check;
alter table public.venue_events add constraint venue_events_status_check
  check (status in ('waitlist', 'announced', 'sold_out', 'completed', 'cancelled', 'operation'));

alter table public.venue_event_tables add column if not exists arrive_by timestamptz;

alter table public.venue_ticket_orders drop constraint if exists venue_ticket_orders_payment_method_check;
alter table public.venue_ticket_orders add constraint venue_ticket_orders_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'zelle', 'card_terminal', 'door', 'courtesy', 'min_spend'));

-- Anula los pases de UNA mesa dentro de una orden (reserva o venta a mano); si ya no queda ningún pase activo, cancela la orden. Interna: nadie la llama desde el navegador.
create or replace function public.venue_cancel_table_order(p_order_id uuid, p_table_key text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_order_id is null then return; end if;
  if exists (select 1 from public.venue_ticket_guests g where g.order_id = p_order_id and g.table_key = p_table_key and g.status = 'checked_in') then raise exception 'mesa_con_ingresos'; end if;
  update public.venue_ticket_guests set status = 'void' where order_id = p_order_id and table_key = p_table_key and status = 'issued';
  if not exists (select 1 from public.venue_ticket_guests g where g.order_id = p_order_id and g.status <> 'void') then
    update public.venue_ticket_orders set status = 'cancelled_manual' where id = p_order_id;
  end if;
end $$;
revoke all on function public.venue_cancel_table_order(uuid, text) from public, anon, authenticated;

create or replace function public.venue_open_day(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid; v_layout jsonb; v_day date := public.venue_business_day(); v_ev uuid; v_total integer; v_unicas integer;
begin
  select r.venue_id, r.layout into v_venue, v_layout from public.venue_rooms r where r.id = p_room_id and coalesce(r.active, true);
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  perform pg_advisory_xact_lock(hashtext('open_day:' || p_room_id::text || v_day::text));            -- dos clics a la vez no crean dos operaciones
  select e.id into v_ev from public.venue_events e where e.room_id = p_room_id and e.status = 'operation' and e.event_date = v_day limit 1;
  if v_ev is not null then return jsonb_build_object('ok', true, 'event_id', v_ev, 'created', false); end if;
  if v_layout is null or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' or jsonb_array_length(v_layout -> 'tables') = 0 then raise exception 'sin_mapa'; end if;
  select count(*), count(distinct t ->> 'key') into v_total, v_unicas from jsonb_array_elements(v_layout -> 'tables') t;
  if v_unicas <> v_total or exists (select 1 from jsonb_array_elements(v_layout -> 'tables') t where coalesce(t ->> 'key', '') = '' or (t ->> 'price_cents') is null) then raise exception 'mapa_invalido'; end if;
  insert into public.venue_events (room_id, title, event_date, status, tables_open, layout) values (p_room_id, 'Operación de hoy', v_day, 'operation', true, v_layout) returning id into v_ev;
  insert into public.venue_event_tables (event_id, table_key, label, seats, zone_name, price_cents)
    select v_ev, t ->> 'key', coalesce(nullif(t ->> 'label', ''), t ->> 'key'), coalesce((t ->> 'seats')::integer, 4), t ->> 'zone', (t ->> 'price_cents')::integer
      from jsonb_array_elements(v_layout -> 'tables') t
    on conflict (event_id, table_key) do nothing;
  return jsonb_build_object('ok', true, 'event_id', v_ev, 'created', true);
end $$;
revoke all on function public.venue_open_day(uuid) from public, anon, authenticated;
grant execute on function public.venue_open_day(uuid) to authenticated;

create or replace function public.venue_staff_reserve_table(
  p_event_id uuid, p_key text, p_name text, p_phone text, p_people integer, p_arrive_time text, p_kind text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id);
  v_name text := nullif(btrim(p_name), ''); v_phone text := nullif(btrim(p_phone), ''); v_note text := left(nullif(btrim(p_note), ''), 200);
  v_date date; v_status text; r public.venue_event_tables%rowtype; v_ts timestamptz; v_time time; v_order uuid; v_due integer; v_label text; v_tipo text;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue)) then raise exception 'no_autorizado'; end if;
  if v_name is null or length(v_name) > 80 then return jsonb_build_object('ok', false, 'error', 'falta_nombre_de_quien_renta'); end if;
  if v_phone is not null and (length(v_phone) > 30 or v_phone !~ '^[0-9+()\-\s.]{7,30}$') then return jsonb_build_object('ok', false, 'error', 'telefono_invalido'); end if;
  if p_kind is null or p_kind not in ('courtesy', 'min_spend', 'door') then return jsonb_build_object('ok', false, 'error', 'tipo_invalido'); end if;
  if p_arrive_time is null or p_arrive_time !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then return jsonb_build_object('ok', false, 'error', 'hora_invalida'); end if;
  select e.event_date, e.status into v_date, v_status from public.venue_events e where e.id = p_event_id;
  if v_date is null or v_status = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'evento_sin_fecha'); end if;
  v_time := p_arrive_time::time;
  v_ts := ((v_date + v_time) + case when v_time < time '06:00' then interval '1 day' else interval '0' end) at time zone 'America/New_York';   -- de 12:00 a 5:59 a. m. es ya la madrugada siguiente
  if v_ts < now() - interval '2 minutes' then return jsonb_build_object('ok', false, 'error', 'hora_pasada'); end if;

  select * into r from public.venue_event_tables where event_id = p_event_id and table_key = p_key for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  if not (r.status = 'available' or (r.status = 'held' and r.held_until < now())) then raise exception 'mesa_no_disponible'; end if;
  if p_people is null or p_people < 1 or p_people > r.seats then return jsonb_build_object('ok', false, 'error', 'personas_invalidas', 'max', r.seats); end if;

  v_due := case when p_kind = 'courtesy' then 0 else r.price_cents end;
  v_label := 'Mesa ' || r.label || coalesce(' · ' || nullif(r.zone_name, ''), '');
  v_tipo := case p_kind when 'courtesy' then 'Cortesía / familiar' when 'min_spend' then 'Consumo mínimo' else 'Cobro en puerta' end;
  insert into public.venue_ticket_orders (event_id, kind, items, customer_name, customer_phone, reservation_name, subtotal_cents, total_cents, currency, status,
                                          payment_method, balance_due_cents, manual_note, created_by)
  values (p_event_id, 'tables', jsonb_build_array(jsonb_build_object('id', r.table_key, 'label', v_label, 'qty', 1, 'price_cents', r.price_cents)),
          v_name, v_phone, v_name, r.price_cents, 0, 'usd', 'reserved_manual', p_kind, v_due, v_note, auth.uid())
  returning id into v_order;

  update public.venue_event_tables
     set status = 'reserved', held_until = null, hold_token = null, hold_ip = null, buyer_name = v_name, reservation_name = v_name, sold_via = null,
         note = v_tipo || ' · ' || p_people || ' personas · llega antes de ' || p_arrive_time || coalesce(' · ' || v_note, ''), order_id = v_order, arrive_by = v_ts, updated_at = now()
   where id = r.id;

  perform public.venue_ticket_issue_guests(v_order);                                                    -- un pase por silla…
  delete from public.venue_ticket_guests where order_id = v_order and seat_no > p_people;               -- …y solo quedan los de las personas que vienen (nada compartido todavía)
  return jsonb_build_object('ok', true, 'order_id', v_order, 'code', upper(left(v_order::text, 8)), 'passes', p_people, 'arrive_by', v_ts, 'kind', p_kind, 'balance_due_cents', v_due);
end $$;
revoke all on function public.venue_staff_reserve_table(uuid, text, text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.venue_staff_reserve_table(uuid, text, text, text, integer, text, text, text) to authenticated;

create or replace function public.venue_event_table_arrivals(p_event_id uuid)
returns table (table_key text, passes integer, inside integer) language plpgsql stable security definer set search_path to 'public' as $$
declare v_venue uuid := public.venue_event_venue_id(p_event_id);
begin
  if v_venue is null then return; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  return query
    select t.table_key, (count(g.id) filter (where g.status <> 'void'))::integer, (count(g.id) filter (where g.status = 'checked_in'))::integer
      from public.venue_event_tables t
      join public.venue_ticket_guests g on g.order_id = t.order_id and g.table_key = t.table_key
     where t.event_id = p_event_id and t.order_id is not null
     group by t.table_key;
end $$;
revoke all on function public.venue_event_table_arrivals(uuid) from public, anon, authenticated;
grant execute on function public.venue_event_table_arrivals(uuid) to authenticated;

-- Liberar / vender: misma función de siempre, con la reserva con orden contemplada.
create or replace function public.venue_staff_set_table(p_event_id uuid, p_key text, p_action text, p_name text default null, p_note text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid := public.venue_event_venue_id(p_event_id); r public.venue_event_tables%rowtype; v_libre boolean;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue)) then raise exception 'no_autorizado'; end if;
  select * into r from public.venue_event_tables where event_id = p_event_id and table_key = p_key for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  v_libre := r.status = 'available' or (r.status = 'held' and r.held_until < now());
  if p_action = 'reserve' then            -- apartar rápido, sin orden (se ve «reservada» para el público)
    if not (v_libre or r.status = 'reserved') then raise exception 'mesa_no_disponible'; end if;
    update public.venue_event_tables set status = 'reserved', held_until = null, hold_token = null, hold_ip = null, buyer_name = nullif(btrim(p_name), ''),
           reservation_name = nullif(btrim(p_name), ''), note = p_note, sold_via = null, updated_at = now() where id = r.id;
    return 'reserved';
  elsif p_action = 'sell' then            -- vendida a mano sin orden (la pantalla ya usa venue_staff_sell_tables_manual; queda por compatibilidad)
    if coalesce(btrim(p_name), '') = '' then raise exception 'falta_nombre_de_quien_renta'; end if;
    if not (v_libre or r.status = 'reserved') then raise exception 'mesa_no_disponible'; end if;
    if r.order_id is not null then perform public.venue_cancel_table_order(r.order_id, r.table_key); end if;
    update public.venue_event_tables set status = 'sold', sold_via = 'manager', held_until = null, hold_token = null, hold_ip = null, buyer_name = btrim(p_name),
           reservation_name = btrim(p_name), note = p_note, order_id = null, arrive_by = null, updated_at = now() where id = r.id;
    return 'sold';
  elsif p_action = 'release' then         -- volver a disponible
    if r.status = 'sold' and r.sold_via = 'online' then raise exception 'vendida_en_linea_requiere_reembolso'; end if;
    if r.order_id is not null and r.sold_via is distinct from 'online' then perform public.venue_cancel_table_order(r.order_id, r.table_key); end if;
    update public.venue_event_tables set status = 'available', held_until = null, hold_token = null, hold_ip = null, buyer_name = null, reservation_name = null,
           note = null, sold_via = null, order_id = null, arrive_by = null, updated_at = now() where id = r.id;
    return 'available';
  end if;
  raise exception 'accion_invalida';
end $$;

-- Venta manual: si alguna mesa elegida tenía una reserva con orden, se cancela esa reserva (si nadie ha ingresado) y se crea la venta.
create or replace function public.venue_staff_sell_tables_manual(
  p_event_id uuid, p_keys text[], p_holder_name text, p_phone text, p_email text, p_method text, p_amount_cents integer, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id);
  v_name  text := nullif(btrim(p_holder_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(lower(btrim(p_email)), '');
  v_note  text := left(nullif(btrim(p_note), ''), 200);
  r public.venue_event_tables%rowtype;
  k text; v_items jsonb := '[]'::jsonb; v_list integer := 0; v_total integer; v_due integer; v_status text; v_order uuid; v_passes integer; n integer := 0;
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_keys is null or coalesce(array_length(p_keys, 1), 0) < 1 or array_length(p_keys, 1) > 40
     or (select count(distinct x) from unnest(p_keys) x) <> array_length(p_keys, 1) then return jsonb_build_object('ok', false, 'error', 'grupo_invalido'); end if;
  if v_name is null or length(v_name) > 80 then return jsonb_build_object('ok', false, 'error', 'falta_nombre_de_quien_renta'); end if;
  if v_phone is not null and (length(v_phone) > 30 or v_phone !~ '^[0-9+()\-\s.]{7,30}$') then return jsonb_build_object('ok', false, 'error', 'telefono_invalido'); end if;
  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then return jsonb_build_object('ok', false, 'error', 'correo_invalido'); end if;
  if p_method is null or p_method not in ('cash', 'zelle', 'card_terminal', 'door', 'courtesy') then return jsonb_build_object('ok', false, 'error', 'metodo_invalido'); end if;
  if p_amount_cents is null or p_amount_cents < 0 or p_amount_cents > 100000000 then return jsonb_build_object('ok', false, 'error', 'importe_invalido'); end if;
  if p_method in ('door', 'courtesy') and p_amount_cents <> 0 then return jsonb_build_object('ok', false, 'error', 'importe_invalido'); end if;
  if p_method in ('cash', 'zelle', 'card_terminal') and p_amount_cents = 0 then return jsonb_build_object('ok', false, 'error', 'importe_invalido'); end if;

  for k in select x from unnest(p_keys) x order by x loop
    select * into r from public.venue_event_tables where event_id = p_event_id and table_key = k for update;
    if not found then raise exception 'mesa_no_existe'; end if;
    if not (r.status = 'available' or (r.status = 'held' and r.held_until < now()) or r.status = 'reserved') then raise exception 'mesa_no_disponible'; end if;
    if r.order_id is not null then perform public.venue_cancel_table_order(r.order_id, r.table_key); end if;      -- reserva con orden: se cancela (si ya hay gente adentro, mesa_con_ingresos y no se toca nada)
    v_items := v_items || jsonb_build_array(jsonb_build_object('id', r.table_key, 'label', 'Mesa ' || r.label || coalesce(' · ' || nullif(r.zone_name, ''), ''), 'qty', 1, 'price_cents', r.price_cents));
    v_list := v_list + r.price_cents;
  end loop;

  if p_method = 'door' then v_total := 0; v_due := v_list; v_status := 'manual_pending_payment';
  elsif p_method = 'courtesy' then v_total := 0; v_due := 0; v_status := 'comp_manual';
  else v_total := p_amount_cents; v_due := greatest(v_list - p_amount_cents, 0); v_status := 'paid_manual'; end if;

  insert into public.venue_ticket_orders (event_id, kind, items, customer_name, customer_email, customer_phone, reservation_name, subtotal_cents, total_cents, currency, status,
                                          payment_method, balance_due_cents, manual_note, created_by)
  values (p_event_id, 'tables', v_items, v_name, v_email, v_phone, v_name, v_list, v_total, 'usd', v_status, p_method, v_due, v_note, auth.uid())
  returning id into v_order;

  update public.venue_event_tables
     set status = 'sold', sold_via = 'manager', held_until = null, hold_token = null, hold_ip = null, buyer_name = v_name, reservation_name = v_name,
         note = coalesce(v_note, note), order_id = v_order, arrive_by = null, updated_at = now()
   where event_id = p_event_id and table_key = any (p_keys);
  get diagnostics n = row_count;

  v_passes := public.venue_ticket_issue_guests(v_order);
  return jsonb_build_object('ok', true, 'order_id', v_order, 'code', upper(left(v_order::text, 8)), 'tables', n, 'passes', v_passes, 'status', v_status,
                            'list_cents', v_list, 'paid_cents', v_total, 'balance_due_cents', v_due);
end $$;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: estado_operation=true, columna_arrive_by=true, abrir_dia/reservar/llegadas=true, las tres _anon=false, liberar_usa_cancelar=true ──
select
  (select pg_get_constraintdef(oid) like '%operation%' from pg_constraint where conname = 'venue_events_status_check')                                                          as estado_operation,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'venue_event_tables' and column_name = 'arrive_by')                           as columna_arrive_by,
  (to_regprocedure('public.venue_open_day(uuid)') is not null)                                                                                                                  as abrir_dia,
  (to_regprocedure('public.venue_staff_reserve_table(uuid,text,text,text,integer,text,text,text)') is not null)                                                                 as reservar,
  (to_regprocedure('public.venue_event_table_arrivals(uuid)') is not null)                                                                                                      as llegadas,
  has_function_privilege('anon', 'public.venue_open_day(uuid)', 'execute')                                                                                                      as abrir_dia_anon,
  has_function_privilege('anon', 'public.venue_staff_reserve_table(uuid,text,text,text,integer,text,text,text)', 'execute')                                                     as reservar_anon,
  has_function_privilege('anon', 'public.venue_event_table_arrivals(uuid)', 'execute')                                                                                          as llegadas_anon,
  (select position('venue_cancel_table_order' in prosrc) > 0 from pg_proc where proname = 'venue_staff_set_table' and pronamespace = 'public'::regnamespace)                   as liberar_usa_cancelar;
