-- Staff (is_staff): lectura e ingreso / actualización de dj_ledger para registrar metadata.split
-- sin usar SQL manual desde el panel (requiere políticas más allá de "solo fila propia").

ALTER TABLE public.dj_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff select dj_ledger" ON public.dj_ledger;
CREATE POLICY "Staff select dj_ledger"
  ON public.dj_ledger FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert dj_ledger" ON public.dj_ledger;
CREATE POLICY "Staff insert dj_ledger"
  ON public.dj_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update dj_ledger" ON public.dj_ledger;
CREATE POLICY "Staff update dj_ledger"
  ON public.dj_ledger FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

COMMENT ON POLICY "Staff select dj_ledger" ON public.dj_ledger IS
  'Staff ve todas las filas del libro mayor (split operativo).';

COMMENT ON POLICY "Staff insert dj_ledger" ON public.dj_ledger IS
  'Staff puede crear líneas income/payout para DJs (requiere acuerdo interno).';

COMMENT ON POLICY "Staff update dj_ledger" ON public.dj_ledger IS
  'Staff puede actualizar metadata (p. ej. split DJ/casa).';

NOTIFY pgrst, 'reload schema';
