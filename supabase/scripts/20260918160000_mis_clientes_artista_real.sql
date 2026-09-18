-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-18
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO ("abre 'mis
-- clientes' a datos reales")
-- ============================================================
--
-- Ticket: "Mis clientes" (vista Artista de la Base de clientes) era 100% de
-- mentira -- CLIENTS.push() local, un refresh lo perdía. Solo la vista Owner
-- ("Base de clientes · Matrix") era real, porque get_master_calendar_events()
-- tiene una guardia explícita de "solo staff", y dj_client_affiliation_
-- modificar() la misma -- un artista normal ni siquiera podía LEER de vuelta
-- lo que intentara guardar.
--
-- Diseño: un artista solo debe ver/editar SUS PROPIOS clientes (las filas de
-- dj_client_affiliations donde dj_id = su propio dj_profiles.id) -- nunca la
-- vista consolidada de todos los artistas, que sigue siendo exclusiva de
-- staff. Dos piezas nuevas + un hallazgo de seguridad cerrado de paso:
--
-- 🔴 HALLAZGO, cerrado en el mismo script: find_or_create_master_client(p_dj_id, ...)
-- y dj_client_affiliation_modificar(p_dj_id, ...) reciben p_dj_id como
-- parámetro SIN validar que pertenezca a quien llama -- hoy es inofensivo
-- porque solo la vista Owner (staff) las invoca, pero abrir "Mis clientes" a
-- artistas significa que a partir de ahora se llaman desde una sesión menos
-- confiable. Ambas quedan con la misma regla: staff puede actuar sobre
-- cualquier dj_id (como hasta hoy), un artista normal SOLO sobre el suyo.

-- ── 1) find_or_create_master_client: dj_id debe ser el propio, salvo staff ──
create or replace function public.find_or_create_master_client(
  p_dj_id uuid,
  p_phone text default null,
  p_email text default null,
  p_name text default null,
  p_birthday date default null,
  p_wedding_anniversary date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  return v_id;
end;
$$;
grant execute on function public.find_or_create_master_client(uuid, text, text, text, date, date) to authenticated;

-- ── 2) dj_client_affiliation_modificar: mismo criterio (propio o staff) ────
create or replace function public.dj_client_affiliation_modificar(
  p_master_client_id uuid,
  p_dj_id            uuid,
  p_accion           text,
  p_estado           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_accion text := lower(trim(coalesce(p_accion, '')));
begin
  if not (
    exists (select 1 from public.dj_profiles where user_id = auth.uid() and role in ('owner','admin','manager','seller'))
    or exists (select 1 from public.dj_profiles where user_id = auth.uid() and id = p_dj_id)
  ) then
    raise exception 'forbidden: solo puedes modificar tu propia base de clientes';
  end if;

  if v_accion not in ('desactivar', 'reactivar', 'actualizar_estado') then
    raise exception 'accion_invalida';
  end if;
  if p_estado is not null and p_estado not in ('Potencial','Activo','VIP') then
    raise exception 'estado_invalido';
  end if;

  select id into v_id from public.dj_client_affiliations
   where master_client_id = p_master_client_id and dj_id = p_dj_id;

  if v_id is null then
    raise exception 'afiliacion_no_encontrada';
  end if;

  if v_accion = 'desactivar' then
    update public.dj_client_affiliations set active = false where id = v_id;
  elsif v_accion = 'reactivar' then
    update public.dj_client_affiliations set active = true where id = v_id;
  else
    update public.dj_client_affiliations set estado = p_estado where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.dj_client_affiliation_modificar(uuid, uuid, text, text) from public;
revoke all on function public.dj_client_affiliation_modificar(uuid, uuid, text, text) from anon;
grant execute on function public.dj_client_affiliation_modificar(uuid, uuid, text, text) to authenticated;

-- ── 3) get_my_calendar_events(): equivalente de get_master_calendar_events, ─
-- pero acotado a UN solo dj_id -- el del propio artista que llama. Mismas
-- columnas de salida (mismo shape que ya consume loadClientDates() del
-- lado del calendario), dj_ids/dj_names quedan como arreglo de 1 elemento
-- (el propio artista) -- no se expone con quién más está afiliado ese
-- cliente, un artista no necesita saber eso de otro.
create or replace function public.get_my_calendar_events()
returns table (
  master_client_id uuid,
  client_name      text,
  client_phone     text,
  estado           text,
  event_type       text,
  event_date       date,
  dj_ids           uuid[],
  dj_names         text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dj_id uuid;
  v_dj_nombre text;
begin
  select id, coalesce(dj_name, stage_name, full_name) into v_dj_id, v_dj_nombre
    from public.dj_profiles where user_id = auth.uid() limit 1;

  if v_dj_id is null then
    raise exception 'forbidden: se requiere un perfil de artista para leer tu propia base de clientes';
  end if;

  return query
    select
      mc.id, mc.name, mc.normalized_phone, dca.estado,
      'birthday'::text, mc.birthday,
      array[dca.dj_id], array[v_dj_nombre]
    from public.master_clients mc
    join public.dj_client_affiliations dca on dca.master_client_id = mc.id and dca.active = true and dca.dj_id = v_dj_id
    where mc.birthday is not null

    union all

    select
      mc.id, mc.name, mc.normalized_phone, dca.estado,
      'wedding_anniversary'::text, mc.wedding_anniversary,
      array[dca.dj_id], array[v_dj_nombre]
    from public.master_clients mc
    join public.dj_client_affiliations dca on dca.master_client_id = mc.id and dca.active = true and dca.dj_id = v_dj_id
    where mc.wedding_anniversary is not null;
end;
$$;
grant execute on function public.get_my_calendar_events() to authenticated;

notify pgrst, 'reload schema';
