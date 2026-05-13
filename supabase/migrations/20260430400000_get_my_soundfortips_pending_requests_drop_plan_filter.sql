-- Cabina: listar peticiones pendientes aunque dj_soundfortips_plan_ok falle a la par en edge cases
-- (migraciones / desalineación). el DJ solo ve fr.dj_user_id = auth.uid();
-- el alta ya validó plan en register-sft-fan-request / create-sft-tip-checkout.

CREATE OR REPLACE FUNCTION public.get_my_soundfortips_pending_requests()
RETURNS TABLE (
  id uuid,
  sender_label text,
  song text,
  artist text,
  tip_usd numeric,
  poster_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.id, fr.sender_label, fr.song, fr.artist, fr.tip_usd, fr.poster_url, fr.created_at
  FROM public.soundfortips_fan_requests fr
  WHERE fr.dj_user_id = (SELECT auth.uid())
    AND fr.status IN ('paid_pending_acceptance', 'manual_pending_verification')
  ORDER BY fr.created_at ASC;
$$;

COMMENT ON FUNCTION public.get_my_soundfortips_pending_requests() IS
  'Cabina: paid_pending_acceptance o manual_pending_verification para auth.uid() = DJ. Sin filtro plan_ok (validación al insertar).';

GRANT EXECUTE ON FUNCTION public.get_my_soundfortips_pending_requests() TO authenticated;

NOTIFY pgrst, 'reload schema';
