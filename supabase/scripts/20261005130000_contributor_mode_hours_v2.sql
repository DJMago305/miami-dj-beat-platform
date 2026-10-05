-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - MODO CONTRIBUYENTE + CONTRIBUCIONES (owner y DJMago305), v2
-- Reglas: el Cash Flow SOLO MIDE (el artista nunca escribe nada ahi). Las horas las registra UNICAMENTE el Staff de gestion (owner, admin o manager) desde la seccion "Contribuciones",
-- eligiendo al contribuyente por nombre. Cada contribuyente solo puede LEER lo suyo (resumen y serie diaria para la grafica).
-- Tablas: contributor_compensation (quien es contribuyente y, mas adelante, su salario mensual) y contribution_hours (horas aportadas).
create table if not exists public.contributor_compensation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'contributor' check (mode in ('contributor', 'salaried')),
  monthly_salary_cents integer check (monthly_salary_cents is null or monthly_salary_cents >= 0),
  since date not null default current_date,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.contributor_compensation enable row level security;
drop policy if exists contributor_compensation_select_own on public.contributor_compensation;
create policy contributor_compensation_select_own on public.contributor_compensation for select to authenticated using (user_id = auth.uid());
revoke all on table public.contributor_compensation from public, anon, authenticated;
grant select on table public.contributor_compensation to authenticated;

create table if not exists public.contribution_hours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  worked_on date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contribution_hours_user_day_idx on public.contribution_hours (user_id, worked_on desc);
alter table public.contribution_hours enable row level security;
drop policy if exists contribution_hours_select_own on public.contribution_hours;
create policy contribution_hours_select_own on public.contribution_hours for select to authenticated using (user_id = auth.uid());
revoke all on table public.contribution_hours from public, anon, authenticated;
grant select on table public.contribution_hours to authenticated;

-- Limpieza de la version anterior (si se llego a crear alguna funcion con escritura propia)
drop function if exists public.log_my_contribution_hours(date, numeric, text);
drop function if exists public.delete_my_contribution_hours(uuid);

-- LECTURA del propio contribuyente (lo que pinta el Cash Flow: solo medir)
create or replace function public.get_my_contribution_summary()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); c public.contributor_compensation%rowtype; v_month date;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into c from public.contributor_compensation where user_id = v_uid;
  if not found then return jsonb_build_object('mode', null); end if;
  v_month := date_trunc('month', (now() at time zone 'America/New_York'))::date;
  return jsonb_build_object(
    'mode', c.mode, 'monthly_salary_cents', c.monthly_salary_cents, 'since', c.since,
    'hours_total', coalesce((select sum(hours) from public.contribution_hours where user_id = v_uid), 0),
    'hours_month', coalesce((select sum(hours) from public.contribution_hours where user_id = v_uid and worked_on >= v_month), 0),
    'events_done', (select count(*) from public.elixis_agenda_eventos where user_id = v_uid and coalesce(tipo, '') not in ('nota', 'cumpleanos') and estado = 'activo' and coalesce(fecha_fin, fecha_inicio) < now()),
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

create or replace function public.get_my_contribution_daily(p_days integer default 800)
returns table(day date, hours numeric)
language sql stable security definer set search_path to 'public' as $$
  select h.worked_on as day, sum(h.hours) as hours
    from public.contribution_hours h
   where h.user_id = auth.uid()
     and h.worked_on >= current_date - greatest(1, least(coalesce(p_days, 800), 1500))
   group by h.worked_on
   order by h.worked_on;
$$;

-- ESCRITURA y consulta SOLO para el Staff de gestion (owner, admin, manager): seccion "Contribuciones"
create or replace function public.staff_list_contributors()
returns table(user_id uuid, name text, mode text, hours_month numeric, hours_total numeric)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_month date := date_trunc('month', (now() at time zone 'America/New_York'))::date;
begin
  if auth.uid() is null or not public.is_staff_management(auth.uid()) then raise exception 'forbidden'; end if;
  return query
    select c.user_id, coalesce(nullif(btrim(p.stage_name), ''), nullif(btrim(p.dj_name), ''), 'Sin nombre')::text, c.mode,
           coalesce((select sum(h.hours) from public.contribution_hours h where h.user_id = c.user_id and h.worked_on >= v_month), 0),
           coalesce((select sum(h.hours) from public.contribution_hours h where h.user_id = c.user_id), 0)
      from public.contributor_compensation c left join public.dj_profiles p on p.user_id = c.user_id
     order by 2;
end $$;

create or replace function public.staff_log_contribution_hours(p_artist_user_id uuid, p_worked_on date, p_hours numeric, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_staff_management(auth.uid()) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.contributor_compensation where user_id = p_artist_user_id and mode = 'contributor') then raise exception 'not_contributor'; end if;
  if p_worked_on is null or p_worked_on > current_date + 1 or p_worked_on < current_date - 400 then raise exception 'fecha_invalida'; end if;
  if p_hours is null or p_hours <= 0 or p_hours > 24 then raise exception 'horas_invalidas'; end if;
  if coalesce((select sum(hours) from public.contribution_hours where user_id = p_artist_user_id and worked_on = p_worked_on), 0) + p_hours > 24 then raise exception 'mas_de_24_horas_en_un_dia'; end if;
  insert into public.contribution_hours (user_id, worked_on, hours, note, created_by)
    values (p_artist_user_id, p_worked_on, p_hours, nullif(btrim(coalesce(p_note, '')), ''), auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.staff_list_contribution_hours(p_artist_user_id uuid default null, p_limit integer default 50)
returns table(id uuid, user_id uuid, name text, worked_on date, hours numeric, note text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_staff_management(auth.uid()) then raise exception 'forbidden'; end if;
  return query
    select h.id, h.user_id, coalesce(nullif(btrim(p.stage_name), ''), nullif(btrim(p.dj_name), ''), 'Sin nombre')::text, h.worked_on, h.hours, h.note, h.created_at
      from public.contribution_hours h left join public.dj_profiles p on p.user_id = h.user_id
     where p_artist_user_id is null or h.user_id = p_artist_user_id
     order by h.worked_on desc, h.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 200));
end $$;

create or replace function public.staff_delete_contribution_hours(p_id uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_staff_management(auth.uid()) then raise exception 'forbidden'; end if;
  delete from public.contribution_hours where id = p_id;
  return found;
end $$;

revoke all on function public.get_my_contribution_summary() from public, anon;
revoke all on function public.get_my_contribution_daily(integer) from public, anon;
revoke all on function public.staff_list_contributors() from public, anon;
revoke all on function public.staff_log_contribution_hours(uuid, date, numeric, text) from public, anon;
revoke all on function public.staff_list_contribution_hours(uuid, integer) from public, anon;
revoke all on function public.staff_delete_contribution_hours(uuid) from public, anon;
grant execute on function public.get_my_contribution_summary() to authenticated;
grant execute on function public.get_my_contribution_daily(integer) to authenticated;
grant execute on function public.staff_list_contributors() to authenticated;
grant execute on function public.staff_log_contribution_hours(uuid, date, numeric, text) to authenticated;
grant execute on function public.staff_list_contribution_hours(uuid, integer) to authenticated;
grant execute on function public.staff_delete_contribution_hours(uuid) to authenticated;

insert into public.contributor_compensation (user_id, mode, note) values
  ('3f5d5196-273c-458e-a4af-6b3545422177', 'contributor', 'DJMago305: part-time extra para eventos especiales'),
  ('01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'contributor', 'Owner: quien mas trabajara; de aqui saldra el salario cuando el proyecto arranque')
on conflict (user_id) do nothing;

-- Comprobacion: 2 contribuyentes, 6 funciones, ninguna para anon.
select (select count(*) from public.contributor_compensation where mode = 'contributor') as contribuyentes,
       (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('get_my_contribution_summary', 'get_my_contribution_daily', 'staff_list_contributors', 'staff_log_contribution_hours', 'staff_list_contribution_hours', 'staff_delete_contribution_hours')) as funciones,
       (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('get_my_contribution_summary', 'get_my_contribution_daily', 'staff_list_contributors', 'staff_log_contribution_hours', 'staff_list_contribution_hours', 'staff_delete_contribution_hours') and has_function_privilege('anon', p.oid, 'execute')) as funciones_para_anon;
