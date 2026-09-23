-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Evaluación del cliente sobre su evento: Mal/Regular/Bueno/Excelente + opinión libre.
-- A pedido del PO 2026-09-22: "otro camino" distinto a las 5 estrellas públicas de
-- dj_public_reviews -- esto es privado, solo para que el equipo sepa cómo le fue
-- con el DJ o el trabajo en general en CADA evento, no una vitrina de marketing.
-- Mismo espíritu de inmutabilidad que public.libro_incidentes (R14): insert-only,
-- nadie -- ni el propio cliente -- puede releer o editar su envío.
-- Ancla: public.leads (tiene client_user_id + assigned_dj_id + event_completed_at),
-- NO public.dj_events (esa es solo agenda del DJ, sin cliente vinculado).

create table if not exists public.evaluaciones_cliente (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null unique references public.leads(id) on delete cascade,
  client_user_id  uuid not null references auth.users(id),
  dj_user_id      uuid references auth.users(id),
  calificacion    text not null check (calificacion in ('mal', 'regular', 'bueno', 'excelente')),
  opinion         text,
  created_at      timestamptz not null default now()
);

comment on table public.evaluaciones_cliente is
  'Evaluación privada del cliente sobre su evento (Mal/Regular/Bueno/Excelente + opinión). Insert-only -- separado de dj_public_reviews (público, 5 estrellas).';

alter table public.evaluaciones_cliente enable row level security;

-- Nadie tiene INSERT/UPDATE/DELETE directo -- todo pasa por la función de abajo.
revoke all on public.evaluaciones_cliente from public, anon, authenticated;
grant select on public.evaluaciones_cliente to authenticated;

-- SELECT: solo staff. El cliente NUNCA puede releer su propia evaluación
-- (mismo principio que R14/R15: una foto honesta del momento, no algo para revisar/inflar después).
create policy evaluaciones_cliente_select_staff on public.evaluaciones_cliente
  for select to authenticated
  using (public.is_staff(auth.uid()));

-- Marcador visible para el cliente en `leads` (mutable, ya es una tabla operativa
-- con muchos campos que staff actualiza) -- así el cliente ve en su propia lista
-- de eventos cuáles ya calificó, SIN necesitar leer evaluaciones_cliente.
alter table public.leads add column if not exists evaluado_en timestamptz;

create or replace function public.evaluar_evento_cliente(
  p_lead_id      uuid,
  p_calificacion text,
  p_opinion      text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lead        public.leads%rowtype;
  v_dj_user_id  uuid;
  v_id          uuid;
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if p_calificacion not in ('mal', 'regular', 'bueno', 'excelente') then
    raise exception 'calificación inválida';
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then raise exception 'evento no encontrado'; end if;
  if v_lead.client_user_id is distinct from auth.uid() then raise exception 'ese evento no es tuyo'; end if;
  if v_lead.event_completed_at is null then raise exception 'el evento todavía no ha terminado'; end if;

  if v_lead.assigned_dj_id is not null then
    select user_id into v_dj_user_id from public.dj_profiles where id = v_lead.assigned_dj_id;
  end if;

  insert into public.evaluaciones_cliente (lead_id, client_user_id, dj_user_id, calificacion, opinion)
  values (p_lead_id, auth.uid(), v_dj_user_id, p_calificacion, nullif(trim(coalesce(p_opinion, '')), ''))
  returning id into v_id;

  update public.leads set evaluado_en = now() where id = p_lead_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'ya evaluaste este evento';
end $$;

revoke all on function public.evaluar_evento_cliente(uuid, text, text) from public, anon;
grant execute on function public.evaluar_evento_cliente(uuid, text, text) to authenticated;
