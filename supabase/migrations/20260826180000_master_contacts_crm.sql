-- ============================================================
-- ENTORNO: DISEÑO — NO EJECUTADO EN PRODUCCIÓN NI PRUEBA TODAVÍA
-- Fecha: 2026-08-26
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- Fase: "Contactos Maestros y Motor de Recomendación PRO"
-- ============================================================
--
-- CONTEXTO
-- --------
-- Hoy cada DJ registra a "su" cliente por su cuenta (en leads/bookings),
-- así que el mismo cliente real puede existir varias veces, una por cada
-- DJ que lo atendió. Esta migración agrega una capa de identidad
-- canónica ARRIBA de esos registros existentes — no los reemplaza ni los
-- toca — para poder mostrar "una Sofía, afiliada a 3 DJs" en vez de tres
-- Sofías sueltas en el Calendario Maestro.
--
-- DOS CORRECCIONES DE ESQUEMA ANTES DE DISEÑAR ESTO (verificado en vivo
-- contra producción, léxico real, no supuesto):
--
--   1) dj_profiles.is_pro NO EXISTE. La membresía PRO real vive en
--      dj_profiles.plan / plan_type / plan_status, y los datos están
--      inconsistentes (vi filas con plan='PRO', plan='pro_monthly',
--      plan='founder', e incluso una fila con plan='pro_monthly' pero
--      plan_type='free' — sucio, no lo inventé). get_recommended_djs()
--      de abajo revisa AMBAS columnas, mayúscula-insensible, e incluye
--      'founder' como PRO (memoria del proyecto: founder = PRO vitalicio).
--
--   2) No existe todavía ninguna tabla de "contactos" per-DJ dedicada —
--      los datos de cliente hoy viven repartidos en `leads` (email,
--      phone, name, contact_person, assigned_dj_id) y en `client_profiles`
--      (cuentas reales con login). master_clients es una capa NUEVA,
--      pensada para alimentarse de leads/bookings vía la función
--      find_or_create_master_client() de abajo — el backfill de los
--      duplicados YA EXISTENTES en `leads` es un paso aparte, posterior
--      a que apruebes este esquema (no incluido aquí a propósito: fusionar
--      datos históricos sucios merece su propia revisión, no ir mezclado
--      en la migración de esquema).
--
-- NADA de este archivo se ha corrido. Es para tu revisión.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) master_clients — identidad canónica de un cliente real
-- ────────────────────────────────────────────────────────────
create table public.master_clients (
  id uuid primary key default gen_random_uuid(),
  normalized_phone text unique,
  normalized_email text unique,
  name text,
  birthday date,
  wedding_anniversary date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un contacto sin teléfono NI email no es deduplicable — no tiene
  -- sentido como "maestro" (nada contra qué hacer match).
  constraint master_clients_identity_check
    check (normalized_phone is not null or normalized_email is not null)
);

create index idx_master_clients_phone on public.master_clients (normalized_phone);
create index idx_master_clients_email on public.master_clients (normalized_email);

alter table public.master_clients enable row level security;

drop policy if exists "Staff ve todos los contactos maestros" on public.master_clients;
create policy "Staff ve todos los contactos maestros"
  on public.master_clients for select
  to authenticated
  using (
    exists (
      select 1 from public.dj_profiles
      where dj_profiles.user_id = auth.uid()
        and dj_profiles.role in ('owner','admin','manager','seller')
    )
  );
-- A propósito: sin policy de INSERT/UPDATE directa. Todo el ciclo de vida
-- pasa por find_or_create_master_client() (abajo) — así el dedup nunca
-- se salta, ni siquiera por accidente desde el cliente.

-- ────────────────────────────────────────────────────────────
-- 2) dj_client_affiliations — qué DJs conocen a qué cliente maestro
-- ────────────────────────────────────────────────────────────
create table public.dj_client_affiliations (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references public.dj_profiles(id) on delete cascade,
  master_client_id uuid not null references public.master_clients(id) on delete cascade,
  -- Cómo ESE dj tenía guardado el nombre del cliente antes de fusionarse
  -- (puede diferir del name canónico en master_clients — normal: un DJ
  -- lo tenía como "Sofi", otro como "Sofía Pérez").
  original_contact_name text,
  created_at timestamptz not null default now(),
  unique (dj_id, master_client_id)
);

create index idx_affiliations_master_client on public.dj_client_affiliations (master_client_id);
create index idx_affiliations_dj on public.dj_client_affiliations (dj_id);

alter table public.dj_client_affiliations enable row level security;

-- Un DJ ve sus propias afiliaciones; staff las ve todas.
drop policy if exists "DJ ve sus propias afiliaciones" on public.dj_client_affiliations;
create policy "DJ ve sus propias afiliaciones"
  on public.dj_client_affiliations for select
  to authenticated
  using (
    exists (
      select 1 from public.dj_profiles
      where dj_profiles.id = dj_client_affiliations.dj_id
        and dj_profiles.user_id = auth.uid()
    )
    or exists (
      select 1 from public.dj_profiles
      where dj_profiles.user_id = auth.uid()
        and dj_profiles.role in ('owner','admin','manager','seller')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3) find_or_create_master_client — el mecanismo REAL de dedup
--    (llamarla siempre en vez de insertar directo en master_clients)
-- ────────────────────────────────────────────────────────────
create or replace function public.find_or_create_master_client(
  p_dj_id uuid,
  p_phone text default null,
  p_email text default null,
  p_name text default null,
  p_birthday date default null,
  p_wedding_anniversary date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email,''))), '');
  v_id uuid;
begin
  if v_phone is null and v_email is null then
    raise exception 'find_or_create_master_client requiere teléfono o email.';
  end if;

  -- Normaliza a +1XXXXXXXXXX cuando llega como 10 dígitos EE.UU., mismo
  -- criterio que ya usa contracts-engine.html del lado del cliente.
  if v_phone is not null and v_phone !~ '^\+' then
    if length(v_phone) = 10 then v_phone := '+1' || v_phone;
    else v_phone := '+' || v_phone; end if;
  end if;

  select id into v_id from public.master_clients
    where (v_phone is not null and normalized_phone = v_phone)
       or (v_email is not null and normalized_email = v_email)
    limit 1;

  if v_id is null then
    insert into public.master_clients (normalized_phone, normalized_email, name, birthday, wedding_anniversary)
    values (v_phone, v_email, p_name, p_birthday, p_wedding_anniversary)
    returning id into v_id;
  else
    -- Rellena huecos, nunca pisa un dato que ya existía con uno nuevo null.
    update public.master_clients set
      normalized_phone = coalesce(normalized_phone, v_phone),
      normalized_email = coalesce(normalized_email, v_email),
      name = coalesce(name, p_name),
      birthday = coalesce(birthday, p_birthday),
      wedding_anniversary = coalesce(wedding_anniversary, p_wedding_anniversary),
      updated_at = now()
    where id = v_id;
  end if;

  insert into public.dj_client_affiliations (dj_id, master_client_id, original_contact_name)
  values (p_dj_id, v_id, p_name)
  on conflict (dj_id, master_client_id) do nothing;

  return v_id;
end;
$$;
grant execute on function public.find_or_create_master_client(uuid, text, text, text, date, date) to authenticated;

-- ────────────────────────────────────────────────────────────
-- 4) get_master_calendar_events — fechas sin duplicar, con DJs afiliados
--    (RPC con guardia de rol explícita, NO una vista pública — directriz
--    del PO 2026-08-26: nada de exponer esto como vista sin control de
--    acceso propio; el chequeo de staff vive dentro de la función, no
--    delegado a RLS de la tabla base.)
-- ────────────────────────────────────────────────────────────
create or replace function public.get_master_calendar_events()
returns table (
  master_client_id uuid,
  client_name text,
  event_type text,
  event_date date,
  dj_ids uuid[],
  dj_names text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.dj_profiles
    where dj_profiles.user_id = auth.uid()
      and dj_profiles.role in ('owner','admin','manager','seller')
  ) then
    raise exception 'forbidden: solo staff puede leer el calendario maestro';
  end if;

  return query
    select
      mc.id,
      mc.name,
      'birthday'::text,
      mc.birthday,
      array_agg(distinct dca.dj_id),
      array_agg(distinct coalesce(dp.dj_name, dp.stage_name, dp.full_name))
    from public.master_clients mc
    join public.dj_client_affiliations dca on dca.master_client_id = mc.id
    left join public.dj_profiles dp on dp.id = dca.dj_id
    where mc.birthday is not null
    group by mc.id, mc.name, mc.birthday

    union all

    select
      mc.id,
      mc.name,
      'wedding_anniversary'::text,
      mc.wedding_anniversary,
      array_agg(distinct dca.dj_id),
      array_agg(distinct coalesce(dp.dj_name, dp.stage_name, dp.full_name))
    from public.master_clients mc
    join public.dj_client_affiliations dca on dca.master_client_id = mc.id
    left join public.dj_profiles dp on dp.id = dca.dj_id
    where mc.wedding_anniversary is not null
    group by mc.id, mc.name, mc.wedding_anniversary;
end;
$$;
grant execute on function public.get_master_calendar_events() to authenticated;

-- ────────────────────────────────────────────────────────────
-- 5) get_recommended_djs — motor de priorización
-- ────────────────────────────────────────────────────────────
create or replace function public.get_recommended_djs(
  p_master_client_id uuid,
  p_event_date date
)
returns table (
  dj_id uuid,
  dj_name text,
  is_affiliated boolean,
  is_pro boolean,
  rating numeric,
  is_available boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    dp.id as dj_id,
    coalesce(dp.dj_name, dp.stage_name, dp.full_name) as dj_name,
    (dca.dj_id is not null) as is_affiliated,
    -- Ver nota al inicio del archivo: is_pro NO es una columna, se deriva
    -- de plan/plan_type + plan_status, y 'founder' cuenta como PRO.
    (
      (
        upper(coalesce(dp.plan, '')) in ('PRO', 'PRO_MONTHLY', 'FOUNDER')
        or upper(coalesce(dp.plan_type, '')) like 'PRO%'
      )
      and lower(coalesce(dp.plan_status, '')) = 'active'
    ) as is_pro,
    dp.rating,
    (
      coalesce(dp.available, false)
      and not exists (
        select 1 from public.dj_events de
        where de.dj_user_id = dp.user_id
          and de.event_date = p_event_date
          and lower(coalesce(de.status, '')) not in ('cancelled', 'canceled')
      )
    ) as is_available
  from public.dj_profiles dp
  left join public.dj_client_affiliations dca
    on dca.dj_id = dp.id and dca.master_client_id = p_master_client_id
  where dp.role = 'dj'
  order by
    is_affiliated desc,
    is_pro desc,
    is_available desc,
    dp.rating desc nulls last
  limit 20;
$$;
grant execute on function public.get_recommended_djs(uuid, date) to authenticated;
