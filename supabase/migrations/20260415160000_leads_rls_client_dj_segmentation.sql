-- TOTAL-FREEDOM: isolate leads by role — clients by email, DJs by assigned dj_profiles row, admins full access.
-- Public inserts (forms, booth) remain allowed for anon + authenticated.
-- SECURITY DEFINER RPCs (e.g. mdj_public_search_event_teasers) are unchanged.

ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', pol);
  END LOOP;
END $$;

-- INSERT: marketing / booth / contact forms (anon + logged-in prospects)
CREATE POLICY "leads_insert_anon"
  ON public.leads FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "leads_insert_authenticated"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (true);

-- SELECT: booking owner (email on file matches JWT email)
CREATE POLICY "leads_select_client_email"
  ON public.leads FOR SELECT TO authenticated
  USING (
    coalesce(trim(email), '') <> ''
    AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

-- SELECT: assigned DJ (assigned_dj_id references dj_profiles.id, not auth.users)
CREATE POLICY "leads_select_assigned_dj"
  ON public.leads FOR SELECT TO authenticated
  USING (
    assigned_dj_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.dj_profiles dj
      WHERE dj.id = leads.assigned_dj_id
        AND dj.user_id = auth.uid()
    )
  );

-- SELECT: platform staff
CREATE POLICY "leads_select_admin"
  ON public.leads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dj_profiles dj
      WHERE dj.user_id = auth.uid()
        AND coalesce(dj.role, '') IN ('admin', 'manager')
    )
  );

-- UPDATE: same boundaries as SELECT for clients and DJs
CREATE POLICY "leads_update_client_email"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    coalesce(trim(email), '') <> ''
    AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
  WITH CHECK (
    coalesce(trim(email), '') <> ''
    AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

CREATE POLICY "leads_update_assigned_dj"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    assigned_dj_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.dj_profiles dj
      WHERE dj.id = leads.assigned_dj_id
        AND dj.user_id = auth.uid()
    )
  )
  WITH CHECK (
    assigned_dj_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.dj_profiles dj
      WHERE dj.id = leads.assigned_dj_id
        AND dj.user_id = auth.uid()
    )
  );

CREATE POLICY "leads_update_admin"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dj_profiles dj
      WHERE dj.user_id = auth.uid()
        AND coalesce(dj.role, '') IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dj_profiles dj
      WHERE dj.user_id = auth.uid()
        AND coalesce(dj.role, '') IN ('admin', 'manager')
    )
  );

COMMENT ON TABLE public.leads IS
  'RLS: clients see rows where email matches JWT; DJs see assigned leads; admins/managers see all; anon/authenticated INSERT for public forms.';

NOTIFY pgrst, 'reload schema';
