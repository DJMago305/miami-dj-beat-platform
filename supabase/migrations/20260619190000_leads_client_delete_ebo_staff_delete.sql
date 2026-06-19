-- TICKET-MIGRATION-RLS-LEADS
-- Adds missing DELETE policies:
--   1) Clients can delete their own leads (email OR client_user_id match)
--   2) Staff management can delete any EBO (needed for staff-side cascade)
--   3) Clients can delete their own EBO (portalDeleteLead cascade)
-- Applied: 2026-06-19

-- ── 1) leads: client DELETE ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "leads_delete_client" ON public.leads;
CREATE POLICY "leads_delete_client"
  ON public.leads FOR DELETE TO authenticated
  USING (
    (
      coalesce(trim(email), '') <> ''
      AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
    OR (client_user_id IS NOT NULL AND client_user_id = auth.uid())
  );

-- ── 2) leads: staff management DELETE (admin/owner/manager can delete any lead) ─
DROP POLICY IF EXISTS "leads_delete_staff_mgmt" ON public.leads;
CREATE POLICY "leads_delete_staff_mgmt"
  ON public.leads FOR DELETE TO authenticated
  USING (public.is_staff_management(auth.uid()));

-- ── 3) event_builder_orders: client DELETE own EBO ───────────────────────────
-- (ebo_owner_rw covers FOR ALL = includes DELETE, but only when user_id matches)
-- This explicit policy covers leads where user_id may be null but lead owner matches
DROP POLICY IF EXISTS "ebo_client_delete_own" ON public.event_builder_orders;
CREATE POLICY "ebo_client_delete_own"
  ON public.event_builder_orders FOR DELETE TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
        AND (
          l.client_user_id = auth.uid()
          OR lower(trim(coalesce(l.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
    )
  );

-- ── 4) event_builder_orders: staff management DELETE any EBO ─────────────────
DROP POLICY IF EXISTS "ebo_staff_mgmt_delete" ON public.event_builder_orders;
CREATE POLICY "ebo_staff_mgmt_delete"
  ON public.event_builder_orders FOR DELETE TO authenticated
  USING (public.is_staff_management(auth.uid()));

NOTIFY pgrst, 'reload schema';
