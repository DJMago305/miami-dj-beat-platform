-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-08-28
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Cablea la campana de notificaciones (#mdj-notif-bell) con los pedidos de
-- merch: el número de la campana NO debe borrarse hasta que un miembro de
-- staff realmente vea el pedido (abrir "Pedidos" en el sidebar), no solo
-- porque cambió de estado. Por eso es un campo de lectura aparte de
-- `status` (pending_fulfillment/shipped/etc. sigue siendo el estado de
-- despacho; `is_read` es si alguien ya lo vio).
-- ============================================================

alter table public.merch_orders
  add column if not exists is_read boolean not null default false;

create index if not exists merch_orders_is_read_idx on public.merch_orders (is_read) where is_read = false;
