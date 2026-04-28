-- Ledger DJ: solo gestión (admin | owner | manager), no seller.
-- Reemplaza políticas staff que usaban public.is_staff() por public.is_staff_management().
-- La política "DJs can view own ledger" (SELECT propio) no se modifica.
--
-- Nota sobre nombre de archivo: un timestamp 20260427150000 ejecutaría ANTES de la migración
-- que crea is_staff_management() y fallaría en installs limpios. Este archivo va después de
-- 20260430300000_is_staff_include_owner_role.sql.

ALTER TABLE public.dj_ledger ENABLE ROW LEVEL SECURITY;

-- Políticas staff anteriores (20260427140000): is_staff → management only
DROP POLICY IF EXISTS "Staff select dj_ledger" ON public.dj_ledger;
CREATE POLICY "Staff select dj_ledger"
  ON public.dj_ledger FOR SELECT TO authenticated
  USING (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS "Staff insert dj_ledger" ON public.dj_ledger;
CREATE POLICY "Staff insert dj_ledger"
  ON public.dj_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS "Staff update dj_ledger" ON public.dj_ledger;
CREATE POLICY "Staff update dj_ledger"
  ON public.dj_ledger FOR UPDATE TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

COMMENT ON POLICY "Staff select dj_ledger" ON public.dj_ledger IS
  'Gestión ve todas las filas del libro mayor (split operativo). Seller excluido por RLS.';

COMMENT ON POLICY "Staff insert dj_ledger" ON public.dj_ledger IS
  'Gestión crea líneas income/payout. Seller excluido por RLS.';

COMMENT ON POLICY "Staff update dj_ledger" ON public.dj_ledger IS
  'Gestión actualiza metadata (p. ej. split DJ/casa). Seller excluido por RLS.';

NOTIFY pgrst, 'reload schema';
