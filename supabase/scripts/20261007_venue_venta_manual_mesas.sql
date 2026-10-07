-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · «+ Reserva telefónica / Venta manual» (taquilla): vender una o varias mesas por teléfono o en persona y emitir al instante los pases QR individuales.
-- Requiere 20261006_venue_ticket_guests.sql (venue_ticket_guests + venue_ticket_issue_guests) y 20261003_sala_mesas_inventario_por_evento.sql ya aplicados.
--
-- Qué hace:
--   1) venue_ticket_orders gana 4 columnas (todas opcionales; las órdenes existentes no cambian): payment_method, balance_due_cents, manual_note, created_by.
--   2) venue_staff_sell_tables_manual(evento, mesas[], nombre, teléfono, correo, método, importe, nota) — TODO O NADA, en una sola transacción:
--        · crea la ORDEN (kind='tables') con las mesas como artículos (mismo formato que las compras en línea), a nombre del titular;
--        · marca las mesas como vendidas a mano (sold_via='manager') y las enlaza a la orden;
--        · emite los pases individuales (venue_ticket_issue_guests): un QR por silla, listo para compartir (la cartera es /t/<id de la orden>).
--      Métodos: 'cash' (efectivo), 'zelle', 'card_terminal' (terminal física) → status 'paid_manual', total_cents = lo cobrado, balance_due = lista − cobrado;
--               'door' (por cobrar en puerta) → status 'manual_pending_payment', total_cents = 0, balance_due = precio de lista;
--               'courtesy' (cortesía) → status 'comp_manual', total_cents = 0.
--      Solo el nombre de quien renta es obligatorio (teléfono y correo, si se dan, se validan). Quién puede: dueño, manager y equipo del local (can_sell_venue) y admin de la plataforma.
--      Mesas libres, con espera vencida o apartadas (si no, 'mesa_no_disponible' y no se toca ninguna).
--   3) venue_staff_set_table (liberar): si la mesa se vendió con esta función, liberarla ANULA los pases de esa mesa (y la orden si ya no queda ninguno); si alguien de esa mesa
--      ya ingresó, no se puede liberar ('mesa_con_ingresos'). Antes de esto una venta a mano no tenía pases, así que no había nada que anular. El resto de la función queda igual.
--   No toca Stripe, ni el correo, ni ninguna venta en línea. Nada de esto entra a Cash Flow por sí solo.

alter table public.venue_ticket_orders add column if not exists payment_method text;
alter table public.venue_ticket_orders add column if not exists balance_due_cents integer not null default 0;
alter table public.venue_ticket_orders add column if not exists manual_note text;
alter table public.venue_ticket_orders add column if not exists created_by uuid;
alter table public.venue_ticket_orders drop constraint if exists venue_ticket_orders_payment_method_check;
alter table public.venue_ticket_orders add constraint venue_ticket_orders_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'zelle', 'card_terminal', 'door', 'courtesy'));

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

  for k in select x from unnest(p_keys) x order by x loop                                             -- en orden: dos ventas a la vez no se traban entre sí
    select * into r from public.venue_event_tables where event_id = p_event_id and table_key = k for update;
    if not found then raise exception 'mesa_no_existe'; end if;
    if not (r.status = 'available' or (r.status = 'held' and r.held_until < now()) or r.status = 'reserved') then raise exception 'mesa_no_disponible'; end if;
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
         note = coalesce(v_note, note), order_id = v_order, updated_at = now()
   where event_id = p_event_id and table_key = any (p_keys);
  get diagnostics n = row_count;

  v_passes := public.venue_ticket_issue_guests(v_order);                                               -- un QR por silla, ya con el nombre del titular en el pase 1
  return jsonb_build_object('ok', true, 'order_id', v_order, 'code', upper(left(v_order::text, 8)), 'tables', n, 'passes', v_passes, 'status', v_status,
                            'list_cents', v_list, 'paid_cents', v_total, 'balance_due_cents', v_due);
end $$;

-- Liberar una mesa vendida a mano CON orden: se anulan sus pases (misma función de siempre, solo cambia la rama «release»).
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
    if r.order_id is not null and r.sold_via = 'manager' then
      if exists (select 1 from public.venue_ticket_guests g where g.order_id = r.order_id and g.table_key = r.table_key and g.status = 'checked_in') then raise exception 'mesa_con_ingresos'; end if;
      update public.venue_ticket_guests set status = 'void' where order_id = r.order_id and table_key = r.table_key and status = 'issued';
      if not exists (select 1 from public.venue_ticket_guests g where g.order_id = r.order_id and g.status <> 'void') then
        update public.venue_ticket_orders set status = 'cancelled_manual' where id = r.order_id;
      end if;
    end if;
    update public.venue_event_tables set status = 'available', held_until = null, hold_token = null, hold_ip = null, buyer_name = null, reservation_name = null,
           note = null, sold_via = null, order_id = null, updated_at = now() where id = r.id;
    return 'available';
  end if;
  raise exception 'accion_invalida';
end $$;

revoke all on function public.venue_staff_sell_tables_manual(uuid, text[], text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.venue_staff_sell_tables_manual(uuid, text[], text, text, text, text, integer, text) to authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura): esperado venta_manual=true, venta_anon=false, venta_auth=true, liberar_anula_pases=true, 4 columnas nuevas ──
select
  (to_regprocedure('public.venue_staff_sell_tables_manual(uuid,text[],text,text,text,text,integer,text)') is not null)                  as venta_manual,
  has_function_privilege('anon', 'public.venue_staff_sell_tables_manual(uuid,text[],text,text,text,text,integer,text)', 'execute')       as venta_anon,
  has_function_privilege('authenticated', 'public.venue_staff_sell_tables_manual(uuid,text[],text,text,text,text,integer,text)', 'execute') as venta_auth,
  (select position('mesa_con_ingresos' in prosrc) > 0 from pg_proc where proname = 'venue_staff_set_table' and pronamespace = 'public'::regnamespace) as liberar_anula_pases,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'venue_ticket_orders'
      and column_name in ('payment_method', 'balance_due_cents', 'manual_note', 'created_by'))                                          as columnas_nuevas;
