-- Miami DJ Beat — Assigned staff per lead + portal chat routing
-- Adds leads.assigned_staff_id (who handles the event: owner | manager | seller).
-- Updates portal_messages RLS: assigned staff sees only their leads' chats.

-- ── 1) Columna en leads ───────────────────────────────────────────────────────

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS assigned_staff_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_staff_name text;

COMMENT ON COLUMN public.leads.assigned_staff_id IS
    'Staff member handling this event (owner / manager / seller). Drives portal chat routing.';

COMMENT ON COLUMN public.leads.assigned_staff_name IS
    'Display name of the assigned staff member (cached for UI).';

-- ── 2) Update portal_messages RLS for staff routing ──────────────────────────
-- Replace the broad "is_staff sees all" with scoped access:
--   a) Assigned staff sees messages for their own leads
--   b) Management (owner/admin/manager) sees everything
--   c) Sellers only see their assigned leads

DROP POLICY IF EXISTS "portal_msg_staff_select" ON public.portal_messages;
CREATE POLICY "portal_msg_staff_select"
    ON public.portal_messages FOR SELECT TO authenticated
    USING (
        -- Management sees all
        public.is_staff_management(auth.uid())
        OR
        -- Assigned staff (seller) sees only their assigned lead's messages
        (
            public.is_staff(auth.uid())
            AND lead_id IN (
                SELECT id FROM public.leads WHERE assigned_staff_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "portal_msg_staff_insert" ON public.portal_messages;
CREATE POLICY "portal_msg_staff_insert"
    ON public.portal_messages FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND sender_role = 'manager'
        AND (
            public.is_staff_management(auth.uid())
            OR (
                public.is_staff(auth.uid())
                AND lead_id IN (
                    SELECT id FROM public.leads WHERE assigned_staff_id = auth.uid()
                )
            )
        )
    );

-- ── 3) RPC: assign staff to a lead (management only) ─────────────────────────
DROP FUNCTION IF EXISTS public.mdj_assign_staff_to_lead(uuid, uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.mdj_assign_staff_to_lead(
    p_lead_id       uuid,
    p_staff_user_id uuid,
    p_staff_name    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name text;
BEGIN
    IF NOT public.is_staff_management(auth.uid()) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'management_only');
    END IF;

    -- Resolve display name if not provided
    IF p_staff_name IS NULL OR trim(p_staff_name) = '' THEN
        SELECT COALESCE(dp.stage_name, au.email)
          INTO v_name
          FROM auth.users au
          LEFT JOIN public.dj_profiles dp ON dp.user_id = au.id
         WHERE au.id = p_staff_user_id;
    ELSE
        v_name := trim(p_staff_name);
    END IF;

    UPDATE public.leads
       SET assigned_staff_id   = p_staff_user_id,
           assigned_staff_name = v_name
     WHERE id = p_lead_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found');
    END IF;

    RETURN jsonb_build_object('ok', true, 'assigned_staff_name', v_name);
END;
$$;

REVOKE ALL ON FUNCTION public.mdj_assign_staff_to_lead(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_assign_staff_to_lead(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.mdj_assign_staff_to_lead(uuid, uuid, text) IS
    'Management-only: assign a staff member (owner/manager/seller) to a lead. Drives portal chat routing.';

NOTIFY pgrst, 'reload schema';
