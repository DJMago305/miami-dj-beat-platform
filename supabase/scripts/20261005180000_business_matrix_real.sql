-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - MATRIX DEL OWNER CON DATOS REALES: por local, por artista, programado, semanas y movimientos (solo lectura, Owner/Admin)
-- No crea tablas ni toca datos. Suma lo que YA existe: residencias (misma logica que el Cash Flow de cada DJ), agenda de eventos, libro de los DJ, Stripe y, cuando exista, el banco (Teller).
-- Regla del PO: los turnos de DJMago305 (3f5d5196...) son INGRESO de la empresa, nunca un pago a el; su aporte no es pago. Pagos a DJs = DEVENGADO (lo que se les debe).
create or replace function public.get_business_matrix(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_owner_brand constant uuid := '3f5d5196-273c-458e-a4af-6b3545422177';
  v_from date := coalesce(p_from, date '2000-01-01');
  v_to date := least(coalesce(p_to, current_date), current_date);
  v_horizon date := current_date + 83;
  v_out jsonb;
begin
  if v_uid is null or not exists (select 1 from public.dj_profiles d where d.user_id = v_uid and lower(trim(coalesce(d.role, ''))) in ('owner', 'admin')) then
    raise exception 'forbidden';
  end if;

  with rules as (
    select r.id, r.day_of_week, r.dj_id, r.venue, r.shift, r.venue_pay_usd, r.dj_pay_usd,
           least(coalesce(r.start_date, r.created_at::date), coalesce((select min(e.exception_date) from public.residency_schedule_exceptions e where e.residency_id = r.id), coalesce(r.start_date, r.created_at::date)))::date as win_start,
           coalesce(r.end_date, v_horizon)::date as win_end
      from public.residency_schedule r
     where r.active = true and (coalesce(r.venue_pay_usd, 0) > 0 or coalesce(r.dj_pay_usd, 0) > 0)
  ), occ as (
    select ru.id as rid, ru.venue, ru.shift, ru.venue_pay_usd, ru.dj_pay_usd, ru.dj_id as base_dj, gs.d::date as occ_date
      from rules ru cross join lateral generate_series(ru.win_start, least(ru.win_end, v_horizon), interval '1 day') as gs(d)
     where ru.win_start <= least(ru.win_end, v_horizon) and extract(dow from gs.d) = ru.day_of_week
  ), eff as (
    select o.occ_date, o.venue, o.shift, o.venue_pay_usd, o.dj_pay_usd, coalesce(x.skip, false) as skipped, dp.id as eff_pid, dp.user_id as eff_user,
           coalesce(nullif(btrim(dp.stage_name), ''), nullif(btrim(dp.dj_name), ''), 'Sin nombre') as eff_name
      from occ o
      left join public.residency_schedule_exceptions x on x.residency_id = o.rid and x.exception_date = o.occ_date
      left join public.dj_profiles dp on dp.id = coalesce(x.dj_id, o.base_dj)
  ), lines as (
    select occ_date, venue, shift, eff_pid, eff_user, eff_name,
           (round(coalesce(venue_pay_usd, 0) * 100))::bigint as ing,
           case when eff_user is not null and eff_user <> v_owner_brand then (round(coalesce(dj_pay_usd, 0) * 100))::bigint else 0 end as pago
      from eff where not skipped
  ), past as (select * from lines where occ_date between v_from and v_to), fut as (select * from lines where occ_date > current_date),
  ev as (
    select e.id, e.user_id, coalesce(nullif(btrim(e.venue_nombre), ''), 'Eventos privados') as venue, e.fecha_inicio::date as d, e.tarifa_venue_cents as tarifa,
           case when e.user_id is distinct from v_owner_brand then e.pago_dj_cents end as pago, coalesce(e.tipo, '') as tipo
      from public.elixis_agenda_eventos e
     where e.estado = 'activo' and coalesce(e.tipo, '') not in ('nota', 'cumpleanos') and coalesce(e.fecha_fin, e.fecha_inicio) < now() and e.fecha_inicio::date between v_from and v_to
  ), led as (
    select l.id, l.dj_user_id, l.amount_cents, l.status, coalesce(nullif(l.metadata->>'fecha', '')::date, l.created_at::date) as d, coalesce(nullif(l.metadata->>'evento', ''), nullif(l.metadata->>'titulo', ''), 'Movimiento del libro') as concept
      from public.dj_ledger l
     where l.type = 'income' and l.status in ('available', 'pending') and l.dj_user_id <> v_owner_brand and coalesce(l.metadata->>'classification', '') <> 'contribution'
       and coalesce(l.event_id, '') not like 'agenda_evento:%' and coalesce(nullif(l.metadata->>'fecha', '')::date, l.created_at::date) between v_from and v_to
  ), names as (
    select dp.id as pid, dp.user_id, coalesce(nullif(btrim(dp.stage_name), ''), nullif(btrim(dp.dj_name), ''), 'Sin nombre') as name from public.dj_profiles dp
  ),
  venues as (
    select coalesce(a.venue, b.venue) as name, coalesce(a.turnos, 0) as turnos, coalesce(a.ing, 0) + coalesce(b.ing, 0) as ing, coalesce(a.pago, 0) + coalesce(b.pago, 0) as pago, coalesce(b.hechos, 0) as hechos
      from (select venue, count(*) as turnos, sum(ing) as ing, sum(pago) as pago from past group by venue) a
      full join (select venue, count(*) as hechos, coalesce(sum(tarifa), 0) as ing, coalesce(sum(pago), 0) as pago from ev group by venue) b on b.venue = a.venue
  ),
  artists as (
    select n.name, coalesce(r.turnos, 0) as turnos, coalesce(r.ing, 0) + coalesce(e.ing, 0) as ing, coalesce(r.pago, 0) + coalesce(e.pago, 0) as pago, coalesce(e.hechos, 0) as hechos,
           coalesce(lp.pend, 0) as pendiente
      from names n
      left join (select eff_pid, count(*) as turnos, sum(ing) as ing, sum(pago) as pago from past group by eff_pid) r on r.eff_pid = n.pid
      left join (select user_id, count(*) as hechos, coalesce(sum(tarifa), 0) as ing, coalesce(sum(pago), 0) as pago from ev group by user_id) e on e.user_id = n.user_id
      left join (select dj_user_id, sum(amount_cents) as pend from led where status = 'pending' group by dj_user_id) lp on lp.dj_user_id = n.user_id
     where exists (select 1 from public.dj_profiles d2 where d2.id = n.pid and lower(coalesce(d2.role, '')) = 'dj')
  ),
  semanas as (select to_char(date_trunc('week', occ_date), 'YYYY-MM-DD') as w, sum(ing) as ing, sum(pago) as pago, count(*) as turnos from past group by 1),
  vsem as (select venue, to_char(date_trunc('week', occ_date), 'YYYY-MM-DD') as w, sum(ing) as ing, sum(pago) as pago, count(*) as turnos from past group by 1, 2
           union all select venue, to_char(date_trunc('week', d), 'YYYY-MM-DD'), coalesce(sum(tarifa), 0), coalesce(sum(pago), 0), count(*) from ev group by 1, 2),
  asem as (select eff_name as name, to_char(date_trunc('week', occ_date), 'YYYY-MM-DD') as w, sum(ing) as ing, sum(pago) as pago, count(*) as turnos from past group by 1, 2
           union all select (select n2.name from names n2 where n2.user_id = ev.user_id limit 1), to_char(date_trunc('week', d), 'YYYY-MM-DD'), coalesce(sum(tarifa), 0), coalesce(sum(pago), 0), count(*) from ev group by 1, 2),
  prog as (select to_char(date_trunc('week', occ_date), 'YYYY-MM-DD') as w, sum(ing) as ing, sum(pago) as pago, count(*) as turnos from fut where occ_date <= v_horizon group by 1),
  movs as (
    select occ_date as d, 'Residencia ' || shift || ' - ' || venue as concept, venue as counterparty, 'Ingreso' as tipo, ing as amount, 'Devengado' as estado, venue as scope, eff_name as who from past where ing > 0
    union all select occ_date, 'Residencia ' || shift || ' - ' || venue, eff_name, 'Pago', pago, 'Devengado', venue, eff_name from past where pago > 0
    union all select d, 'Evento ' || tipo || ' - ' || venue, venue, 'Ingreso', tarifa, 'Devengado', venue, (select name from names where user_id = ev.user_id limit 1) from ev where coalesce(tarifa, 0) > 0
    union all select d, 'Evento ' || tipo || ' - ' || venue, (select name from names where user_id = ev.user_id limit 1), 'Pago', pago, 'Devengado', venue, (select name from names where user_id = ev.user_id limit 1) from ev where coalesce(pago, 0) > 0
    union all select d, concept, (select name from names where user_id = led.dj_user_id limit 1), 'Pago', amount_cents, case status when 'pending' then 'Pendiente' else 'Disponible' end, 'Libro de DJs', (select name from names where user_id = led.dj_user_id limit 1) from led
    union all select p.created_at::date, 'Cobro Stripe' || coalesce(' - ' || p.plan, ''), (select name from names where user_id = p.user_id limit 1), 'Ingreso', p.amount_cents::bigint, 'Cobrado', 'Stripe', (select name from names where user_id = p.user_id limit 1)
      from public.payments p where p.status = 'paid' and p.created_at::date between v_from and v_to
    union all select t.posted_date, coalesce(t.description, 'Movimiento del banco'), 'Banco', case t.direction when 'credit' then 'Ingreso' else 'Pago' end, t.amount_cents, 'Banco', 'Banco', null
      from public.bank_transactions t where t.posted_date between v_from and v_to
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to,
    'venues', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'turnos', turnos, 'hechos', hechos, 'ingreso_cents', ing, 'pago_cents', pago, 'margen_cents', ing - pago) order by ing desc, name) from venues), '[]'::jsonb),
    'artists', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'turnos', turnos, 'hechos', hechos, 'ingreso_cents', ing, 'pago_cents', pago, 'margen_cents', ing - pago, 'pendiente_cents', pendiente) order by ing desc, name) from artists), '[]'::jsonb),
    'semanas', coalesce((select jsonb_agg(jsonb_build_object('week', w, 'ingreso_cents', ing, 'pago_cents', pago, 'turnos', turnos) order by w) from semanas), '[]'::jsonb),
    'venue_semanas', coalesce((select jsonb_agg(jsonb_build_object('venue', venue, 'week', w, 'ingreso_cents', ing, 'pago_cents', pago, 'turnos', turnos) order by w) from vsem), '[]'::jsonb),
    'artist_semanas', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'week', w, 'ingreso_cents', ing, 'pago_cents', pago, 'turnos', turnos) order by w) from asem where name is not null), '[]'::jsonb),
    'turnos_sin_ingreso', (select count(*) from past where ing = 0 and pago > 0),
    'turnos_total', (select count(*) from past),
    'programado', coalesce((select jsonb_agg(jsonb_build_object('week', w, 'ingreso_cents', ing, 'pago_cents', pago, 'turnos', turnos) order by w) from prog), '[]'::jsonb),
    'movimientos', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'concept', concept, 'counterparty', counterparty, 'tipo', tipo, 'amount_cents', amount, 'estado', estado, 'scope', scope, 'who', who) order by d desc, amount desc)
                              from (select * from movs order by d desc, amount desc limit 300) m), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.get_business_matrix(date, date) from public, anon;
grant execute on function public.get_business_matrix(date, date) to authenticated;

-- Comprobacion: la funcion existe y anon no la ejecuta (debe dar 1 / false).
select count(*) as funcion, bool_or(has_function_privilege('anon', p.oid, 'execute')) as anon_ejecuta
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'get_business_matrix';
