-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Fase 2 (PR 1/2) de la boletería: UN pase con QR propio por persona o asiento.
--
-- Qué agrega (aditivo e idempotente: volver a correrlo no duplica ni rompe nada):
--   1) Tabla venue_ticket_guests: una fila por entrada vendida o por asiento de mesa. Su id (uuid) ES el QR: https://www.miamidjbeat.com/t/<id>.
--      Estados: 'issued' (listo para entrar) · 'checked_in' (ya ingresó) · 'void' (anulado). RLS: solo LECTURA para is_staff y para el personal de ese local.
--   2) venue_ticket_issue_guests(order_id): crea los pases de una orden. Idempotente (restricción única order_id+seq; si ya hay pases no hace nada).
--      Entradas → una fila por unidad comprada. Mesas → una fila por asiento (venue_event_tables.seats). El pase 1 hereda los datos del comprador.
--      No emite nada para órdenes anuladas/reembolsadas/en conflicto. Solo la ejecuta el servicio (webhook) y, por dentro, venue_order_wallet.
--   3) venue_guest_pass(pass_id): ficha PÚBLICA de un pase (evento, fecha, sala, etiqueta, titular enmascarado, estado). Nunca da correo, teléfono ni la orden.
--   4) venue_order_wallet(order_id): «cartera» del comprador: todos los pases de su compra (con el nombre que se les asignó). Emite los pases si aún no existen.
--   5) venue_guest_set_info(...): el comprador (con el id de la orden) o el portador de un pase (con el id del pase) asigna nombre, teléfono y correo. Solo si el pase sigue 'issued'.
--   6) venue_ticket_scan: se AMPLÍA para que el escáner de la puerta (sin cambiar su pantalla) lea también el id de un PASE. Un solo UPDATE atómico por pase:
--      dos escaneos a la vez no pasan los dos. El QR de la ORDEN sigue funcionando: admite el siguiente pase pendiente. Contadores de la orden siempre sincronizados.
--   7) venue_ticket_scan_logs.guest_id: el registro de escaneos guarda también el pase.
--
-- ⚠️ Punto 6 es un cambio sobre una función que ya está en producción: sin él, el QR de cada pase no se podría validar en la puerta hasta el PR 2/2.
-- Sin el PR de pantallas desplegado nada cambia para el público: las órdenes antiguas (sin pases) siguen por el contador de siempre.

-- ── 1) Tabla de pases ──
create table if not exists public.venue_ticket_guests (
  id             uuid primary key default gen_random_uuid(),            -- = el QR
  order_id       uuid not null references public.venue_ticket_orders(id) on delete cascade,
  event_id       uuid references public.venue_events(id),
  seq            integer not null,
  kind           text not null check (kind in ('ticket', 'seat')),
  label          text not null,
  table_key      text,
  seat_no        integer,
  ticket_type_id uuid references public.venue_ticket_types(id),
  guest_name     text,
  guest_phone    text,
  guest_email    text,
  status         text not null default 'issued' check (status in ('issued', 'checked_in', 'void')),
  checked_in_at  timestamptz,
  checked_in_by  uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (order_id, seq)
);

create index if not exists venue_ticket_guests_event_idx on public.venue_ticket_guests (event_id, status);
create index if not exists venue_ticket_guests_order_idx on public.venue_ticket_guests (order_id);

alter table public.venue_ticket_guests enable row level security;
revoke all on table public.venue_ticket_guests from public, anon;
revoke insert, update, delete on table public.venue_ticket_guests from authenticated;
grant select on table public.venue_ticket_guests to authenticated;

drop policy if exists venue_ticket_guests_staff_read on public.venue_ticket_guests;
create policy venue_ticket_guests_staff_read
  on public.venue_ticket_guests
  for select
  to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1
        from public.venue_events e
        join public.venue_rooms r on r.id = e.room_id
        join public.venue_staff vs on vs.venue_id = r.venue_id
       where e.id = venue_ticket_guests.event_id
         and vs.user_id = auth.uid()
    )
  );

-- ── 7) El registro de escaneos guarda también el pase ──
alter table public.venue_ticket_scan_logs
  add column if not exists guest_id uuid references public.venue_ticket_guests(id) on delete set null;

-- ── 2) Emisión de pases (idempotente) ──
create or replace function public.venue_ticket_issue_guests(p_order_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  o         public.venue_ticket_orders%rowtype;
  it        jsonb;
  v_qty     integer;
  v_seq     integer := 0;
  v_n       integer;
  k         integer;
  v_seats   integer;
  v_key     text;
  v_label   text;
  v_type    uuid;
  v_existing integer;
begin
  select * into o from public.venue_ticket_orders where id = p_order_id for update;
  if not found then
    return 0;
  end if;
  if o.status like 'cancelled%' or o.status like '%refund%' or o.status like '%conflict%' then
    return 0;
  end if;

  select count(*) into v_existing from public.venue_ticket_guests where order_id = o.id;
  if v_existing > 0 then
    return v_existing;
  end if;
  if jsonb_typeof(o.items) is distinct from 'array' then
    return 0;
  end if;

  for it in select e from jsonb_array_elements(o.items) e loop
    exit when v_seq >= 500;
    v_qty   := case when (it->>'qty') ~ '^[0-9]{1,3}$' then greatest((it->>'qty')::integer, 1) else 1 end;
    v_label := coalesce(nullif(btrim(it->>'label'), ''), case when o.kind = 'tables' then 'Mesa' else 'Entrada' end);

    if o.kind = 'tables' then
      v_key := it->>'id';
      v_seats := null;
      select t.seats into v_seats from public.venue_event_tables t where t.event_id = o.event_id and t.table_key = v_key;
      v_n := least(coalesce(v_seats, 1) * v_qty, 500 - v_seq);
      for k in 1..v_n loop
        v_seq := v_seq + 1;
        insert into public.venue_ticket_guests (order_id, event_id, seq, kind, label, table_key, seat_no)
        values (o.id, o.event_id, v_seq, 'seat', v_label || ' · asiento ' || k, v_key, k)
        on conflict (order_id, seq) do nothing;
      end loop;
    else
      v_type := case when (it->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (it->>'id')::uuid else null end;
      if v_type is not null and not exists (select 1 from public.venue_ticket_types where id = v_type) then
        v_type := null;
      end if;
      v_n := least(v_qty, 500 - v_seq);
      for k in 1..v_n loop
        v_seq := v_seq + 1;
        insert into public.venue_ticket_guests (order_id, event_id, seq, kind, label, ticket_type_id)
        values (o.id, o.event_id, v_seq, 'ticket', v_label, v_type)
        on conflict (order_id, seq) do nothing;
      end loop;
    end if;
  end loop;

  -- El pase 1 hereda los datos del comprador.
  update public.venue_ticket_guests
     set guest_name  = coalesce(nullif(btrim(o.reservation_name), ''), nullif(btrim(o.customer_name), '')),
         guest_email = nullif(btrim(o.customer_email), ''),
         guest_phone = nullif(btrim(o.customer_phone), '')
   where order_id = o.id and seq = 1;

  -- Orden antigua con ingresos ya contados: los primeros pases quedan como ya ingresados.
  if o.checked_in_qty > 0 then
    update public.venue_ticket_guests
       set status = 'checked_in', checked_in_at = coalesce(o.checked_in_at, now()), checked_in_by = o.checked_in_by
     where id in (select g.id from public.venue_ticket_guests g where g.order_id = o.id order by g.seq limit o.checked_in_qty);
  end if;

  return v_seq;
end;
$function$;

revoke all on function public.venue_ticket_issue_guests(uuid) from public, anon, authenticated;
grant execute on function public.venue_ticket_issue_guests(uuid) to service_role;

-- ── 3) Ficha pública de UN pase ──
create or replace function public.venue_guest_pass(p_pass_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v      record;
  v_void boolean := false;
  v_holder text;
begin
  if p_pass_id is null then
    return jsonb_build_object('found', false);
  end if;

  select g.id, g.status, g.guest_name, g.label, g.checked_in_at, g.event_id,
         o.status as order_status, o.kind,
         e.title as event_title, e.event_date, r.name as room_name
    into v
    from public.venue_ticket_guests g
    join public.venue_ticket_orders o on o.id = g.order_id
    left join public.venue_events e on e.id = g.event_id
    left join public.venue_rooms  r on r.id = e.room_id
   where g.id = p_pass_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v.status = 'void' or v.order_status like 'cancelled%' or v.order_status like '%refund%' or v.order_status like '%conflict%' then
    v_void := true;
  end if;

  v_holder := nullif(btrim(v.guest_name), '');
  if v_holder is not null then
    if position(' ' in v_holder) > 0 then
      v_holder := split_part(v_holder, ' ', 1) || ' ' || left(split_part(v_holder, ' ', 2), 1) || '.';
    end if;
  else
    v_holder := 'Invitado';
  end if;

  return jsonb_build_object(
    'found',         true,
    'pass',          true,
    'pass_id',       v.id,
    'kind',          v.kind,
    'event_id',      v.event_id,
    'event_title',   v.event_title,
    'event_date',    v.event_date,
    'room_name',     v.room_name,
    'label',         v.label,
    'holder',        v_holder,
    'status',        case when v_void then 'void' else v.status end,
    'checked_in_at', v.checked_in_at,
    'void',          v_void
  );
end;
$function$;

revoke all on function public.venue_guest_pass(uuid) from public;
grant execute on function public.venue_guest_pass(uuid) to anon, authenticated;

-- ── 4) Cartera del comprador: todos los pases de su compra (emite si faltan) ──
create or replace function public.venue_order_wallet(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v      record;
  v_void boolean := false;
  v_passes jsonb := '[]'::jsonb;
begin
  if p_order_id is null then
    return jsonb_build_object('found', false);
  end if;

  select o.id, o.kind, o.status, o.event_id,
         e.title as event_title, e.event_date, r.name as room_name
    into v
    from public.venue_ticket_orders o
    left join public.venue_events e on e.id = o.event_id
    left join public.venue_rooms  r on r.id = e.room_id
   where o.id = p_order_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v.status like 'cancelled%' or v.status like '%refund%' or v.status like '%conflict%' then
    v_void := true;
  else
    perform public.venue_ticket_issue_guests(v.id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',            g.id,
           'seq',           g.seq,
           'label',         g.label,
           'name',          g.guest_name,
           'status',        case when v_void then 'void' else g.status end,
           'checked_in_at', g.checked_in_at) order by g.seq), '[]'::jsonb)
    into v_passes
    from public.venue_ticket_guests g
   where g.order_id = v.id;

  return jsonb_build_object(
    'found',       true,
    'wallet',      true,
    'order_id',    v.id,
    'kind',        v.kind,
    'event_id',    v.event_id,
    'event_title', v.event_title,
    'event_date',  v.event_date,
    'room_name',   v.room_name,
    'void',        v_void,
    'passes',      v_passes
  );
end;
$function$;

revoke all on function public.venue_order_wallet(uuid) from public;
grant execute on function public.venue_order_wallet(uuid) to anon, authenticated;

-- ── 5) Asignar nombre/teléfono/correo a un pase ──
--   · El comprador: p_key = id de la ORDEN y p_guest_id = el pase que asigna.
--   · El portador de un pase: p_key = id del PASE y p_guest_id = null (solo edita el suyo).
create or replace function public.venue_guest_set_info(p_key uuid, p_guest_id uuid, p_name text, p_phone text, p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  g       record;
  v_name  text := nullif(btrim(p_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(btrim(p_email), '');
begin
  if p_key is null then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  if v_name is null or length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'nombre_invalido');
  end if;
  if v_phone is not null and (length(v_phone) > 30 or v_phone !~ '^[0-9+()\-. ]+$') then
    return jsonb_build_object('ok', false, 'error', 'telefono_invalido');
  end if;
  if v_email is not null and (length(v_email) > 120 or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    return jsonb_build_object('ok', false, 'error', 'correo_invalido');
  end if;

  if p_guest_id is null then
    select gg.id, gg.status, o.status as order_status into g
      from public.venue_ticket_guests gg join public.venue_ticket_orders o on o.id = gg.order_id
     where gg.id = p_key for update of gg;
  else
    select gg.id, gg.status, o.status as order_status into g
      from public.venue_ticket_guests gg join public.venue_ticket_orders o on o.id = gg.order_id
     where gg.id = p_guest_id and gg.order_id = p_key for update of gg;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  if g.order_status like 'cancelled%' or g.order_status like '%refund%' or g.order_status like '%conflict%' or g.status = 'void' then
    return jsonb_build_object('ok', false, 'error', 'pase_anulado');
  end if;
  if g.status <> 'issued' then
    return jsonb_build_object('ok', false, 'error', 'pase_ya_usado');
  end if;

  update public.venue_ticket_guests
     set guest_name = v_name, guest_phone = v_phone, guest_email = v_email
   where id = g.id;

  return jsonb_build_object('ok', true, 'guest_id', g.id, 'name', v_name);
end;
$function$;

revoke all on function public.venue_guest_set_info(uuid, uuid, text, text, text) from public;
grant execute on function public.venue_guest_set_info(uuid, uuid, text, text, text) to anon, authenticated;

-- ── 6) Escáner: lee el id de un PASE (o el de la orden, como siempre) ──
create or replace function public.venue_ticket_scan(
  p_order_id uuid,
  p_event_id uuid,
  p_qty      integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid      uuid := auth.uid();
  v_venue    uuid;
  v_event_ok boolean := false;
  v_allowed  boolean := false;
  o          public.venue_ticket_orders%rowtype;
  v_found    boolean := false;
  v_total    integer := 0;
  v_new      integer;
  v_code     text;
  gp         record;
  v_gfound   boolean := false;
begin
  if v_uid is null then
    raise exception 'venue_ticket_scan_not_authenticated';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'venue_ticket_scan_invalid_qty';
  end if;

  select r.venue_id into v_venue
    from public.venue_events e
    join public.venue_rooms r on r.id = e.room_id
   where e.id = p_event_id;
  v_event_ok := found;

  v_allowed := public.is_staff(v_uid)
    or (v_event_ok and exists (select 1 from public.venue_staff vs where vs.venue_id = v_venue and vs.user_id = v_uid));
  if not v_allowed then
    raise exception 'venue_ticket_scan_not_allowed';
  end if;

  -- 1) ¿Lo escaneado es un PASE individual? (una sola fila bloqueada: dos escaneos simultáneos no pasan los dos)
  select g.id as gid, g.order_id, g.event_id as g_event, g.status as gstatus, g.guest_name, g.label,
         o2.status as ostatus, o2.reservation_name as rname
    into gp
    from public.venue_ticket_guests g
    join public.venue_ticket_orders o2 on o2.id = g.order_id
   where g.id = p_order_id
     for update of g;
  v_gfound := found;

  if v_gfound then
    if not v_event_ok or gp.g_event is distinct from p_event_id then
      v_code := 'invalid_event';
    elsif gp.gstatus = 'void' or gp.ostatus like 'cancelled%' or gp.ostatus like '%refund%' or gp.ostatus like '%conflict%' then
      v_code := 'cancelled';
    elsif gp.gstatus = 'checked_in' then
      v_code := 'already_used';
    else
      update public.venue_ticket_guests
         set status = 'checked_in', checked_in_at = now(), checked_in_by = v_uid
       where id = gp.gid;
      update public.venue_ticket_orders
         set checked_in_qty = checked_in_qty + 1, checked_in_at = now(), checked_in_by = v_uid
       where id = gp.order_id;
      v_code := 'success';
    end if;

    select checked_in_qty into v_new from public.venue_ticket_orders where id = gp.order_id;
    select count(*) into v_total from public.venue_ticket_guests where order_id = gp.order_id and status <> 'void';

    insert into public.venue_ticket_scan_logs (order_id, event_id, scanned_by, scan_result, qty, guest_id)
    values (gp.order_id, case when v_event_ok then p_event_id else null end, v_uid, v_code, 1, gp.gid);

    return jsonb_build_object(
      'ok',               (v_code = 'success'),
      'code',             v_code,
      'checked_in_qty',   v_new,
      'total_qty',        v_total,
      'reservation_name', coalesce(nullif(btrim(gp.guest_name), ''), gp.rname),
      'items',            jsonb_build_array(jsonb_build_object('label', gp.label, 'qty', 1))
    );
  end if;

  -- 2) Es el id de una ORDEN (QR de la compra completa): comportamiento de siempre.
  select * into o from public.venue_ticket_orders where id = p_order_id for update;
  v_found := found;

  if v_found then
    select coalesce(sum(coalesce((it->>'qty')::integer, 0)), 0)
      into v_total
      from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it;
  end if;

  if not v_found then
    v_code := 'order_not_found';
  elsif not v_event_ok or o.event_id is distinct from p_event_id then
    v_code := 'invalid_event';
  elsif o.status like 'cancelled%' or o.status like '%refund%' or o.status like '%conflict%' then
    v_code := 'cancelled';
  elsif o.checked_in_qty + p_qty > v_total then
    v_code := 'already_used';
  else
    v_code := 'success';
  end if;

  if v_code = 'success' then
    update public.venue_ticket_orders
       set checked_in_qty = checked_in_qty + p_qty,
           checked_in_at  = now(),
           checked_in_by  = v_uid
     where id = p_order_id
    returning checked_in_qty into v_new;
    -- Si la orden ya tiene pases, entrar por el QR de la orden marca los siguientes pases pendientes.
    update public.venue_ticket_guests
       set status = 'checked_in', checked_in_at = now(), checked_in_by = v_uid
     where id in (select g.id from public.venue_ticket_guests g where g.order_id = p_order_id and g.status = 'issued' order by g.seq limit p_qty);
  elsif v_found then
    v_new := o.checked_in_qty;
  end if;

  insert into public.venue_ticket_scan_logs (order_id, event_id, scanned_by, scan_result, qty)
  values (
    case when v_found then p_order_id else null end,
    case when v_event_ok then p_event_id else null end,
    v_uid,
    v_code,
    p_qty
  );

  return jsonb_build_object(
    'ok',               (v_code = 'success'),
    'code',             v_code,
    'checked_in_qty',   v_new,
    'total_qty',        case when v_found then v_total else null end,
    'reservation_name', case when v_found then o.reservation_name else null end,
    'items',            case when v_found then coalesce(o.items, '[]'::jsonb) else null end
  );
end;
$function$;

revoke all on function public.venue_ticket_scan(uuid, uuid, integer) from public, anon;
grant execute on function public.venue_ticket_scan(uuid, uuid, integer) to authenticated;

-- ── Comprobación (solo lectura): tabla=true, rls=true, 5 funciones=true, columna_log=true, emitir_solo_servicio (anon=false, authenticated=false, service_role=true),
--    públicas (anon=true), escaneo (anon=false, authenticated=true), pases=0 (aún no hay compras reales) ──
select
  (to_regclass('public.venue_ticket_guests') is not null)                                                       as tabla,
  (select relrowsecurity from pg_class where oid = 'public.venue_ticket_guests'::regclass)                     as rls,
  (to_regprocedure('public.venue_ticket_issue_guests(uuid)') is not null)                                       as f_emitir,
  (to_regprocedure('public.venue_guest_pass(uuid)') is not null)                                                as f_pase,
  (to_regprocedure('public.venue_order_wallet(uuid)') is not null)                                              as f_cartera,
  (to_regprocedure('public.venue_guest_set_info(uuid,uuid,text,text,text)') is not null)                        as f_asignar,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'venue_ticket_scan_logs' and column_name = 'guest_id') as columna_log,
  has_function_privilege('anon',         'public.venue_ticket_issue_guests(uuid)', 'execute')                   as emitir_anon,
  has_function_privilege('authenticated','public.venue_ticket_issue_guests(uuid)', 'execute')                   as emitir_auth,
  has_function_privilege('service_role', 'public.venue_ticket_issue_guests(uuid)', 'execute')                   as emitir_servicio,
  has_function_privilege('anon',         'public.venue_order_wallet(uuid)', 'execute')                          as cartera_anon,
  has_function_privilege('anon',         'public.venue_guest_pass(uuid)', 'execute')                            as pase_anon,
  has_function_privilege('anon',         'public.venue_ticket_scan(uuid,uuid,integer)', 'execute')              as escaneo_anon,
  has_function_privilege('authenticated','public.venue_ticket_scan(uuid,uuid,integer)', 'execute')              as escaneo_auth,
  (select count(*) from public.venue_ticket_guests)                                                              as pases;
