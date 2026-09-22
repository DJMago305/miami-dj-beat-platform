-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr) — YA APLICADO el 2026-09-21 (versión vigente).
-- Auditoría de roles/contenedores EN LA BASE. Devuelve una fila por problema (vacío = sano). Solo lectura.
-- Uso: select * from public.mdj_auditar_roles();   (solo service_role / postgres / staff)
-- Depende de: public.mdj_auditar_identidad() (20260921_roles_servidor_categorias_idiomas.sql) y de las columnas de Network (20260921_network_enlace_cuentas_por_telefono.sql).
create or replace function public.mdj_auditar_roles()
returns table(gravedad text, problema text, detalle text)
language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if auth.uid() is not null and not public.is_staff(auth.uid()) then raise exception 'solo staff'; end if;
  return query select 'GRAVE', 'cuenta sin rol de servidor', u.email::text from auth.users u where coalesce(u.raw_app_meta_data->>'role','') = '';
  return query select 'GRAVE', 'rol client pero con fila de artista', u.email::text from auth.users u join public.dj_profiles d on d.user_id=u.id where u.raw_app_meta_data->>'role'='client';
  return query select 'GRAVE', 'rol artist sin fila en dj_profiles', u.email::text from auth.users u left join public.dj_profiles d on d.user_id=u.id where u.raw_app_meta_data->>'role'='artist' and d.user_id is null;
  return query select 'GRAVE', 'rol no reconocido', (u.email||' → '||(u.raw_app_meta_data->>'role'))::text from auth.users u where coalesce(u.raw_app_meta_data->>'role','') not in ('','client','artist','owner','admin','manager','seller');
  return query select 'GRAVE', 'staff en dj_profiles sin rol de staff en el token', u.email::text from auth.users u join public.dj_profiles d on d.user_id=u.id where lower(d.role) in ('admin','owner','manager','seller') and coalesce(u.raw_app_meta_data->>'role','') <> lower(d.role);
  return query select 'AVISO', 'cuenta con perfil de artista Y de cliente', u.email::text from auth.users u join public.dj_profiles d on d.user_id=u.id join public.client_profiles c on c.user_id=u.id where coalesce(u.raw_app_meta_data->>'role','') not in ('owner','admin','manager','seller');
  return query select 'AVISO', 'Network dice ARTISTA pero la cuenta es cliente', (n.nombre||' → '||u.email)::text from public.network_referencia_contactos n join auth.users u on u.id=n.cuenta_user_id where n.origen_csv ilike '%artista%' and u.raw_app_meta_data->>'role'='client';
  return query select 'AVISO', 'Network dice CLIENTE pero la cuenta es artista', (n.nombre||' → '||u.email)::text from public.network_referencia_contactos n join auth.users u on u.id=n.cuenta_user_id where n.origen_csv ilike '%cliente%' and u.raw_app_meta_data->>'role'='artist';
  return query select * from public.mdj_auditar_identidad();
  if (select count(*) from pg_policies where schemaname='public' and tablename='dj_profiles' and cmd='INSERT') <> 1
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='dj_profiles' and cmd='INSERT' and with_check ilike '%app_metadata%') then
    return query select 'GRAVE', 'INSERT en dj_profiles', 'debe haber UNA política que exija rol artist/staff';
  end if;
  if pg_get_functiondef('public.user_role()'::regprocedure) not ilike '%''client''%' then
    return query select 'GRAVE', 'user_role()', 'el valor por defecto ya no es client';
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_mdj_rol_al_registrarse') then
    return query select 'GRAVE', 'alta de cuentas', 'falta el trigger que asigna rol al registrarse';
  end if;
end $$;
revoke execute on function public.mdj_auditar_roles() from public, anon, authenticated;
grant execute on function public.mdj_auditar_roles() to service_role;
