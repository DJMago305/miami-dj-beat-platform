-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - TRAFICO DEL SITIO (SEO) para el Matrix del Owner: tabla + funcion de solo lectura + carga inicial
-- Datos REALES de miamidjbeat.com: Google Analytics 4 (propiedad 537395643) y Search Console (https://www.miamidjbeat.com/), traidos el 2026-10-05 por el conector Supermetrics
-- del 2026-08-29 (arranque de GA4) al 2026-10-04. Es una instantanea por dia: para actualizarla se vuelve a correr la carga (upsert por dia, sin duplicados).
-- La tabla no se lee desde el navegador (RLS sin politicas); solo la funcion get_business_seo_summary, para Owner y Admin.
create table if not exists public.seo_daily_metrics (
  day date primary key,
  sessions integer,
  users integer,
  new_users integer,
  engaged_sessions integer,
  pageviews integer,
  gsc_clicks integer,
  gsc_impressions integer,
  gsc_position numeric(6,2),
  source text not null default 'supermetrics',
  updated_at timestamptz not null default now()
);
alter table public.seo_daily_metrics enable row level security;
revoke all on table public.seo_daily_metrics from public, anon, authenticated;

create or replace function public.get_business_seo_summary(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_last date; v_first date; v_from date; v_len int; v_pf date; v_pt date;
  v_cur jsonb; v_prev jsonb; v_prev_days int; v_daily jsonb; v_upd timestamptz;
begin
  if v_uid is null or not exists (select 1 from public.dj_profiles d where d.user_id = v_uid and lower(trim(coalesce(d.role, ''))) in ('owner', 'admin')) then
    raise exception 'forbidden';
  end if;
  select max(day), min(day), max(updated_at) into v_last, v_first, v_upd from public.seo_daily_metrics;
  if v_last is null then return jsonb_build_object('empty', true); end if;
  -- p_days nulo o 0 = todo el historial; si no, los ultimos N dias con dato
  v_from := case when coalesce(p_days, 0) <= 0 then v_first else greatest(v_first, v_last - (p_days - 1)) end;
  v_len := (v_last - v_from) + 1;
  v_pt := v_from - 1; v_pf := v_from - (case when coalesce(p_days, 0) <= 0 then v_len else p_days end);
  select jsonb_build_object('sessions', coalesce(sum(sessions), 0), 'engaged_sessions', coalesce(sum(engaged_sessions), 0), 'pageviews', coalesce(sum(pageviews), 0),
           'new_users', coalesce(sum(new_users), 0), 'clicks', coalesce(sum(gsc_clicks), 0), 'impressions', coalesce(sum(gsc_impressions), 0),
           'position', case when coalesce(sum(gsc_impressions), 0) > 0 then round((sum(gsc_position * gsc_impressions) / sum(gsc_impressions))::numeric, 1) end, 'days', count(*))
    into v_cur from public.seo_daily_metrics where day between v_from and v_last;
  select jsonb_build_object('sessions', coalesce(sum(sessions), 0), 'engaged_sessions', coalesce(sum(engaged_sessions), 0), 'pageviews', coalesce(sum(pageviews), 0),
           'new_users', coalesce(sum(new_users), 0), 'clicks', coalesce(sum(gsc_clicks), 0), 'impressions', coalesce(sum(gsc_impressions), 0),
           'position', case when coalesce(sum(gsc_impressions), 0) > 0 then round((sum(gsc_position * gsc_impressions) / sum(gsc_impressions))::numeric, 1) end, 'days', count(*))
    into v_prev from public.seo_daily_metrics where day between v_pf and v_pt;
  v_prev_days := (v_prev->>'days')::int;
  select coalesce(jsonb_agg(jsonb_build_object('day', day, 'sessions', sessions, 'clicks', gsc_clicks, 'impressions', gsc_impressions) order by day), '[]'::jsonb)
    into v_daily from public.seo_daily_metrics where day between v_pf and v_last;
  return jsonb_build_object('from', v_from, 'to', v_last, 'length_days', v_len, 'previous_from', v_pf, 'previous_to', v_pt, 'previous_days_with_data', v_prev_days,
    'current', v_cur, 'previous', v_prev, 'daily', v_daily, 'first_day', v_first, 'updated_at', v_upd, 'source', 'Google Analytics 4 + Search Console (Supermetrics)');
end $$;
revoke all on function public.get_business_seo_summary(integer) from public, anon;
grant execute on function public.get_business_seo_summary(integer) to authenticated;

insert into public.seo_daily_metrics (day, sessions, users, new_users, engaged_sessions, pageviews, gsc_clicks, gsc_impressions, gsc_position) values
  ('2026-08-29', 3, 3, 3, 3, 4, 0, 12, 49.3333),
  ('2026-08-30', 4, 4, 4, 3, 16, 0, 12, 45.9167),
  ('2026-08-31', 5, 5, 2, 3, 18, 1, 44, 10.0909),
  ('2026-09-01', 11, 7, 3, 6, 20, 3, 73, 5.4795),
  ('2026-09-02', 8, 5, 4, 7, 89, 0, 27, 8.6296),
  ('2026-09-03', 40, 17, 16, 22, 221, 0, 51, 14.3137),
  ('2026-09-04', 13, 5, 3, 10, 96, 0, 7, 40.2857),
  ('2026-09-05', 14, 7, 4, 8, 69, 0, 19, 7.8421),
  ('2026-09-06', 8, 6, 2, 5, 55, 1, 39, 9.3846),
  ('2026-09-07', 15, 7, 3, 10, 61, 1, 21, 40.1905),
  ('2026-09-08', 36, 12, 7, 23, 214, 1, 24, 24.9167),
  ('2026-09-09', 35, 16, 12, 13, 158, 1, 33, 15.2424),
  ('2026-09-10', 49, 31, 28, 27, 205, 0, 24, 18.875),
  ('2026-09-11', 29, 11, 7, 20, 302, 0, 19, 34.2105),
  ('2026-09-12', 14, 8, 5, 6, 115, 0, 32, 22.4375),
  ('2026-09-13', 20, 6, 1, 13, 88, 1, 32, 21.4688),
  ('2026-09-14', 2, 2, 1, 2, 4, 1, 31, 12.0323),
  ('2026-09-15', 6, 4, 2, 3, 34, 0, 30, 15.1333),
  ('2026-09-16', 14, 5, 2, 5, 67, 0, 22, 17.4091),
  ('2026-09-17', 8, 4, 2, 4, 9, 1, 34, 29.7059),
  ('2026-09-18', 10, 4, 2, 8, 31, 0, 16, 22.375),
  ('2026-09-19', 4, 4, 2, 1, 5, 0, 15, 43.6),
  ('2026-09-20', 6, 5, 4, 2, 8, 0, 19, 36.6842),
  ('2026-09-21', 12, 4, 1, 9, 141, 0, 16, 33.5625),
  ('2026-09-22', 15, 8, 3, 11, 101, 1, 19, 45.4737),
  ('2026-09-23', 12, 5, 2, 10, 41, 1, 28, 48.1429),
  ('2026-09-24', 11, 7, 2, 8, 27, 0, 17, 48.7059),
  ('2026-09-25', 7, 4, 3, 3, 13, 1, 44, 41.9545),
  ('2026-09-26', 10, 6, 3, 8, 602, 0, 32, 58.1875),
  ('2026-09-27', 19, 8, 5, 15, 173, 2, 40, 43.3),
  ('2026-09-28', 19, 7, 2, 14, 92, 0, 55, 55.1636),
  ('2026-09-29', 13, 5, 0, 9, 94, 0, 57, 42.3333),
  ('2026-09-30', 28, 7, 1, 20, 190, 0, 16, 47.625),
  ('2026-10-01', 18, 8, 2, 15, 68, 0, 43, 33.5581),
  ('2026-10-02', 16, 7, 4, 9, 48, 0, 29, 50.7241),
  ('2026-10-03', 7, 1, 0, 5, 28, 0, 46, 45.8043),
  ('2026-10-04', 19, 9, 4, null, 88, 0, 31, 28.6774)
on conflict (day) do update set sessions = excluded.sessions, users = excluded.users, new_users = excluded.new_users, engaged_sessions = excluded.engaged_sessions,
  pageviews = excluded.pageviews, gsc_clicks = excluded.gsc_clicks, gsc_impressions = excluded.gsc_impressions, gsc_position = excluded.gsc_position, updated_at = now();

-- Comprobacion: debe dar dias=37, desde=2026-08-29, hasta=2026-10-04, sesiones_total=560, clics_total=16, impresiones_total=1109, anon_ejecuta=false.
select count(*) as dias, min(day) as desde, max(day) as hasta, sum(sessions) as sesiones_total, sum(gsc_clicks) as clics_total, sum(gsc_impressions) as impresiones_total,
       (select has_function_privilege('anon', 'public.get_business_seo_summary(integer)', 'execute')) as anon_ejecuta
  from public.seo_daily_metrics;
