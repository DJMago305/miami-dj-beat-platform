-- 🔴 PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr). Idempotente.
-- YA APLICADO en producción el 2026-10-03 por el PO y verificado (función solo para authenticated, 4 políticas con is_platform_admin; la pantalla de Equipo sigue funcionando como Owner).
-- Decisión del PO (2026-10-03): vincular cuentas comerciales con locales y leer los datos fiscales de las empresas
-- (EIN, dirección) es SOLO del Owner y del admin. Antes valía cualquier staff de la plataforma (incluidos manager y
-- seller, p. ej. la vendedora). Reemplaza las políticas de 20261002_cliente_comercial_empresa_y_locales.sql que usaban is_staff().

create or replace function public.is_platform_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.dj_profiles d
     where d.user_id = p_uid and lower(trim(coalesce(d.role, ''))) in ('admin', 'owner')
  );
$$;
revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated;

-- Datos de la empresa: la propia cuenta, o Owner/admin.
drop policy if exists commercial_company_select on public.commercial_company;
create policy commercial_company_select on public.commercial_company
  for select using (user_id = auth.uid() or public.is_platform_admin(auth.uid()));

-- Equipo del local: Owner/admin, el propio miembro y sus compañeros del mismo local.
drop policy if exists venue_staff_select on public.venue_staff;
create policy venue_staff_select on public.venue_staff
  for select using (public.is_platform_admin(auth.uid()) or user_id = auth.uid() or public.is_venue_staff(venue_id));

-- Vincular / quitar: solo Owner/admin, y solo cuentas comerciales.
drop policy if exists venue_staff_insert on public.venue_staff;
create policy venue_staff_insert on public.venue_staff
  for insert with check (
    public.is_platform_admin(auth.uid())
    and exists (select 1 from public.client_profiles c where c.user_id = venue_staff.user_id and c.is_commercial)
  );

drop policy if exists venue_staff_delete on public.venue_staff;
create policy venue_staff_delete on public.venue_staff
  for delete using (public.is_platform_admin(auth.uid()));
