-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- ─────────────────────────────────────────────────────────────────────────────
-- "Mis clientes" (master_clients, usado desde la Agenda de cada DJ/artista) y
-- la base de Network (network_referencia_contactos, staff-admin.html) se
-- construyeron en momentos distintos y nunca se conectaron -- un cliente
-- guardado por un DJ nunca aparecía en la base central de Network ni recibía
-- categoría. Confirmado en vivo el 2026-09-20 con "Mildrey Sotelo": existía
-- solo en master_clients, cero coincidencias en network_referencia_contactos
-- ni client_profiles.
--
-- Esta migración conecta ambos automáticamente: cada vez que
-- find_or_create_master_client crea o actualiza un cliente, se refleja en
-- Network (dedup por teléfono/email, mismo criterio de últimos 10 dígitos
-- que ya usa el dedup de Network en staff-admin.html/_networkNormPhones) y
-- se etiqueta con la lista "Cliente". Solo rellena campos vacíos, nunca
-- sobrescribe -- mismo principio que network_referencia_fusionar.
--
-- Regla explícita del PO (2026-09-20): el cumpleaños/aniversario SOLO se
-- traslada a Network si el DJ lo guardó de verdad -- nunca un valor por
-- defecto. Esto es relevante porque el formulario de "Nuevo cliente" traía
-- un <input type="date" value="2026-08-15"> fijo (ver calendario-
-- operacional-inteligente.html) -- si el DJ no lo tocaba, ese valor de
-- mentira se guardaba como si fuera real. Se corrige aparte en el HTML
-- (quitar el value fijo); esta función ya asume que birthday puede venir
-- NULL legítimamente y nunca inventa una fecha si no hay una.

create or replace function public.master_client_sincronizar_network(p_master_client_id uuid, p_dj_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mc record;
  v_phone_10 text;
  v_ref_id uuid;
  v_lista_cliente_id uuid;
  v_dj_nombre text;
  v_dj_user uuid;
begin
  select * into v_mc from public.master_clients where id = p_master_client_id;
  if v_mc is null then return null; end if;

  -- Origen: qué DJ trajo este cliente, para que ELIXIS pueda recomendar a
  -- ese DJ cuando el contacto salga de su calendario/base.
  if p_dj_id is not null then
    select coalesce(nullif(trim(stage_name),''), nullif(trim(dj_name),''), nullif(trim(full_name),'')), user_id into v_dj_nombre, v_dj_user
      from public.dj_profiles where id = p_dj_id;
  end if;

  v_phone_10 := nullif(right(regexp_replace(coalesce(v_mc.normalized_phone, ''), '\D', '', 'g'), 10), '');

  -- Si el teléfono/email ya pertenece a una cuenta REAL (cliente o DJ), no se
  -- crea un duplicado en Network: esa persona ya aparece con su ficha real
  -- (caso Wendy E Ayala, 2026-09-20). Un DJ que guarda un cliente no debe
  -- modificar el perfil de otra cuenta, así que aquí simplemente se omite.
  if exists (
    select 1 from public.client_profiles c
     where (v_phone_10 is not null and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = v_phone_10)
        or (v_mc.normalized_email is not null and lower(trim(c.email)) = v_mc.normalized_email)
  ) or exists (
    select 1 from public.dj_profiles d
     where (v_phone_10 is not null and right(regexp_replace(coalesce(d.phone, ''), '\D', '', 'g'), 10) = v_phone_10)
        or (v_mc.normalized_email is not null and lower(trim(d.email)) = v_mc.normalized_email)
  ) then
    return null;
  end if;

  -- Coincidencia por teléfono (últimos 10 dígitos) o email exacto -- NUNCA
  -- por nombre solo (regla de la sesión: mismo nombre no implica misma
  -- persona sin teléfono/email real compartido).
  select id into v_ref_id from public.network_referencia_contactos
    where (v_phone_10 is not null and right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 10) = v_phone_10)
       or (v_mc.normalized_email is not null and lower(trim(email)) = v_mc.normalized_email)
    limit 1;

  if v_ref_id is null then
    insert into public.network_referencia_contactos (nombre, telefono, email, birth_date, origen_csv, origen_persona_id, origen_persona_nombre)
    values (coalesce(nullif(trim(v_mc.name), ''), v_mc.normalized_email, v_mc.normalized_phone, 'Sin nombre'), v_mc.normalized_phone, v_mc.normalized_email, v_mc.birthday, 'mis_clientes_dj', v_dj_user, v_dj_nombre)
    returning id into v_ref_id;
  else
    update public.network_referencia_contactos set
      nombre = coalesce(nombre, v_mc.name),
      telefono = coalesce(telefono, v_mc.normalized_phone),
      email = coalesce(email, v_mc.normalized_email),
      birth_date = coalesce(birth_date, v_mc.birthday)
    where id = v_ref_id;
  end if;

  select id into v_lista_cliente_id from public.network_lists where name = 'Cliente' limit 1;
  if v_lista_cliente_id is not null then
    insert into public.network_list_members (list_id, fuente, contacto_id)
    values (v_lista_cliente_id, 'referencia', v_ref_id)
    on conflict (list_id, fuente, contacto_id) do nothing;
  end if;

  return v_ref_id;
end;
$$;

revoke all on function public.master_client_sincronizar_network(uuid, uuid) from public;
grant execute on function public.master_client_sincronizar_network(uuid, uuid) to authenticated, service_role;

-- find_or_create_master_client: se agrega UNA línea (perform ... antes del
-- return) -- el resto de la función queda idéntico a como estaba.
create or replace function public.find_or_create_master_client(p_dj_id uuid, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_birthday date DEFAULT NULL::date, p_wedding_anniversary date DEFAULT NULL::date)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email,''))), '');
  v_id uuid;
begin
  if not (
    exists (select 1 from public.dj_profiles where user_id = auth.uid() and role in ('owner','admin','manager','seller'))
    or exists (select 1 from public.dj_profiles where user_id = auth.uid() and id = p_dj_id)
  ) then
    raise exception 'forbidden: solo puedes registrar clientes para tu propio perfil';
  end if;

  if v_phone is null and v_email is null then
    raise exception 'find_or_create_master_client requiere teléfono o email.';
  end if;

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

  perform public.master_client_sincronizar_network(v_id, p_dj_id);

  return v_id;
end;
$function$;

-- Backfill: los 3 clientes que ya existían en master_clients antes de esta
-- migración (incluida Mildrey Sotelo) también deben quedar reflejados en
-- Network ahora mismo, no solo los nuevos de aquí en adelante.
do $$
declare
  v_row record;
begin
  for v_row in select mc.id, (select a.dj_id from public.dj_client_affiliations a where a.master_client_id = mc.id order by a.created_at nulls last limit 1) as dj_id from public.master_clients mc loop
    perform public.master_client_sincronizar_network(v_row.id, v_row.dj_id);
  end loop;
end;
$$;

-- CORRECCIÓN 2026-09-20: solo la llama find_or_create_master_client (SECURITY DEFINER) y el
-- backend; sin chequeo de auth propio, no debe ser ejecutable por anon/authenticated.
revoke execute on function public.master_client_sincronizar_network(uuid, uuid) from anon, authenticated;
