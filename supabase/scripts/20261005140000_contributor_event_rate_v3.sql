-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - CONTRIBUYENTES v3: aporte por evento ($250 a DJMago305) + los $500 de marzo pasan a "aporte"
-- Requiere contribuyente_v2.sql ya aplicado (ya lo esta). Solo MIDE: nadie escribe desde el Cash Flow. No borra ningun dato.
-- 1) Tarifa de aporte por evento, por contribuyente (en centavos). DJMago305 = 25000 ($250). El owner queda sin tarifa: su aporte es en horas, por ahora.
--    El "pago_dj_cents" de $600 de la agenda NO se usa para el aporte.
alter table public.contributor_compensation add column if not exists event_contribution_cents integer check (event_contribution_cents is null or event_contribution_cents >= 0);
update public.contributor_compensation set event_contribution_cents = 25000, updated_at = now()
 where user_id = '3f5d5196-273c-458e-a4af-6b3545422177' and event_contribution_cents is null;

-- 2) Los $500 de marzo (fila unica del libro de DJMago305, sin evento) se marcan como APORTE: dejan de contar como cobrado/disponible en su Cash Flow.
--    No se borra ni se cambia el monto: solo se anota la clasificacion en la columna metadata de esa fila.
update public.dj_ledger set metadata = coalesce(metadata, '{}'::jsonb) || '{"classification":"contribution"}'::jsonb
 where id = '69d91136-9fab-4fb4-a8d2-25d43af2259c' and dj_user_id = '3f5d5196-273c-458e-a4af-6b3545422177' and type = 'income' and event_id is null;

-- 3) Resumen del contribuyente (lectura propia): suma aporte por eventos (eventos hechos SIN ingreso registrado x tarifa) y el aporte clasificado del libro.
--    Si el Staff registra un "ingreso del evento" para un evento (fila del libro con event_id agenda_evento:<id>), ese evento deja de ser aporte y pasa a ser ingreso cobrado.
create or replace function public.get_my_contribution_summary()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); c public.contributor_compensation%rowtype; v_month date; v_done int; v_paid int; v_up int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into c from public.contributor_compensation where user_id = v_uid;
  if not found then return jsonb_build_object('mode', null); end if;
  v_month := date_trunc('month', (now() at time zone 'America/New_York'))::date;
  select count(*) filter (where coalesce(e.fecha_fin, e.fecha_inicio) < now()),
         count(*) filter (where coalesce(e.fecha_fin, e.fecha_inicio) < now() and exists (select 1 from public.dj_ledger l where l.dj_user_id = v_uid and l.type = 'income' and l.event_id = 'agenda_evento:' || e.id::text)),
         count(*) filter (where e.fecha_inicio >= now())
    into v_done, v_paid, v_up
    from public.elixis_agenda_eventos e
   where e.user_id = v_uid and coalesce(e.tipo, '') not in ('nota', 'cumpleanos') and e.estado = 'activo';
  return jsonb_build_object(
    'mode', c.mode, 'monthly_salary_cents', c.monthly_salary_cents, 'since', c.since,
    'hours_total', coalesce((select sum(hours) from public.contribution_hours where user_id = v_uid), 0),
    'hours_month', coalesce((select sum(hours) from public.contribution_hours where user_id = v_uid and worked_on >= v_month), 0),
    'events_done', v_done, 'events_upcoming', v_up, 'events_paid', v_paid,
    'event_rate_cents', c.event_contribution_cents,
    'event_contrib_cents', coalesce(c.event_contribution_cents, 0)::bigint * (v_done - v_paid),
    'ledger_contrib_cents', coalesce((select sum(amount_cents) from public.dj_ledger where dj_user_id = v_uid and type = 'income' and status in ('available', 'pending') and metadata->>'classification' = 'contribution'), 0),
    'sub_paid_cents', coalesce((select sum(amount_cents) from public.payments where user_id = v_uid and status = 'paid'), 0),
    'sub_paid_month_cents', coalesce((select sum(amount_cents) from public.payments where user_id = v_uid and status = 'paid' and created_at >= date_trunc('month', now())), 0),
    'sub_payments', (select count(*) from public.payments where user_id = v_uid and status = 'paid'),
    'sub_year', extract(year from (now() at time zone 'America/New_York'))::int,
    'sub_paid_year_cents', coalesce((select sum(amount_cents) from public.payments where user_id = v_uid and status = 'paid' and extract(year from (created_at at time zone 'America/New_York')) = extract(year from (now() at time zone 'America/New_York'))), 0),
    'sub_payments_year', (select count(*) from public.payments where user_id = v_uid and status = 'paid' and extract(year from (created_at at time zone 'America/New_York')) = extract(year from (now() at time zone 'America/New_York'))),
    'sub_by_year', coalesce((select jsonb_agg(jsonb_build_object('year', q.y, 'cents', q.c, 'count', q.n) order by q.y desc)
                               from (select extract(year from (created_at at time zone 'America/New_York'))::int as y, sum(amount_cents)::bigint as c, count(*)::int as n
                                       from public.payments where user_id = v_uid and status = 'paid' group by 1) q), '[]'::jsonb));
end $$;
revoke all on function public.get_my_contribution_summary() from public, anon;
grant execute on function public.get_my_contribution_summary() to authenticated;

-- Comprobacion: tarifa de DJMago305 = 25000, la fila de marzo clasificada = 1, la funcion no la ve anon.
select (select event_contribution_cents from public.contributor_compensation where user_id = '3f5d5196-273c-458e-a4af-6b3545422177') as tarifa_mago_cents,
       (select count(*) from public.dj_ledger where metadata->>'classification' = 'contribution') as filas_aporte,
       has_function_privilege('anon', 'public.get_my_contribution_summary()', 'execute') as anon_ejecuta;
