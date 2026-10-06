-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- H2 · Esqueleto de Cliente Regular: perfil de cliente garantizado por el SERVIDOR + saneamiento de cuentas inconsistentes.
--
-- ⚠️ DESVÍO DELIBERADO DEL PEDIDO: aquí NO se activa un trigger AFTER INSERT en auth.users que inserte en client_profiles.
--    Motivo (verificado en el código): el registro de web/auth.js (≈línea 1354) hace él mismo `insert` en client_profiles y, si falla, LANZA
--    «No se pudo crear tu cuenta de cliente: …». Con el trigger, la fila ya existiría (client_profiles.user_id es UNIQUE) y CADA registro nuevo
--    de cliente mostraría ese error y perdería el resto del registro. La alternativa BEFORE INSERT «que absorbe el duplicado» rompería el
--    `upsert` de js/client-account.js (la edición del perfil dejaría de guardarse). Por eso la garantía del servidor va como RECONCILIACIÓN:
--    una función idempotente + un trabajo de pg_cron cada 10 minutos que crea la fila SOLO a cuentas de cliente con más de 10 min de antigüedad
--    que siguen sin perfil (navegador cerrado a mitad del registro). No compite con el insert inmediato del navegador. El trigger inmediato
--    queda escrito, COMENTADO, al final: se activa cuando auth.js tolere el duplicado (un cambio de una línea en otro hito).
--
-- Efectos secundarios a tener en cuenta (ya existentes en client_profiles, no los agrega este script):
--    · trg_notify_new_client → correo INTERNO «✨ Cuenta nueva — Cliente» al manager por cada fila nueva (también por el relleno de hoy: 1 correo).
--    · trg_mdjb_after_client / trg_sync_identity_client → generan el código MDJB y la identidad de la cuenta.
-- Idempotente: volver a correrlo no duplica nada.

-- ═══════════ 1) Función de reconciliación (solo ejecutable por postgres/service_role) ═══════════
create or replace function public.mdj_reconciliar_client_profiles(p_min_age_minutes integer default 10)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r record;
  m jsonb;
  n integer := 0;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data as meta
      from auth.users u
     where coalesce(u.raw_app_meta_data->>'role', '') = 'client'
       and u.created_at <= now() - make_interval(mins => greatest(coalesce(p_min_age_minutes, 10), 0))
       and not exists (select 1 from public.client_profiles c where c.user_id = u.id)
       and not exists (select 1 from public.dj_profiles d where d.user_id = u.id)
  loop
    begin
      m := coalesce(r.meta, '{}'::jsonb);
      insert into public.client_profiles
        (user_id, full_name, email, phone, city, address_street, address_apt, address_state, address_zip, address_country, source_ref, discount_eligible)
      values (
        r.id,
        coalesce(nullif(btrim(m->>'full_name'), ''), nullif(split_part(coalesce(r.email, ''), '@', 1), ''), 'Cliente'),
        r.email,
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
      if found then n := n + 1; end if;
    exception when others then
      raise warning 'mdj_reconciliar_client_profiles: % -> %', r.id, sqlerrm;   -- una cuenta con problema no frena a las demás
    end;
  end loop;
  return n;
end;
$function$;

revoke all on function public.mdj_reconciliar_client_profiles(integer) from public, anon, authenticated;

-- ═══════════ 2) Saneamiento de cuentas inconsistentes (solo metadatos NO autoritativos + 1 fila faltante) ═══════════
-- 2a) Relleno: la cuenta de cliente activa sin perfil (pe***@gmail.com, id 18edae5d-…) y cualquier otra igual. Edad mínima 0: aplica ya.
select public.mdj_reconciliar_client_profiles(0) as perfiles_de_cliente_creados;

-- 2b) ar***@icloud.com (4bf2cf75-…): rol de servidor «client» + solo fila de client_profiles, pero declaró user_type «talent» al registrarse.
--     user_type lo escribe el propio usuario y NO manda (si hay rol de servidor se ignora): se alinea con lo que la cuenta realmente es.
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('user_type', 'client')
 where id = '4bf2cf75-9e4f-49b0-8b30-b8b0a9986da4'::uuid
   and coalesce(raw_app_meta_data->>'role', '') = 'client'
   and lower(coalesce(raw_user_meta_data->>'user_type', '')) = 'talent'
   and not exists (select 1 from public.dj_profiles d where d.user_id = auth.users.id)
   and exists (select 1 from public.client_profiles c where c.user_id = auth.users.id);

-- 2c) yu***@gmail.com (741a2a8a-…): rol de servidor «artist» + fila real de dj_profiles (rol dj), pero declaró user_type «client».
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('user_type', 'talent')
 where id = '741a2a8a-138a-4c5b-9ed2-6e9e522c07f6'::uuid
   and coalesce(raw_app_meta_data->>'role', '') = 'artist'
   and lower(coalesce(raw_user_meta_data->>'user_type', '')) = 'client'
   and exists (select 1 from public.dj_profiles d where d.user_id = auth.users.id);

-- (No se toca a we***@gmail.com — vendedora con fila de client_profiles —: staff manda sobre cualquier otra fila.)

-- ═══════════ 3) Trabajo programado: reconciliación cada 10 minutos (quitar con: select cron.unschedule('mdj-reconciliar-client-profiles');) ═══════════
select cron.schedule('mdj-reconciliar-client-profiles', '*/10 * * * *', $cron$select public.mdj_reconciliar_client_profiles(10)$cron$);

-- ═══════════ 4) TRIGGER INMEDIATO — NO ACTIVAR HASTA QUE auth.js TOLERE EL DUPLICADO (ver el aviso de arriba) ═══════════
-- create or replace function public.mdj_crear_client_profile_al_registrarse() returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $f$
-- begin
--   if coalesce(new.raw_app_meta_data->>'role','') = 'client' then
--     begin
--       insert into public.client_profiles (user_id, full_name, email, discount_eligible)
--       values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''), nullif(split_part(coalesce(new.email,''),'@',1),''), 'Cliente'), new.email, true)
--       on conflict (user_id) do nothing;
--     exception when others then raise warning 'mdj_crear_client_profile_al_registrarse: %', sqlerrm;   -- nunca bloquea el registro
--     end;
--   end if;
--   return new;
-- end $f$;
-- create trigger trg_mdj_client_profile_al_registrarse after insert on auth.users for each row execute function public.mdj_crear_client_profile_al_registrarse();

-- ═══════════ 5) COMPROBACIÓN (solo lectura): todo en UNA fila. Esperado: cuentas=15, sin_clasificar=0, inconsistentes=0, trigger_roles=1, funcion=true, cron=true, rls=true ═══════════
with base as (
  select u.id, lower(coalesce(d.role, '')) as dj_role, coalesce(u.raw_app_meta_data->>'role', '') as app_role,
         lower(coalesce(u.raw_user_meta_data->>'user_type', '')) as ut, (c.user_id is not null) as tiene_cliente, (d.user_id is not null) as tiene_dj
    from auth.users u
    left join public.dj_profiles d on d.user_id = u.id
    left join public.client_profiles c on c.user_id = u.id),
clas as (
  select *, case
      when dj_role in ('admin', 'owner', 'manager', 'seller') then 'staff'
      when tiene_dj and app_role = 'artist' then 'artista'
      when not tiene_dj and app_role = 'client' then 'cliente'
      else 'sin_clasificar' end as categoria
    from base),
chk as (
  select *, case
      when categoria = 'staff'   then app_role = dj_role
      when categoria = 'artista' then ut in ('talent', 'dj', 'artist', '')
      when categoria = 'cliente' then tiene_cliente and ut = 'client'
      else false end as consistente
    from clas)
select (select count(*) from chk)                                          as cuentas,
       (select count(*) from chk where categoria = 'staff')                as staff,
       (select count(*) from chk where categoria = 'artista')              as artistas,
       (select count(*) from chk where categoria = 'cliente')              as clientes,
       (select count(*) from chk where categoria = 'sin_clasificar')       as sin_clasificar,
       (select count(*) from chk where not consistente)                    as inconsistentes,
       (select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'trg_mdj_rol_al_registrarse' and not tgisinternal) as trigger_roles,
       (to_regprocedure('public.mdj_reconciliar_client_profiles(integer)') is not null) as funcion,
       exists (select 1 from cron.job where jobname = 'mdj-reconciliar-client-profiles') as cron,
       (select relrowsecurity from pg_class where oid = 'public.client_profiles'::regclass) as rls,
       (select string_agg(policyname || ':' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'client_profiles') as politicas_rls;
