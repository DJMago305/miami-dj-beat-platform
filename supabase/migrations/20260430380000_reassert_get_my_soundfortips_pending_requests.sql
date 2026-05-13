-- Reaseguración: la cabina usa get_my_soundfortips_pending_requests con status IN
-- (paid_pending_acceptance, manual_pending_verification). Si en producción quedó la
-- versión antigua (status = 'pending'), no se listan filas nuevas tras soundfortips_status_lifecycle.
-- Idempotente: vuelve a publicar la misma definición que 20260430370000.

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
    AND public.dj_soundfortips_plan_ok((SELECT auth.uid()))
  ORDER BY fr.created_at ASC;
$$;

COMMENT ON FUNCTION public.get_my_soundfortips_pending_requests() IS
  'Cabina: filas donde el DJ debe decidir (pagado Stripe o manual pendiente verificación). Reasegurado 2026-04-30.';

GRANT EXECUTE ON FUNCTION public.get_my_soundfortips_pending_requests() TO authenticated;

NOTIFY pgrst, 'reload schema';
