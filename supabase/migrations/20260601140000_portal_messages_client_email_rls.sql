-- Client chat: mismo acceso que leads (email JWT O client_user_id)
-- Sin esto, el cliente ve el portal por email pero INSERT en portal_messages falla en silencio.

DROP POLICY IF EXISTS "portal_msg_client_select" ON public.portal_messages;
CREATE POLICY "portal_msg_client_select"
    ON public.portal_messages FOR SELECT TO authenticated
    USING (
        lead_id IN (
            SELECT id FROM public.leads
            WHERE client_user_id = auth.uid()
               OR (
                    coalesce(trim(email), '') <> ''
                    AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
               )
        )
    );

DROP POLICY IF EXISTS "portal_msg_client_insert" ON public.portal_messages;
CREATE POLICY "portal_msg_client_insert"
    ON public.portal_messages FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND sender_role = 'client'
        AND lead_id IN (
            SELECT id FROM public.leads
            WHERE client_user_id = auth.uid()
               OR (
                    coalesce(trim(email), '') <> ''
                    AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
               )
        )
    );

NOTIFY pgrst, 'reload schema';
