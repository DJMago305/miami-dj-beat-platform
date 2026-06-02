-- Miami DJ Beat — Portal Messages (client ↔ manager chat per event lead)
-- Applies to: client-portal.js initChat / handleChatMessage (real-time).
-- RLS: client reads/inserts own lead messages; staff reads/inserts any lead.

CREATE TABLE IF NOT EXISTS public.portal_messages (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     uuid NOT NULL,          -- references leads.id (no FK: leads table may vary)
    sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_role text NOT NULL DEFAULT 'client', -- 'client' | 'manager'
    body        text NOT NULL CHECK (char_length(trim(body)) > 0),
    is_read     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_msg_lead ON public.portal_messages (lead_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_portal_msg_sender ON public.portal_messages (sender_id);

COMMENT ON TABLE public.portal_messages IS
    'Client ↔ manager chat messages scoped to an event lead. Real-time enabled.';

ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

-- Client: read messages on leads they own
DROP POLICY IF EXISTS "portal_msg_client_select" ON public.portal_messages;
CREATE POLICY "portal_msg_client_select"
    ON public.portal_messages FOR SELECT TO authenticated
    USING (
        lead_id IN (
            SELECT id FROM public.leads WHERE client_user_id = auth.uid()
        )
    );

-- Client: insert own messages only (sender_id must match, role must be 'client')
DROP POLICY IF EXISTS "portal_msg_client_insert" ON public.portal_messages;
CREATE POLICY "portal_msg_client_insert"
    ON public.portal_messages FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND sender_role = 'client'
        AND lead_id IN (
            SELECT id FROM public.leads WHERE client_user_id = auth.uid()
        )
    );

-- Staff: read all messages
DROP POLICY IF EXISTS "portal_msg_staff_select" ON public.portal_messages;
CREATE POLICY "portal_msg_staff_select"
    ON public.portal_messages FOR SELECT TO authenticated
    USING (public.is_staff(auth.uid()));

-- Staff: insert as manager
DROP POLICY IF EXISTS "portal_msg_staff_insert" ON public.portal_messages;
CREATE POLICY "portal_msg_staff_insert"
    ON public.portal_messages FOR INSERT TO authenticated
    WITH CHECK (
        public.is_staff(auth.uid())
        AND sender_id = auth.uid()
        AND sender_role = 'manager'
    );

-- Staff: mark messages as read
DROP POLICY IF EXISTS "portal_msg_staff_update" ON public.portal_messages;
CREATE POLICY "portal_msg_staff_update"
    ON public.portal_messages FOR UPDATE TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

-- Client: mark own messages as read
DROP POLICY IF EXISTS "portal_msg_client_update" ON public.portal_messages;
CREATE POLICY "portal_msg_client_update"
    ON public.portal_messages FOR UPDATE TO authenticated
    USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.portal_messages TO authenticated;

-- Enable Supabase Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_messages;

NOTIFY pgrst, 'reload schema';
