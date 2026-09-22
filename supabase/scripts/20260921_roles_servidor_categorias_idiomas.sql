-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr) — YA APLICADO el 2026-09-21 (registro reproducible; idempotente).
-- Cierra el cruce cliente↔artista a nivel de DATOS: el rol lo fija el SERVIDOR (app_metadata.role), no `user_type` (editable por el usuario).
-- Incluye además las columnas de categoría única e idiomas de los artistas.

-- 1) user_role(): una cuenta sin rol es CLIENTE (antes asumía 'dj'). Las 5 políticas que la usan solo comparan con admin/manager.
create or replace function public.user_role() returns text language sql stable as $$
  select coalesce(nullif(auth.jwt() -> 'app_metadata' ->> 'role',''), 'client')
$$;

-- 2) Todo registro nuevo recibe su rol al crearse (talent/dj/artist -> artist; el resto -> client). Nunca bloquea un alta.
create or replace function public.mdj_asignar_rol_al_registrarse() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare ut text := lower(coalesce(new.raw_user_meta_data->>'user_type',''));
begin
  begin
    if coalesce(new.raw_app_meta_data->>'role','') = '' then
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}'::jsonb)
        || jsonb_build_object('role', case when ut in ('talent','dj','artist') then 'artist' else 'client' end);
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_mdj_rol_al_registrarse on auth.users;
create trigger trg_mdj_rol_al_registrarse before insert on auth.users for each row execute function public.mdj_asignar_rol_al_registrarse();

-- 3) Crear fila de artista: UNA política; exige rol artist/dj/talent en el token o ser staff de gestión (antes 3 políticas permisivas).
drop policy if exists "DJ can insert own profile" on public.dj_profiles;
drop policy if exists "DJs can insert their own profile" on public.dj_profiles;
drop policy if exists "dj_profiles: own insert" on public.dj_profiles;
drop policy if exists "dj_profiles: alta solo cuenta artista" on public.dj_profiles;
create policy "dj_profiles: alta solo cuenta artista" on public.dj_profiles for insert to authenticated
  with check (auth.uid() = user_id and (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') in ('artist','dj','talent') or public.is_staff_management(auth.uid())));

-- 4) Categoría única + idiomas del artista (claves = web/js/mdj-categorias.js; el verificador exige que coincidan)
alter table public.dj_profiles add column if not exists categoria text;
alter table public.dj_profiles add column if not exists idiomas text[];
do $$ begin
  if not exists (select 1 from pg_constraint where conname='dj_profiles_categoria_valores') then
    alter table public.dj_profiles add constraint dj_profiles_categoria_valores
      check (categoria is null or categoria in ('animador','bartender','cantante','dj','fotografia','horaloca','mc','mesero','musico','orquesta','payasos','staff'));
  end if;
  if not exists (select 1 from pg_constraint where conname='dj_profiles_idiomas_valores') then
    alter table public.dj_profiles add constraint dj_profiles_idiomas_valores check (idiomas is null or idiomas <@ array['es','en','bilingue']::text[]);
  end if;
end $$;

-- 5) Auditoría: identity (SSOT V2, dormido) debe coincidir con el rol de servidor; y la auditoría general de roles
create or replace function public.mdj_auditar_identidad()
returns table(gravedad text, problema text, detalle text)
language plpgsql security definer set search_path = public, auth, identity, pg_temp as $$
begin
  return query select 'GRAVE', 'identity ≠ rol de servidor', (u.email||' token='||coalesce(u.raw_app_meta_data->>'role','-')||' identity='||i.account_type::text)::text
    from auth.users u join identity.users i on i.id=u.id
    where (i.account_type::text='staff'  and coalesce(u.raw_app_meta_data->>'role','') not in ('owner','admin','manager','seller'))
       or (i.account_type::text='artist' and coalesce(u.raw_app_meta_data->>'role','') <> 'artist')
       or (i.account_type::text='client' and coalesce(u.raw_app_meta_data->>'role','') <> 'client');
  return query select 'AVISO', 'cuenta sin identidad en identity.users', u.email::text
    from auth.users u left join identity.users i on i.id=u.id where i.id is null;
end $$;
revoke execute on function public.mdj_auditar_identidad() from public, anon, authenticated;
grant execute on function public.mdj_auditar_identidad() to service_role;
-- (mdj_auditar_roles() vive en 20260921_auditoria_roles_bd.sql; llama a mdj_auditar_identidad())

-- ── OPERACIONES DE DATOS ya hechas en producción (NO se reejecutan; registro) ──
-- a) app_metadata.role asignado a 12 cuentas sin rol o con rol equivocado (artist: 9 · client: 3); DJ Alex y DJ Ary confirmados como artist por el PO.
-- b) 4 filas SOBRANTES de client_profiles (cuentas de artista/owner sin actividad) RESPALDADAS en public._respaldo_client_profiles_20260921 y borradas.
--    Restaurar: insert into public.client_profiles select <columnas> from public._respaldo_client_profiles_20260921;
-- c) dj_profiles.category de AHI NA MA (yuricabrera1930) = 'Música Latina · Salsa · Timba Cubana' (pedido del PO).
