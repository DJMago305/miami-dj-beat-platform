-- 🔴 PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr). Aditivo e idempotente.
-- YA APLICADO en producción el 2026-10-02 por el PO y verificado (2 tablas con RLS, 6 políticas, is_venue_staff solo para authenticated).
-- Cliente Comercial, paso 3: datos propios de la empresa y vínculo cuenta <-> local (equipo del local).
-- Ver docs/tickets/2026-10-02-TICKET-cliente-comercial-facturacion-multiusuario.md y
-- docs/tickets/2026-10-02-TICKET-sala-de-mesas-fase-2-venta-sin-sobreventa.md.
-- Nada se crea desde la plantilla de artista: no toca dj_profiles.

-- ── Datos de la empresa (una fila por cuenta comercial; identificación fiscal y dirección del negocio) ──
create table if not exists public.commercial_company (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  legal_name    text,
  tax_id        text,
  address_line1 text,
  address_city  text,
  address_state text,
  address_zip   text,
  updated_at    timestamptz not null default now(),
  constraint commercial_company_largos check (
    char_length(coalesce(legal_name, ''))    <= 160 and
    char_length(coalesce(tax_id, ''))        <= 20  and
    char_length(coalesce(address_line1, '')) <= 200 and
    char_length(coalesce(address_city, ''))  <= 80  and
    char_length(coalesce(address_state, '')) <= 40  and
    char_length(coalesce(address_zip, ''))   <= 12
  )
);
alter table public.commercial_company enable row level security;

drop policy if exists commercial_company_select on public.commercial_company;
create policy commercial_company_select on public.commercial_company
  for select using (user_id = auth.uid() or public.is_staff(auth.uid()));

-- Solo una cuenta marcada como comercial puede crear su fila, y solo la suya.
drop policy if exists commercial_company_insert on public.commercial_company;
create policy commercial_company_insert on public.commercial_company
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.client_profiles c where c.user_id = auth.uid() and c.is_commercial)
  );

drop policy if exists commercial_company_update on public.commercial_company;
create policy commercial_company_update on public.commercial_company
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Equipo del local: todos los miembros con el mismo permiso (varias filas por local) ──
create table if not exists public.venue_staff (
  venue_id   uuid not null references public.venues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (venue_id, user_id)
);
create index if not exists idx_venue_staff_user on public.venue_staff (user_id);
alter table public.venue_staff enable row level security;

create or replace function public.is_venue_staff(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.venue_staff where venue_id = p_venue_id and user_id = auth.uid());
$$;
revoke all on function public.is_venue_staff(uuid) from public, anon;
grant execute on function public.is_venue_staff(uuid) to authenticated;

-- Ve las membresías: el staff de la plataforma, el propio miembro y sus compañeros del mismo local.
drop policy if exists venue_staff_select on public.venue_staff;
create policy venue_staff_select on public.venue_staff
  for select using (public.is_staff(auth.uid()) or user_id = auth.uid() or public.is_venue_staff(venue_id));

-- Por ahora solo el staff de la plataforma vincula cuentas con locales, y solo cuentas comerciales.
drop policy if exists venue_staff_insert on public.venue_staff;
create policy venue_staff_insert on public.venue_staff
  for insert with check (
    public.is_staff(auth.uid())
    and exists (select 1 from public.client_profiles c where c.user_id = venue_staff.user_id and c.is_commercial)
  );

drop policy if exists venue_staff_delete on public.venue_staff;
create policy venue_staff_delete on public.venue_staff
  for delete using (public.is_staff(auth.uid()));

-- Cómo vincular una cuenta comercial a su local (lo hace el PO hasta que exista la pantalla en staff-admin):
--   insert into public.venue_staff (venue_id, user_id, created_by)
--   select v.id, c.user_id, auth.uid() from public.venues v, public.client_profiles c
--    where v.slug = 'mojitos-calle-8' and c.email = 'correo-de-la-cuenta@ejemplo.com' and c.is_commercial;
