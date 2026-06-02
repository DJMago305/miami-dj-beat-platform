-- RPC: cliente crea su propio lead desde el Event Builder (rentals.html)
-- SECURITY DEFINER → bypass RLS; la función valida que el UID sea el del caller.

CREATE OR REPLACE FUNCTION public.mdj_client_create_event_lead(
    p_event_type   text    DEFAULT 'Event',
    p_notes        text    DEFAULT '{}',
    p_total_amount numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid   uuid;
    v_email text;
    v_id    uuid;
BEGIN
    -- Caller must be authenticated
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Pull email from JWT
    v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));

    INSERT INTO public.leads (
        client_user_id,
        email,
        event_type,
        status,
        notes,
        total_amount
    ) VALUES (
        v_uid,
        NULLIF(v_email, ''),
        COALESCE(NULLIF(trim(p_event_type), ''), 'Event'),
        'new',
        p_notes,
        p_total_amount
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- Only authenticated users can call this RPC
REVOKE ALL ON FUNCTION public.mdj_client_create_event_lead FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_client_create_event_lead TO authenticated;

COMMENT ON FUNCTION public.mdj_client_create_event_lead IS
'Permite a un cliente autenticado crear su propio lead desde el Event Builder (rentals.html). SECURITY DEFINER: no requiere INSERT RLS en leads.';

NOTIFY pgrst, 'reload schema';
