-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Ticket "PERSISTENCIA DE PEDIDOS
-- DE MERCH EN STRIPE WEBHOOK" (2026-09-01).
--
-- AJUSTE REAL, verificado antes de escribir nada: public.merch_orders YA
-- EXISTE (de una sesión anterior, junto con create-merch-checkout) -- tiene
-- 1 fila real de una compra de prueba (2026-08-28) y su propio esquema real:
-- subtotal_cents/tax_cents/total_cents/status (con CHECK y DEFAULT
-- 'paid_pending_fulfillment'), no las columnas que proponía el ticket
-- (amount_total/payment_status/fulfillment_status). Esta migración NO
-- recrea la tabla -- solo agrega las políticas RLS que nunca se aplicaron:
-- RLS estaba activo pero con CERO políticas, así que ni el propio owner
-- podía leerla desde un cliente (solo service_role, vía el webhook).

DROP POLICY IF EXISTS merch_orders_select_owner_admin ON public.merch_orders;
CREATE POLICY merch_orders_select_owner_admin
  ON public.merch_orders
  FOR SELECT
  TO authenticated
  USING (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS merch_orders_update_owner_admin ON public.merch_orders;
CREATE POLICY merch_orders_update_owner_admin
  ON public.merch_orders
  FOR UPDATE
  TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

COMMENT ON POLICY merch_orders_select_owner_admin ON public.merch_orders IS
  'owner/admin/manager (is_staff_management): lectura total de pedidos de merch.';
COMMENT ON POLICY merch_orders_update_owner_admin ON public.merch_orders IS
  'owner/admin/manager: puede actualizar (ej. marcar fulfillment) -- INSERT sigue siendo solo service_role, vía el webhook.';

-- Nada para anon/authenticated fuera de esto -- exactamente lo que pedía el
-- ticket ("sin acceso directo de lectura/escritura pública").

NOTIFY pgrst, 'reload schema';
