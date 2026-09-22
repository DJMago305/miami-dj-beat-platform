-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Tarifas de artista: PRIVADAS (solo el propio artista y el staff). No se muestran en el perfil público ni al cliente.
-- Uso: staff y ELIXIS al rentar un artista. Si el artista no ha confirmado precio -> se usa la BASE de Miami DJ Beat
-- (catálogo existente: platform_settings.rentals_catalog_prices + fallback en _shared/event-quote-catalog.ts) como punto de negociación.
-- NO duplica precios: esta capa solo dice CUÁL es la base (base_sku); ELIXIS la traduce con el catálogo.
-- Vive fuera de dj_profiles (que es legible públicamente y tiene columnas de comisión).

create table if not exists public.artist_rates (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  tarifa_show_usd  numeric(10,2) check (tarifa_show_usd is null or tarifa_show_usd >= 0),
  tarifa_hora_usd  numeric(10,2) check (tarifa_hora_usd is null or tarifa_hora_usd >= 0),
  notas            text,
  confirmada_en    timestamptz,                       -- la fija el servidor cuando se guarda un precio
  confirmada_por   text check (confirmada_por in ('artista','staff')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.artist_rates enable row level security;

create policy artist_rates_select on public.artist_rates for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy artist_rates_insert on public.artist_rates for insert to authenticated
  with check ((user_id = auth.uid() and coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') in ('artist','dj','talent')) or public.is_staff(auth.uid()));
create policy artist_rates_update on public.artist_rates for update to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()))
  with check ((user_id = auth.uid() and coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') in ('artist','dj','talent')) or public.is_staff(auth.uid()));
-- sin política DELETE: solo service_role

create or replace function public.artist_rates_trg() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.tarifa_show_usd is distinct from old.tarifa_show_usd or new.tarifa_hora_usd is distinct from old.tarifa_hora_usd then
    if coalesce(new.tarifa_show_usd, new.tarifa_hora_usd) is not null then
      new.confirmada_en  := now();
      new.confirmada_por := case when auth.uid() is not null and public.is_staff(auth.uid()) and new.user_id <> auth.uid() then 'staff' else 'artista' end;
    else
      new.confirmada_en := null; new.confirmada_por := null;
    end if;
  else  -- el artista no puede falsificar quién/cuándo confirmó
    new.confirmada_en := old.confirmada_en; new.confirmada_por := old.confirmada_por;
  end if;
  return new;
end $$;
drop trigger if exists trg_artist_rates on public.artist_rates;
create trigger trg_artist_rates before insert or update on public.artist_rates for each row execute function public.artist_rates_trg();

-- Precio efectivo: lo que confirmó el artista, o la BASE de Miami DJ Beat (negociable). SOLO staff / service_role.
create or replace function public.artist_rate_effective(p_user uuid)
returns table(user_id uuid, nombre text, tarifa_show_usd numeric, tarifa_hora_usd numeric, fuente text, base_sku text, negociable boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and not public.is_staff(auth.uid()) then raise exception 'solo staff'; end if;
  return query
  select d.user_id,
         coalesce(nullif(d.stage_name,''), nullif(d.dj_name,''), d.full_name),
         r.tarifa_show_usd, r.tarifa_hora_usd,
         case when r.confirmada_en is not null and coalesce(r.tarifa_show_usd, r.tarifa_hora_usd) is not null then 'artista_confirmada' else 'base_miamidjbeat' end,
         case
           when r.confirmada_en is not null and coalesce(r.tarifa_show_usd, r.tarifa_hora_usd) is not null then null
           when coalesce(d.artist_specialty,'')||' '||coalesce(d.category,'') ~* '(singer|cantante)'          then 'live_singer'
           when coalesce(d.artist_specialty,'')||' '||coalesce(d.category,'') ~* '(saxo)'                       then 'live_sax'
           when coalesce(d.artist_specialty,'')||' '||coalesce(d.category,'') ~* '(percusi|percussion)'         then 'live_percussion'
           when coalesce(d.artist_specialty,'')||' '||coalesce(d.category,'') ~* '(flair)'                      then 'staff_bartender_flair'   -- $1,200/evento (PO 2026-09-21)
           when coalesce(d.artist_specialty,'')||' '||coalesce(d.category,'') ~* '(bartender)'                  then 'staff_bartender'
           else null end,
         true
    from public.dj_profiles d left join public.artist_rates r on r.user_id = d.user_id
   where d.user_id = p_user;
end $$;
revoke execute on function public.artist_rate_effective(uuid) from public, anon, authenticated;
grant execute on function public.artist_rate_effective(uuid) to authenticated, service_role;  -- authenticated pasa por el is_staff interno
