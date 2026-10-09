-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Especialistas en ventas visibles al público: UNA sola fuente de verdad para que Margi (y ELIXIS) sugieran
-- a un vendedor humano con su teléfono y correo cuando alguien quiere comprar y no sabe con quién hablar.
--   · Lectura: cualquiera (anon/authenticated) — SOLO filas activas y SOLO campos de contacto de negocio.
--   · Escritura: owner / admin / manager (is_staff_management).
--   · Primera fila: Wendy (contacto de ventas que dio el PO el 2026-10-09: wendy.miamidjbeat@gmail.com · (305) 423-5812).
begin;
set local lock_timeout = '5s';

create table if not exists public.sales_specialists (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  titulo_es  text not null default 'Especialista en ventas',
  titulo_en  text not null default 'Sales specialist',
  telefono   text not null,
  email      text not null,
  idiomas    text[] not null default array['es','en'],
  orden      int not null default 100,
  activo     boolean not null default true,
  user_id    uuid,
  creado_en  timestamptz not null default now()
);
comment on table public.sales_specialists is 'Contacto público de vendedores. Lo leen Margi (booth-chat + mdj-assistant.js) y ELIXIS. Solo datos de contacto de negocio.';
alter table public.sales_specialists enable row level security;

drop policy if exists sales_specialists_select_publico on public.sales_specialists;
create policy sales_specialists_select_publico on public.sales_specialists
  for select to anon, authenticated using (activo);

drop policy if exists sales_specialists_management_all on public.sales_specialists;
create policy sales_specialists_management_all on public.sales_specialists
  for all to authenticated
  using (public.is_staff_management(auth.uid()))
  with check (public.is_staff_management(auth.uid()));

revoke all on public.sales_specialists from anon, authenticated;
grant select on public.sales_specialists to anon, authenticated;
grant insert, update, delete on public.sales_specialists to authenticated;

insert into public.sales_specialists (nombre, telefono, email, orden, user_id)
select 'Wendy Ayala', '(305) 423-5812', 'wendy.miamidjbeat@gmail.com', 1, 'c07a065a-e096-4a39-ab68-44a8f59d8901'
where not exists (select 1 from public.sales_specialists where lower(email) = 'wendy.miamidjbeat@gmail.com');

-- Verificación: debe dar 1 fila activa (Wendy) y que anon pueda leerla
select nombre, titulo_es, titulo_en, telefono, email, activo from public.sales_specialists order by orden;
commit;
