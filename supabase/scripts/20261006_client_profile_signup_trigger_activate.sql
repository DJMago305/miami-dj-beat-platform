-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- H2b · TRIGGER INMEDIATO: al registrarse una cuenta con rol de servidor 'client', el SERVIDOR crea su fila en public.client_profiles.
--
-- ⚠️ ORDEN DE DESPLIEGUE (obligatorio): correr este SQL SOLO DESPUÉS de que el PR que cambia web/auth.js esté FUSIONADO Y DESPLEGADO.
--    Antes de ese cambio, el registro del navegador inserta él mismo en client_profiles y, si la fila ya existe (client_profiles.user_id es UNIQUE),
--    lanza «No se pudo crear tu cuenta de cliente»: con este trigger activo y el auth.js viejo, CADA registro nuevo de cliente fallaría.
--    Con el auth.js nuevo (upsert por user_id) el registro ya NO falla y, además, COMPLETA la fila mínima del trigger con teléfono, dirección y source_ref.
--
-- Qué hace: AFTER INSERT en auth.users (corre después de trg_mdj_rol_al_registrarse, que fija app_metadata.role) → si el rol es 'client',
--    inserta (ON CONFLICT DO NOTHING) la fila con los mismos campos que el registro guarda en user_metadata. Nunca bloquea el registro: cualquier error
--    se convierte en aviso. NO crea fila a artistas ni a staff. La reconciliación de 10 minutos (script 20261006_client_profile_server_trigger.sql)
--    queda como red de seguridad. Efecto ya existente: trg_notify_new_client manda 1 correo INTERNO «Cuenta nueva — Cliente» al manager.
-- Idempotente: volver a correrlo no duplica nada.
create or replace function public.mdj_crear_client_profile_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(new.raw_app_meta_data->>'role', '') = 'client' then
    begin
      insert into public.client_profiles
        (user_id, full_name, email, phone, city, address_street, address_apt, address_state, address_zip, address_country, source_ref, discount_eligible)
      values (
        new.id,
        coalesce(nullif(btrim(m->>'full_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Cliente'),
        new.email,
        nullif(btrim(m->>'phone'), ''),
        nullif(btrim(coalesce(m->>'addr_city', m->>'city')), ''),
        nullif(btrim(m->>'address_street'), ''),
        nullif(btrim(m->>'address_apt'), ''),
        nullif(btrim(m->>'address_state'), ''),
        nullif(btrim(m->>'address_zip'), ''),
        nullif(btrim(m->>'address_country'), ''),
        nullif(btrim(m->>'source_ref'), ''),
        true
      )
      on conflict (user_id) do nothing;
    exception when others then
      raise warning 'mdj_crear_client_profile_al_registrarse: % -> %', new.id, sqlerrm;   -- nunca bloquea el registro
    end;
  end if;
  return new;
end;
$function$;

revoke all on function public.mdj_crear_client_profile_al_registrarse() from public, anon, authenticated;

drop trigger if exists trg_mdj_client_profile_al_registrarse on auth.users;
create trigger trg_mdj_client_profile_al_registrarse
  after insert on auth.users
  for each row execute function public.mdj_crear_client_profile_al_registrarse();

-- Comprobación (solo lectura). Esperado: trigger=true, funcion=true, rol_antes=true (el de roles sigue y es previo), clientes_sin_perfil=0
select exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'trg_mdj_client_profile_al_registrarse' and not tgisinternal) as trigger,
       (to_regprocedure('public.mdj_crear_client_profile_al_registrarse()') is not null)                                                       as funcion,
       exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'trg_mdj_rol_al_registrarse' and not tgisinternal) as rol_antes,
       (select count(*) from auth.users u
         where coalesce(u.raw_app_meta_data->>'role', '') = 'client'
           and not exists (select 1 from public.client_profiles c where c.user_id = u.id)
           and not exists (select 1 from public.dj_profiles d where d.user_id = u.id))                                                         as clientes_sin_perfil;
