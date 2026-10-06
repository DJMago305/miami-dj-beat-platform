-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Puerta, FASE 1 (solo backend, sin pantallas): escaneo del QR de un boleto/mesa y registro de CADA intento.
--
-- Qué agrega (aditivo e idempotente: volver a correrlo no duplica ni rompe nada):
--   1) Tabla venue_ticket_scan_logs: una fila por intento de escaneo (éxito o rechazo), con quién escaneó y el resultado.
--      RLS activo: solo LECTURA para el staff global (is_staff) y para el personal de ese local (venue_staff). Nadie escribe directo: escribe la función.
--   2) Función venue_ticket_scan(p_order_id, p_event_id, p_qty): valida y, si todo está bien, suma al ingreso de la orden.
--
-- Reglas de la función (SECURITY DEFINER, search_path = public):
--   · Acceso: is_staff(auth.uid()) = true, O el usuario está en venue_staff del LOCAL del evento (venue_events -> venue_rooms.venue_id).
--     Sin acceso la función lanza error y NO escribe nada en el registro (un extraño no puede llenarlo).
--   · Orden inexistente           -> 'order_not_found'
--   · La orden es de OTRO evento  -> 'invalid_event'   (boleto de otra fecha o de otro local)
--   · Estado 'cancelled%' o con reembolso/conflicto (p. ej. tables_conflict_refund_needed) -> 'cancelled'
--   · checked_in_qty + p_qty > total comprado -> 'already_used'  (el QR copiado solo deja entrar hasta agotar lo comprado)
--   · Todo bien -> suma p_qty a checked_in_qty, checked_in_at = now(), checked_in_by = auth.uid()  -> 'success'
--   · La orden se bloquea con FOR UPDATE mientras se valida: dos escaneos simultáneos del mismo QR no pasan los dos.
--   · Cada intento (menos el de quien no tiene acceso) deja su fila en el registro.
-- NO toca venue_ticket_checkin (los botones +/- de la vista Entradas siguen igual).
-- Extra respecto al pedido: la tabla guarda también qty (cuántas entradas se intentaron pasar) para que el registro sea auditable.

-- ── 1) Registro de escaneos ──
create table if not exists public.venue_ticket_scan_logs (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references public.venue_ticket_orders(id),
  event_id    uuid references public.venue_events(id),
  scanned_by  uuid references auth.users(id),
  scan_result text not null,
  qty         integer not null default 1,
  created_at  timestamptz not null default now()
);

alter table public.venue_ticket_scan_logs drop constraint if exists venue_ticket_scan_logs_result_check;
alter table public.venue_ticket_scan_logs
  add constraint venue_ticket_scan_logs_result_check
  check (scan_result in ('success', 'already_used', 'invalid_event', 'cancelled', 'order_not_found'));

create index if not exists venue_ticket_scan_logs_event_idx on public.venue_ticket_scan_logs (event_id, created_at desc);
create index if not exists venue_ticket_scan_logs_order_idx on public.venue_ticket_scan_logs (order_id);

alter table public.venue_ticket_scan_logs enable row level security;

revoke all on table public.venue_ticket_scan_logs from public, anon;
revoke insert, update, delete on table public.venue_ticket_scan_logs from authenticated;
grant select on table public.venue_ticket_scan_logs to authenticated;

drop policy if exists venue_ticket_scan_logs_read on public.venue_ticket_scan_logs;
create policy venue_ticket_scan_logs_read
  on public.venue_ticket_scan_logs
  for select
  to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1
        from public.venue_events e
        join public.venue_rooms r on r.id = e.room_id
        join public.venue_staff vs on vs.venue_id = r.venue_id
       where e.id = venue_ticket_scan_logs.event_id
         and vs.user_id = auth.uid()
    )
  );

-- ── 2) Escaneo ──
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
begin
  if v_uid is null then
    raise exception 'venue_ticket_scan_not_authenticated';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'venue_ticket_scan_invalid_qty';
  end if;

  -- Local del evento que la puerta tiene abierto (si el evento existe).
  select r.venue_id into v_venue
    from public.venue_events e
    join public.venue_rooms r on r.id = e.room_id
   where e.id = p_event_id;
  v_event_ok := found;

  -- Acceso: staff global, o personal del local de ESE evento.
  v_allowed := public.is_staff(v_uid)
    or (v_event_ok and exists (select 1 from public.venue_staff vs where vs.venue_id = v_venue and vs.user_id = v_uid));
  if not v_allowed then
    raise exception 'venue_ticket_scan_not_allowed';
  end if;

  -- La orden se bloquea mientras se valida (dos escaneos a la vez no pasan los dos).
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
  elsif v_found then
    v_new := o.checked_in_qty;
  end if;

  -- Cada intento deja su fila (event_id/order_id solo si existen: las llaves foraneas no aceptan ids inventados).
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

-- ── Comprobación (solo lectura): debe dar tabla=true, rls=true, funcion=true, anon=false, authenticated=true, 0 filas en el registro ──
select
  (to_regclass('public.venue_ticket_scan_logs') is not null)                                            as tabla,
  (select relrowsecurity from pg_class where oid = 'public.venue_ticket_scan_logs'::regclass)            as rls,
  (to_regprocedure('public.venue_ticket_scan(uuid,uuid,integer)') is not null)                           as funcion,
  has_function_privilege('anon',          'public.venue_ticket_scan(uuid,uuid,integer)', 'execute')      as anon_ejecuta,
  has_function_privilege('authenticated', 'public.venue_ticket_scan(uuid,uuid,integer)', 'execute')      as authenticated_ejecuta,
  (select count(*) from public.venue_ticket_scan_logs)                                                   as filas_en_registro;
