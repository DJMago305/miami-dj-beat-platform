-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- ─────────────────────────────────────────────────────────────────────────────
-- Wrappers SECURITY DEFINER sobre supabase_vault para guardar/leer la
-- contraseña específica de aplicación de Apple/iCloud (CalDAV). El esquema
-- `vault` no está expuesto vía PostgREST, así que las Edge Functions
-- (calendar-caldav-connect, futuro calendar-caldav-sync) necesitan estas
-- funciones en `public` para poder llamarlas con `.rpc()` usando el service
-- role key. Ningún usuario autenticado normal puede ejecutarlas -- el EXECUTE
-- se revoca de PUBLIC/authenticated/anon y se concede solo a service_role.
--
-- Ya se verificó que supabase_vault (v0.3.1) está instalado y funcional en
-- este proyecto (prueba hecha y revertida el 2026-09-19).

create or replace function public.calendar_caldav_guardar_password(p_password text, p_nombre text default null)
returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_password is null or length(trim(p_password)) = 0 then
    raise exception 'password_vacio';
  end if;
  v_id := vault.create_secret(
    p_password,
    coalesce(p_nombre, 'caldav_password_' || gen_random_uuid()::text),
    'Contraseña de aplicación CalDAV (Apple/iCloud Calendar)'
  );
  return v_id;
end;
$$;

revoke all on function public.calendar_caldav_guardar_password(text, text) from public;
grant execute on function public.calendar_caldav_guardar_password(text, text) to service_role;

create or replace function public.calendar_caldav_actualizar_password(p_secret_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  if p_password is null or length(trim(p_password)) = 0 then
    raise exception 'password_vacio';
  end if;
  perform vault.update_secret(p_secret_id, p_password);
end;
$$;

revoke all on function public.calendar_caldav_actualizar_password(uuid, text) from public;
grant execute on function public.calendar_caldav_actualizar_password(uuid, text) to service_role;

create or replace function public.calendar_caldav_leer_password(p_secret_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_password text;
begin
  select decrypted_secret into v_password from vault.decrypted_secrets where id = p_secret_id;
  return v_password;
end;
$$;

revoke all on function public.calendar_caldav_leer_password(uuid) from public;
grant execute on function public.calendar_caldav_leer_password(uuid) to service_role;
