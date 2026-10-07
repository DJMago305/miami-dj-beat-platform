-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · «Crear nuevo evento» con HORA y «−» para quitar un evento SIN ventas (pedido del PO 2026-10-07: botones + y − en círculo; el + abre el formulario con nombre, día, hora y año).
-- Requiere 20261007_venue_salas_seguridad_y_crear_evento.sql y 20261007_venue_autorizaciones_del_owner.sql ya aplicados.
--
--   1) venue_events.event_time (hora de inicio, opcional). Por ahora la ven las pantallas del local (selector, resumen); la sala pública no cambia.
--   2) venue_event_create(sala, nombre, fecha, abrir_mesas, hora): misma función de siempre con la HORA opcional. Se reemplaza (no queda una segunda versión que cause ambigüedad).
--      Quién puede: dueño y quien el dueño autorizó a diseñar la sala (can_manage_venue_layout) y admin de la plataforma.
--   3) venue_event_cancel(evento): «−». Solo quien puede diseñar la sala. Pone el evento en 'cancelled' y cierra su venta de mesas, y SOLO si no tiene ventas:
--      ninguna mesa vendida, apartada o en pago, ni ordenes activas (si las hay: 'evento_con_ventas'; con dinero de por medio se resuelve con reembolso, no desde aquí).
--      Un evento cancelado deja de aparecer en las listas del local. No borra nada (se puede revisar en la base).

alter table public.venue_events add column if not exists event_time time;

drop function if exists public.venue_event_create(uuid, text, date, boolean);
create or replace function public.venue_event_create(p_room_id uuid, p_title text, p_event_date date, p_open boolean default true, p_event_time time default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_venue  uuid;
  v_title  text := nullif(btrim(p_title), '');
  v_today  date := (now() at time zone 'America/New_York')::date;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'venue_event_create_not_authenticated';
  end if;
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id and coalesce(r.active, true);
  if v_venue is null then
    raise exception 'sala_no_existe';
  end if;
  if not (public.is_platform_admin(v_uid) or public.can_manage_venue_layout(v_venue)) then
    raise exception 'no_autorizado';
  end if;
  if v_title is null or length(v_title) < 3 or length(v_title) > 120 then
    return jsonb_build_object('ok', false, 'error', 'titulo_invalido');
  end if;
  if p_event_date is null or p_event_date < v_today or p_event_date > v_today + 730 then
    return jsonb_build_object('ok', false, 'error', 'fecha_invalida');
  end if;
  if (select count(*) from public.venue_events e join public.venue_rooms r on r.id = e.room_id
       where r.venue_id = v_venue and e.status in ('waitlist', 'announced') and e.event_date >= v_today) >= 60 then
    return jsonb_build_object('ok', false, 'error', 'demasiados_eventos');
  end if;
  if exists (select 1 from public.venue_events e where e.room_id = p_room_id and e.event_date = p_event_date
                and lower(btrim(e.title)) = lower(v_title) and e.status <> 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'evento_duplicado');
  end if;

  insert into public.venue_events (room_id, title, event_date, event_time, status, tables_open, layout)
  values (p_room_id, v_title, p_event_date, p_event_time, 'announced', false, '{}'::jsonb)
  returning id into v_id;

  if coalesce(p_open, true) then
    perform public.venue_event_open_tables(v_id, null);       -- copia la plantilla de la sala; 'sin_mapa' deshace TODO
  end if;
  return jsonb_build_object('ok', true, 'event_id', v_id);
end;
$function$;

revoke all on function public.venue_event_create(uuid, text, date, boolean, time) from public, anon;
grant execute on function public.venue_event_create(uuid, text, date, boolean, time) to authenticated;

create or replace function public.venue_event_cancel(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id); v_status text;
begin
  if auth.uid() is null then raise exception 'no_autorizado'; end if;
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  select e.status into v_status from public.venue_events e where e.id = p_event_id for update;
  if v_status = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'ya_cancelado'); end if;
  if exists (select 1 from public.venue_event_tables t where t.event_id = p_event_id
              and (t.status in ('sold', 'reserved') or (t.status = 'held' and t.held_until >= now()))) then
    return jsonb_build_object('ok', false, 'error', 'evento_con_ventas');
  end if;
  if exists (select 1 from public.venue_ticket_orders o where o.event_id = p_event_id and o.status not like 'cancelled%') then
    return jsonb_build_object('ok', false, 'error', 'evento_con_ventas');
  end if;
  update public.venue_events set status = 'cancelled', tables_open = false, updated_at = now() where id = p_event_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.venue_event_cancel(uuid) from public, anon, authenticated;
grant execute on function public.venue_event_cancel(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: columna_hora=true, crear_con_hora=true, una_sola_firma=true, cancelar=true, crear_anon=false, cancelar_anon=false ──
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'venue_events' and column_name = 'event_time')                       as columna_hora,
  (to_regprocedure('public.venue_event_create(uuid,text,date,boolean,time without time zone)') is not null)                                                              as crear_con_hora,
  (select count(*) = 1 from pg_proc where proname = 'venue_event_create' and pronamespace = 'public'::regnamespace)                                                      as una_sola_firma,
  (to_regprocedure('public.venue_event_cancel(uuid)') is not null)                                                                                                       as cancelar,
  has_function_privilege('anon', 'public.venue_event_create(uuid,text,date,boolean,time without time zone)', 'execute')                                                  as crear_anon,
  has_function_privilege('anon', 'public.venue_event_cancel(uuid)', 'execute')                                                                                           as cancelar_anon;
