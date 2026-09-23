-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- R14 "El libro de incidentes, inmutable" (docs/roadmap/master-map.json)
-- Registro permanente de incidentes y reportes de facturación por evento, reportados
-- por el propio artista. Nadie -- ni el autor, ni staff, ni el propio owner -- puede
-- actualizar o borrar una fila ya guardada. Conservación mínima 5 años (política, no
-- hay borrado automático en el código).
-- Verificado con JWT simulado 2026-09-22: insert vía función OK; insert/update/delete
-- directos bloqueados para todos; SELECT solo para staff; el artista ve 0 filas
-- (incluida la suya) al consultar la tabla directamente.

create table if not exists public.libro_incidentes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id),
  dj_event_id     uuid references public.dj_events(id),
  tipo            text not null check (tipo in ('incidente', 'facturacion')),
  descripcion     text not null check (char_length(trim(descripcion)) > 0),
  monto_reportado numeric(10,2) check (monto_reportado is null or monto_reportado >= 0),
  created_at      timestamptz not null default now()
);

alter table public.libro_incidentes enable row level security;

-- Nadie tiene INSERT/UPDATE/DELETE directo -- todo pasa por la función de abajo.
revoke all on public.libro_incidentes from public, anon, authenticated;
grant select on public.libro_incidentes to authenticated;  -- la política de abajo decide qué filas ve cada quien

-- SELECT: solo staff (para R16, la vista de lectura del equipo). El artista NUNCA
-- puede leer esta tabla, ni siquiera su propia fila (a propósito, ver R15).
create policy libro_incidentes_select_staff on public.libro_incidentes
  for select to authenticated
  using (public.is_staff(auth.uid()));

-- Única vía de entrada: función SECURITY DEFINER, solo inserta, nunca actualiza/borra.
create or replace function public.libro_incidentes_reportar(
  p_dj_event_id uuid,
  p_tipo text,
  p_descripcion text,
  p_monto_reportado numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if p_tipo not in ('incidente','facturacion') then raise exception 'tipo inválido'; end if;
  if p_dj_event_id is not null and not exists (
    select 1 from public.dj_events where id = p_dj_event_id and dj_user_id = auth.uid()
  ) then
    raise exception 'ese evento no es tuyo';
  end if;
  insert into public.libro_incidentes (user_id, dj_event_id, tipo, descripcion, monto_reportado)
  values (auth.uid(), p_dj_event_id, p_tipo, p_descripcion, p_monto_reportado)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.libro_incidentes_reportar(uuid, text, text, numeric) from public, anon;
grant execute on function public.libro_incidentes_reportar(uuid, text, text, numeric) to authenticated;
