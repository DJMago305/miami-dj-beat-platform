-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - "COBRADO" APARTE en el Matrix: lee los cobros reales de financial_payments (solo lectura, Owner/Admin)
-- 1) get_business_cash_summary devuelve 'cobros' (total, acreditado, por acreditar, por cuenta, primer dia con cobro); NO los suma a 'ganamos' (lo devengado ya cuenta esos turnos).
-- 2) get_business_matrix agrega los cobros a la tabla de movimientos (estado "Por acreditar" o "Cobrado"). No toca datos ni tablas.

create or replace function public.get_business_cash_summary(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_owner_brand constant uuid := '3f5d5196-273c-458e-a4af-6b3545422177';
  v_from date := coalesce(p_from, date '2000-01-01');
  v_to date := least(coalesce(p_to, current_date), current_date);
  r_ing bigint := 0; r_pago bigint := 0; r_n int := 0; r_mes jsonb;
  e_done int := 0; e_pend int := 0; e_ing bigint := 0; e_pago bigint := 0; e_sin int := 0;
  l_pago bigint := 0; l_n int := 0; l_pend bigint := 0;
  s_cents bigint := 0; s_n int := 0;
  b_cuentas int := 0; b_in bigint := 0; b_out bigint := 0;
  v_first date;
  c_tot bigint := 0; c_conf bigint := 0; c_pend bigint := 0; c_n int := 0; c_first date; c_cuentas jsonb := '[]'::jsonb;
begin
  if v_uid is null or not exists (select 1 from public.dj_profiles d where d.user_id = v_uid and lower(trim(coalesce(d.role, ''))) in ('owner', 'admin')) then
    raise exception 'forbidden';
  end if;

  -- 1) Residencias: la ocurrencia de cada turno activo (misma logica que el Cash Flow de cada DJ). Ingreso = lo que paga el local; pago = lo que gana el DJ (salvo DJMago305).
  with rules as (
    select r.id, r.day_of_week, r.dj_id, r.venue_pay_usd, r.dj_pay_usd,
           least(coalesce(r.start_date, r.created_at::date), coalesce((select min(e.exception_date) from public.residency_schedule_exceptions e where e.residency_id = r.id), coalesce(r.start_date, r.created_at::date)))::date as win_start,
           least(coalesce(r.end_date, current_date), current_date)::date as win_end
      from public.residency_schedule r
     where r.active = true and (coalesce(r.venue_pay_usd, 0) > 0 or coalesce(r.dj_pay_usd, 0) > 0)
  ), occ as (
    select ru.id as rid, ru.venue_pay_usd, ru.dj_pay_usd, ru.dj_id as base_dj, gs.d::date as occ_date
      from rules ru cross join lateral generate_series(ru.win_start, ru.win_end, interval '1 day') as gs(d)
     where ru.win_start <= ru.win_end and extract(dow from gs.d) = ru.day_of_week and gs.d::date between v_from and v_to
  ), eff as (
    select o.occ_date, o.venue_pay_usd, o.dj_pay_usd, coalesce(x.skip, false) as skipped, dp.user_id as eff_user
      from occ o
      left join public.residency_schedule_exceptions x on x.residency_id = o.rid and x.exception_date = o.occ_date
      left join public.dj_profiles dp on dp.id = coalesce(x.dj_id, o.base_dj)
  ), lines as (
    select occ_date,
           (round(coalesce(venue_pay_usd, 0) * 100))::bigint as ing,
           case when eff_user is not null and eff_user <> v_owner_brand then (round(coalesce(dj_pay_usd, 0) * 100))::bigint else 0 end as pago
      from eff where not skipped
  )
  select coalesce(sum(ing), 0), coalesce(sum(pago), 0), count(*)::int,
         coalesce((select jsonb_agg(jsonb_build_object('month', m.mes, 'ingreso_cents', m.i, 'pago_cents', m.p) order by m.mes)
                     from (select to_char(occ_date, 'YYYY-MM') as mes, sum(ing)::bigint as i, sum(pago)::bigint as p from lines group by 1) m), '[]'::jsonb)
    into r_ing, r_pago, r_n, r_mes from lines;

  -- 2) Eventos de la agenda (sin notas ni cumpleanos, solo activos): hechos, pendientes, y su dinero si esta registrado (tarifa del local / pago al DJ; el del owner no es pago).
  select count(*) filter (where coalesce(e.fecha_fin, e.fecha_inicio) < now() and e.fecha_inicio::date between v_from and v_to),
         count(*) filter (where e.fecha_inicio >= now()),
         coalesce(sum(e.tarifa_venue_cents) filter (where coalesce(e.fecha_fin, e.fecha_inicio) < now() and e.fecha_inicio::date between v_from and v_to), 0),
         coalesce(sum(e.pago_dj_cents) filter (where coalesce(e.fecha_fin, e.fecha_inicio) < now() and e.fecha_inicio::date between v_from and v_to and e.user_id is distinct from v_owner_brand), 0),
         count(*) filter (where coalesce(e.fecha_fin, e.fecha_inicio) < now() and e.fecha_inicio::date between v_from and v_to and e.tarifa_venue_cents is null)
    into e_done, e_pend, e_ing, e_pago, e_sin
    from public.elixis_agenda_eventos e
   where e.estado = 'activo' and coalesce(e.tipo, '') not in ('nota', 'cumpleanos');

  -- 3) Libro de los DJ: ingresos de DJ que NO vienen de la agenda ya contada, ni son del owner, ni son aporte. Es lo que se les debe/pago registrado a mano.
  select coalesce(sum(l.amount_cents), 0), count(*)::int
    into l_pago, l_n
    from public.dj_ledger l
   where l.type = 'income' and l.status in ('available', 'pending') and l.dj_user_id <> v_owner_brand
     and coalesce(l.metadata->>'classification', '') <> 'contribution'
     and coalesce(l.event_id, '') not like 'agenda_evento:%'
     and coalesce(nullif(l.metadata->>'fecha', '')::date, l.created_at::date) between v_from and v_to;
  select coalesce(sum(l.amount_cents), 0) into l_pend
    from public.dj_ledger l where l.type = 'income' and l.status = 'pending' and l.dj_user_id <> v_owner_brand and coalesce(l.metadata->>'classification', '') <> 'contribution';

  -- 4) Stripe: cobros registrados (suscripciones y pagos de clientes).
  select coalesce(sum(amount_cents), 0), count(*)::int into s_cents, s_n from public.payments where status = 'paid' and created_at::date between v_from and v_to;

  -- 5) Banco (Teller): cuentas conectadas y movimientos reales. Sin cuentas = no conectado.
  select count(*)::int into b_cuentas from public.bank_accounts where active = true;
  select coalesce(sum(amount_cents) filter (where direction = 'credit'), 0), coalesce(sum(amount_cents) filter (where direction = 'debit'), 0)
    into b_in, b_out from public.bank_transactions where posted_date between v_from and v_to;

  -- primer dia con dato real de la empresa (residencias activas o eventos): sirve para saber si un periodo anterior esta completo
  select min(d) into v_first from (
    select min(least(coalesce(r.start_date, r.created_at::date), coalesce((select min(x.exception_date) from public.residency_schedule_exceptions x where x.residency_id = r.id), coalesce(r.start_date, r.created_at::date)))) as d from public.residency_schedule r where r.active = true
    union all select min(e.fecha_inicio::date) from public.elixis_agenda_eventos e where e.estado = 'activo' and coalesce(e.tipo, '') not in ('nota', 'cumpleanos')
  ) q;

  -- 6) COBRADO: cobros reales registrados en financial_payments (cheques, Zelle, etc.), APARTE de lo devengado: no entra en 'ganamos' (seria contar dos veces el mismo dinero).
  --    PENDING = recibido, aun sin acreditar; CONFIRMED = acreditado en el banco.
  select coalesce(sum(amount_cents), 0), coalesce(sum(amount_cents) filter (where status = 'CONFIRMED'), 0), coalesce(sum(amount_cents) filter (where status = 'PENDING'), 0), count(*)::int
    into c_tot, c_conf, c_pend, c_n from public.financial_payments where direction = 'INFLOW' and status in ('PENDING', 'CONFIRMED') and payment_date between v_from and v_to;
  select coalesce(jsonb_agg(jsonb_build_object('account', a, 'cents', c) order by c desc), '[]'::jsonb) into c_cuentas
    from (select coalesce(account, 'Sin cuenta') as a, sum(amount_cents)::bigint as c from public.financial_payments where direction = 'INFLOW' and status in ('PENDING', 'CONFIRMED') and payment_date between v_from and v_to group by 1) q;
  select min(payment_date) into c_first from public.financial_payments where direction = 'INFLOW' and status in ('PENDING', 'CONFIRMED');

  return jsonb_build_object(
    'from', v_from, 'to', v_to, 'first_day', v_first,
    'cobros', jsonb_build_object('total_cents', c_tot, 'acreditado_cents', c_conf, 'por_acreditar_cents', c_pend, 'cobros', c_n, 'first_day', c_first, 'por_cuenta', c_cuentas),
    'residencias', jsonb_build_object('ingreso_cents', r_ing, 'pago_djs_cents', r_pago, 'margen_cents', r_ing - r_pago, 'turnos', r_n, 'por_mes', r_mes),
    'eventos', jsonb_build_object('hechos', e_done, 'pendientes', e_pend, 'ingreso_cents', e_ing, 'pago_djs_cents', e_pago, 'sin_ingreso_registrado', e_sin),
    'libro_djs', jsonb_build_object('pago_cents', l_pago, 'filas', l_n, 'pendiente_cents', l_pend),
    'stripe', jsonb_build_object('cobrado_cents', s_cents, 'pagos', s_n),
    'banco', jsonb_build_object('conectado', b_cuentas > 0, 'cuentas', b_cuentas, 'entradas_cents', b_in, 'salidas_cents', b_out),
    'ganamos_cents', r_ing + e_ing + s_cents,
    'pagamos_cents', r_pago + e_pago + l_pago,
    'neto_cents', (r_ing + e_ing + s_cents) - (r_pago + e_pago + l_pago));
end $$;
revoke all on function public.get_business_cash_summary(date, date) from public, anon;
grant execute on function public.get_business_cash_summary(date, date) to authenticated;

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
    union all select f.payment_date, 'Cobro ' || lower(f.method) || coalesce(' - ' || f.account, ''), coalesce(f.account, 'Banco'), 'Ingreso', f.amount_cents::bigint, case f.status when 'CONFIRMED' then 'Cobrado' else 'Por acreditar' end, 'Cobros', null
      from public.financial_payments f where f.direction = 'INFLOW' and f.status in ('PENDING', 'CONFIRMED') and f.payment_date between v_from and v_to
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

-- Comprobacion: con los 3 cheques ya cargados debe dar 3 / 187500 / 0 / 187500; y 'ganamos' no cambia (anon sin acceso: false).
select (select count(*) from public.financial_payments where direction = 'INFLOW') as cobros,
       (select coalesce(sum(amount_cents), 0) from public.financial_payments where direction = 'INFLOW') as total_centavos,
       (select coalesce(sum(amount_cents), 0) from public.financial_payments where direction = 'INFLOW' and status = 'CONFIRMED') as acreditado_centavos,
       (select coalesce(sum(amount_cents), 0) from public.financial_payments where direction = 'INFLOW' and status = 'PENDING') as por_acreditar_centavos,
       (has_function_privilege('anon', 'public.get_business_cash_summary(date, date)', 'execute') or has_function_privilege('anon', 'public.get_business_matrix(date, date)', 'execute')) as anon_ejecuta;
