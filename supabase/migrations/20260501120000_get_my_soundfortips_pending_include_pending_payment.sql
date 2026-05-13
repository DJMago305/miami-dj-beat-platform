-- Cabina: incluir pending_payment (Stripe Checkout abierto o webhook aún no corrido).
-- Sin esto la grilla parece vacía aunque exista fila en soundfortips_fan_requests.

DROP FUNCTION IF EXISTS public.get_my_soundfortips_pending_requests();

CREATE FUNCTION public.get_my_soundfortips_pending_requests()
RETURNS TABLE (
  id uuid,
  sender_label text,
  song text,
  artist text,
  tip_usd numeric,
  poster_url text,
  created_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fr.id,
    fr.sender_label,
    fr.song,
    fr.artist,
    fr.tip_usd,
    fr.poster_url,
    fr.created_at,
    fr.status::text
  FROM public.soundfortips_fan_requests fr
  WHERE fr.dj_user_id = (SELECT auth.uid())
    AND (
      fr.status IN ('paid_pending_acceptance', 'manual_pending_verification')
      OR (
        fr.status = 'pending_payment'
        AND fr.payment_channel = 'stripe'
        AND fr.created_at >= (now() - interval '3 days')
      )
    )
  ORDER BY fr.created_at ASC;
$$;

COMMENT ON FUNCTION public.get_my_soundfortips_pending_requests() IS
  'Cabina: manual + pagado Stripe + pending_payment (Stripe en curso, últimos 3 días). Devuelve status para UI. Sin PII.';

REVOKE ALL ON FUNCTION public.get_my_soundfortips_pending_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_soundfortips_pending_requests() TO authenticated;

NOTIFY pgrst, 'reload schema';
