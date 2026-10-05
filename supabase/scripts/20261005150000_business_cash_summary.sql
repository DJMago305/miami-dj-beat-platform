-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - NEGOCIO: cuanto GANAMOS y cuanto PAGAMOS (solo lectura, solo Owner/Admin)
-- No crea tablas ni toca datos: una funcion de lectura que suma lo que YA existe (residencias, agenda de eventos, libro de los DJ, Stripe) y, cuando Teller se conecte, el banco.
-- Regla del PO (22-sep): los turnos de DJMago305 (3f5d5196...) son INGRESO de la empresa, nunca un pago a el. Su "aporte" no es pago.
-- Pagos a DJs = DEVENGADO (lo que se les debe por turnos y eventos ya ocurridos). Lo realmente pagado saldra del banco (Teller) cuando llegue.
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

  return jsonb_build_object(
    'from', v_from, 'to', v_to,
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

-- Comprobacion: la funcion existe y anon no la ejecuta.
select count(*) as funcion, bool_or(has_function_privilege('anon', p.oid, 'execute')) as anon_ejecuta
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'get_business_cash_summary';
