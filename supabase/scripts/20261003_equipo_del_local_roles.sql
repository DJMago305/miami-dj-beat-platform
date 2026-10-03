-- 🔴 PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr). Aditivo e idempotente.
-- YA APLICADO en producción el 2026-10-03 por el PO y verificado (rol, un dueño por local, 6 funciones, 4 políticas; probado antes con rollback).
-- Equipo del local con roles (decisión del PO, 2026-10-03):
--   dueño   = la PRIMERA cuenta vinculada al local. Es la única que crea y quita al equipo. Edita la plantilla de mesas y
--             sillas, ve disponibilidad, vende entradas y hace reservaciones.
--   manager = edita la plantilla de mesas y sillas, ve disponibilidad, vende entradas y hace reservaciones.
--   equipo  = ve disponibilidad y vende entradas / reserva con el método de pago de la empresa.
-- Requiere 20261002_cliente_comercial_empresa_y_locales.sql y 20261003_cliente_comercial_solo_owner_admin.sql (ya aplicados).

-- ── Rol en cada vínculo ──
alter table public.venue_staff add column if not exists role text not null default 'team';
alter table public.venue_staff drop constraint if exists venue_staff_role_check;
alter table public.venue_staff add constraint venue_staff_role_check check (role in ('owner', 'manager', 'team'));

-- La primera cuenta vinculada de cada local pasa a ser su dueño (idempotente: solo si el local aún no tiene dueño).
update public.venue_staff s
   set role = 'owner'
 where s.role = 'team'
   and not exists (select 1 from public.venue_staff o where o.venue_id = s.venue_id and o.role = 'owner')
   and s.created_at = (select min(m.created_at) from public.venue_staff m where m.venue_id = s.venue_id);

-- Un solo dueño por local.
create unique index if not exists venue_staff_un_dueno_por_local on public.venue_staff (venue_id) where role = 'owner';

-- ── Qué puede hacer cada rol (las pantallas de la fase 2 usan estas funciones) ──
create or replace function public.venue_role(p_venue_id uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select role from public.venue_staff where venue_id = p_venue_id and user_id = auth.uid();
$$;
create or replace function public.is_venue_owner(p_venue_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.venue_role(p_venue_id) = 'owner', false);
$$;
create or replace function public.can_manage_venue_layout(p_venue_id uuid)   -- editar plantilla de mesas y sillas
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.venue_role(p_venue_id) in ('owner', 'manager'), false);
$$;
create or replace function public.can_sell_venue(p_venue_id uuid)            -- ver disponibilidad, vender entradas y reservar
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.venue_role(p_venue_id) in ('owner', 'manager', 'team'), false);
$$;
revoke all on function public.venue_role(uuid), public.is_venue_owner(uuid), public.can_manage_venue_layout(uuid), public.can_sell_venue(uuid) from public, anon;
grant execute on function public.venue_role(uuid), public.is_venue_owner(uuid), public.can_manage_venue_layout(uuid), public.can_sell_venue(uuid) to authenticated;

-- ── Políticas de venue_staff con roles ──
-- Ver: Owner/admin de la plataforma, la propia fila, y el dueño y los managers ven a todo el equipo de su local.
drop policy if exists venue_staff_select on public.venue_staff;
create policy venue_staff_select on public.venue_staff
  for select using (public.is_platform_admin(auth.uid()) or user_id = auth.uid() or public.can_manage_venue_layout(venue_id));

-- Vincular: solo Owner/admin de la plataforma (el alta de equipo la hace la función venue-team-invite con clave de servicio,
-- después de comprobar que quien llama es el dueño). Solo cuentas comerciales.
drop policy if exists venue_staff_insert on public.venue_staff;
create policy venue_staff_insert on public.venue_staff
  for insert with check (
    public.is_platform_admin(auth.uid())
    and exists (select 1 from public.client_profiles c where c.user_id = venue_staff.user_id and c.is_commercial)
  );

-- Quitar: Owner/admin de la plataforma, o el dueño del local a su manager/equipo (nunca al dueño).
drop policy if exists venue_staff_delete on public.venue_staff;
create policy venue_staff_delete on public.venue_staff
  for delete using (
    public.is_platform_admin(auth.uid())
    or (public.is_venue_owner(venue_id) and role <> 'owner')
  );

-- Cambiar el rol: solo Owner/admin de la plataforma.
drop policy if exists venue_staff_update on public.venue_staff;
create policy venue_staff_update on public.venue_staff
  for update using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));

-- ── Lista del equipo con nombre y correo (client_profiles solo deja ver la fila propia) ──
create or replace function public.venue_team(p_venue_id uuid)
returns table (user_id uuid, role text, full_name text, email text, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select s.user_id, s.role, c.full_name, c.email, s.created_at
    from public.venue_staff s
    left join public.client_profiles c on c.user_id = s.user_id
   where s.venue_id = p_venue_id
     and (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(p_venue_id))
   order by case s.role when 'owner' then 0 when 'manager' then 1 else 2 end, s.created_at;
$$;
revoke all on function public.venue_team(uuid) from public, anon;
grant execute on function public.venue_team(uuid) to authenticated;

-- ── Para la función venue-team-invite (solo clave de servicio): ¿ya existe una cuenta con este correo? ──
create or replace function public.mdj_auth_user_id_by_email(p_email text)
returns uuid language sql stable security definer set search_path to 'public', 'auth' as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
$$;
revoke all on function public.mdj_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.mdj_auth_user_id_by_email(text) to service_role;
