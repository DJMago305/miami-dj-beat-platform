-- Remove permissive policy that effectively allowed full table access under RLS
-- (policies are combined with OR; USING (true) negates row isolation).
-- Service role and edge functions using the service key bypass RLS; no replacement policy needed.

DROP POLICY IF EXISTS "System full access" ON public.dj_ledger;

-- Tighten: only authenticated users, own rows only
DROP POLICY IF EXISTS "DJs can view own ledger" ON public.dj_ledger;
CREATE POLICY "DJs can view own ledger"
ON public.dj_ledger
FOR SELECT
TO authenticated
USING (auth.uid() = dj_user_id);

NOTIFY pgrst, 'reload schema';
