-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-08-27
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Registra los pedidos reales de "Shopping Miami DJ Beat" (merch nativo,
-- reemplaza la tienda Shopify "Plan A" — ver memoria del proyecto
-- "project_shop_plan_a_retired_native_shopping").
--
-- Diseño deliberado: UNA sola fila por pedido, escrita por el webhook de
-- Stripe SOLO cuando el pago se confirma (checkout.session.completed).
-- No existe un INSERT previo al pago — un carrito abandonado no genera
-- fila. El carrito ya viaja re-precificado y validado en la metadata de
-- la sesión de Stripe (ver create-merch-checkout), así que el webhook no
-- necesita otra llamada a la API de Stripe para reconstruirlo.
-- ============================================================

create table if not exists public.merch_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  items jsonb not null,
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'usd',
  customer_name text,
  customer_email text,
  customer_phone text,
  shipping_address jsonb,
  status text not null default 'paid_pending_fulfillment'
    check (status in ('paid_pending_fulfillment', 'shipped', 'cancelled', 'refunded')),
  fulfilled_at timestamptz,
  fulfilled_by uuid
);

create index if not exists merch_orders_status_idx on public.merch_orders (status);

alter table public.merch_orders enable row level security;

-- Solo staff (mismo predicado que get_master_calendar_events / demás RPCs de esta fase)
-- puede leer o actualizar (marcar enviado/cancelado). El webhook escribe con
-- service_role, que ignora RLS — no hace falta política de INSERT para clientes.
create policy "merch_orders_staff_select" on public.merch_orders
  for select
  using (
    exists (
      select 1 from public.dj_profiles
      where dj_profiles.user_id = auth.uid()
        and dj_profiles.role in ('owner', 'admin', 'manager', 'seller')
    )
  );

create policy "merch_orders_staff_update" on public.merch_orders
  for update
  using (
    exists (
      select 1 from public.dj_profiles
      where dj_profiles.user_id = auth.uid()
        and dj_profiles.role in ('owner', 'admin', 'manager', 'seller')
    )
  );
