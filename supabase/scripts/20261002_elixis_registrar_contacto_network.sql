-- 🔴 PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr). Aditivo e idempotente: solo agrega una función nueva.
-- YA APLICADO en producción el 2026-10-02 y probado: duplicado por teléfono (Anexis), alta nueva (fila de prueba
-- borrada), duplicado por correo contra clientes, y rechazo de un usuario que no es staff.
-- ELIXIS: herramienta registrar_contacto_network -> alta de un contacto sin cuenta en el Network
-- (public.network_referencia_contactos), con revisión de duplicados por teléfono/correo.
-- Solo service_role puede ejecutarla (la llama elixis-chat después de verificar que quien habla es staff).

create or replace function public.agent_network_contact_create(
  p_staff_user_id uuid,
  p_nombre        text,
  p_telefono      text default null,
  p_email         text default null,
  p_empresa       text default null,
  p_notas         text default null,
  p_agent_id      text default 'elixis'
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nombre  text := btrim(coalesce(p_nombre, ''));
  v_tel     text := nullif(btrim(coalesce(p_telefono, '')), '');
  v_email   text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_empresa text := nullif(btrim(coalesce(p_empresa, '')), '');
  v_notas   text := nullif(btrim(coalesce(p_notas, '')), '');
  v_digits  text;
  v_last10  text;
  v_dup_id  text;
  v_dup_nom text;
  v_dup_src text;
  v_id      uuid;
begin
  if p_staff_user_id is null then
    raise exception 'network_contact_invalid_args';
  end if;
  if not exists (
    select 1 from public.dj_profiles
    where user_id = p_staff_user_id and role in ('admin', 'owner', 'manager', 'seller')
  ) then
    raise exception 'network_contact_not_staff';
  end if;
  if v_nombre = '' or char_length(v_nombre) > 200 then
    raise exception 'network_contact_invalid_name';
  end if;
  if v_tel is null and v_email is null then
    raise exception 'network_contact_need_phone_or_email';
  end if;
  if v_tel is not null and char_length(v_tel) > 40 then
    raise exception 'network_contact_invalid_phone';
  end if;
  if v_email is not null and (char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'network_contact_invalid_email';
  end if;
  if v_empresa is not null and char_length(v_empresa) > 200 then
    raise exception 'network_contact_invalid_company';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'network_contact_invalid_notes';
  end if;

  v_digits := regexp_replace(coalesce(v_tel, ''), '\D', '', 'g');
  v_last10 := case when char_length(v_digits) >= 7 then right(v_digits, 10) else null end;
  if v_tel is not null and v_last10 is null then
    raise exception 'network_contact_invalid_phone';
  end if;

  -- Duplicado por teléfono (últimos 10 dígitos) o por correo, en las tres fuentes del Network.
  select x.id, x.nombre, x.fuente into v_dup_id, v_dup_nom, v_dup_src from (
    select id::text as id, nombre, 'contacto_referencia'::text as fuente,
           regexp_replace(coalesce(telefono, ''), '\D', '', 'g') as dig, lower(coalesce(email, '')) as em
      from public.network_referencia_contactos
    union all
    select id::text, full_name, 'cliente',
           regexp_replace(coalesce(phone, ''), '\D', '', 'g'), lower(coalesce(email, ''))
      from public.client_profiles
    union all
    select id::text, coalesce(nullif(stage_name, ''), full_name), 'artista_o_staff',
           regexp_replace(coalesce(phone, ''), '\D', '', 'g'), lower(coalesce(email, ''))
      from public.dj_profiles
  ) x
  where (v_last10 is not null and right(x.dig, 10) = v_last10 and char_length(x.dig) >= 7)
     or (v_email is not null and x.em = v_email)
  limit 1;

  if v_dup_id is not null then
    return jsonb_build_object('status', 'duplicado', 'fuente', v_dup_src, 'id', v_dup_id, 'nombre', v_dup_nom);
  end if;

  insert into public.network_referencia_contactos (nombre, telefono, email, empresa, notas, origen_csv, created_by)
  values (v_nombre, v_tel, v_email, v_empresa, v_notas,
          'ELIXIS ' || to_char(now() at time zone 'America/New_York', 'YYYY-MM-DD'), p_staff_user_id)
  returning id into v_id;

  return jsonb_build_object('status', 'creado', 'id', v_id::text, 'nombre', v_nombre);
end;
$$;

revoke all on function public.agent_network_contact_create(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.agent_network_contact_create(uuid, text, text, text, text, text, text) to service_role;
