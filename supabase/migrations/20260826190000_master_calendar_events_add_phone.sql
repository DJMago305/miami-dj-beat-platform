-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr) — ya aplicado
-- Fecha: 2026-08-26
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Aditivo: get_master_calendar_events() ahora también devuelve
-- client_phone (master_clients.normalized_phone). Necesario para que el
-- botón de acción rápida del Calendario Maestro pueda abrir un wa.me real
-- ofreciéndole al cliente el DJ recomendado para su fecha — sin esto no
-- hay a quién escribirle. Mismos parámetros (ninguno) y misma guardia de
-- rol staff, solo se agrega una columna al resultado.
--
-- DROP + CREATE (no CREATE OR REPLACE a secas) porque Postgres no permite
-- cambiar el tipo de retorno de una función existente sin eso — mismo
-- patrón ya usado en las migraciones anteriores de esta fase.
-- ============================================================

drop function if exists public.get_master_calendar_events();

create or replace function public.get_master_calendar_events()
returns table (
  master_client_id uuid,
  client_name text,
  client_phone text,
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
      mc.normalized_phone,
      'birthday'::text,
      mc.birthday,
      array_agg(distinct dca.dj_id),
      array_agg(distinct coalesce(dp.dj_name, dp.stage_name, dp.full_name))
    from public.master_clients mc
    join public.dj_client_affiliations dca on dca.master_client_id = mc.id
    left join public.dj_profiles dp on dp.id = dca.dj_id
    where mc.birthday is not null
    group by mc.id, mc.name, mc.normalized_phone, mc.birthday

    union all

    select
      mc.id,
      mc.name,
      mc.normalized_phone,
      'wedding_anniversary'::text,
      mc.wedding_anniversary,
      array_agg(distinct dca.dj_id),
      array_agg(distinct coalesce(dp.dj_name, dp.stage_name, dp.full_name))
    from public.master_clients mc
    join public.dj_client_affiliations dca on dca.master_client_id = mc.id
    left join public.dj_profiles dp on dp.id = dca.dj_id
    where mc.wedding_anniversary is not null
    group by mc.id, mc.name, mc.normalized_phone, mc.wedding_anniversary;
end;
$$;
grant execute on function public.get_master_calendar_events() to authenticated;
