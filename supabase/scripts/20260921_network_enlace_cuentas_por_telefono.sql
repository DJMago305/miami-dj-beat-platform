-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Enlaza cada contacto de Network con SU cuenta (auth.users) por TELÉFONO (últimos 10 dígitos).
-- Reglas: solo si el teléfono coincide con UNA sola cuenta (si hay 2+, se deja sin enlazar); nunca pisa un enlace 'manual';
-- si el teléfono cambia y el enlace era automático, se recalcula. No modifica ninguna cuenta ni el resto de datos del contacto.
alter table public.network_referencia_contactos
  add column if not exists cuenta_user_id uuid references auth.users(id) on delete set null,
  add column if not exists cuenta_enlazada_por text check (cuenta_enlazada_por in ('telefono','manual')),
  add column if not exists cuenta_enlazada_en timestamptz;
create index if not exists network_ref_contactos_cuenta_idx on public.network_referencia_contactos(cuenta_user_id) where cuenta_user_id is not null;

create or replace function public.network_tel10(p text) returns text language sql immutable as $$
  select case when length(regexp_replace(coalesce(p,''),'\D','','g')) >= 10 then right(regexp_replace(p,'\D','','g'),10) end
$$;

-- Cuenta única con ese teléfono (perfil de artista o de cliente). NULL si no hay o si hay más de una.
create or replace function public.network_cuenta_por_telefono(p text) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  with t as (select public.network_tel10(p) t),
  c as (
    select user_id from public.dj_profiles, t where t.t is not null and public.network_tel10(phone) = t.t
    union select user_id from public.client_profiles, t where t.t is not null and public.network_tel10(phone) = t.t
  )
  select case when (select count(*) from c) = 1 then (select user_id from c) end
$$;
revoke execute on function public.network_cuenta_por_telefono(text) from public, anon, authenticated;

create or replace function public.network_contacto_enlazar_trg() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(new.cuenta_enlazada_por,'') = 'manual' then return new; end if;
  new.cuenta_user_id := public.network_cuenta_por_telefono(new.telefono);
  new.cuenta_enlazada_por := case when new.cuenta_user_id is null then null else 'telefono' end;
  new.cuenta_enlazada_en := case when new.cuenta_user_id is null then null else now() end;
  return new;
end $$;
drop trigger if exists trg_network_contacto_enlazar on public.network_referencia_contactos;
create trigger trg_network_contacto_enlazar before insert or update of telefono on public.network_referencia_contactos
  for each row execute function public.network_contacto_enlazar_trg();

-- Repaso completo (para cuentas creadas DESPUÉS del contacto). Devuelve cuántos contactos quedaron enlazados por teléfono.
create or replace function public.network_enlazar_cuentas() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  update public.network_referencia_contactos c
     set cuenta_user_id = x.uid, cuenta_enlazada_por = case when x.uid is null then null else 'telefono' end,
         cuenta_enlazada_en = case when x.uid is null then null else coalesce(c.cuenta_enlazada_en, now()) end
    from (select id, public.network_cuenta_por_telefono(telefono) uid from public.network_referencia_contactos
           where coalesce(cuenta_enlazada_por,'') <> 'manual') x
   where c.id = x.id and c.cuenta_user_id is distinct from x.uid;
  select count(*) into n from public.network_referencia_contactos where cuenta_enlazada_por = 'telefono';
  return n;
end $$;
revoke execute on function public.network_enlazar_cuentas() from public, anon, authenticated;
grant execute on function public.network_enlazar_cuentas() to service_role;

select public.network_enlazar_cuentas();
select cron.schedule('network_enlazar_cuentas_diario', '50 6 * * *', $c$select public.network_enlazar_cuentas()$c$);
