-- TICKET: staff-order Save — staff management can INSERT new EBO rows
-- Root cause: ebo_staff_mgmt_update covers UPDATE only; no INSERT policy for staff.
-- Fix: allow is_staff_management to INSERT into event_builder_orders.

DROP POLICY IF EXISTS "ebo_staff_mgmt_insert" ON public.event_builder_orders;
CREATE POLICY "ebo_staff_mgmt_insert"
  ON public.event_builder_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

NOTIFY pgrst, 'reload schema';
