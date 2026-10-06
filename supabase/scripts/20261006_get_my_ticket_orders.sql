-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- «Mis Tickets / Mesas Reservadas» del portal del cliente (client-portal.html).
-- venue_ticket_orders NO tiene user_id (se compra como invitado, con el correo que se escribe en Stripe) y solo el staff la puede leer (RLS).
-- Esta funcion SECURITY DEFINER devuelve SOLO los pedidos del correo CONFIRMADO de la sesion (auth.uid()): sin sesion o sin correo confirmado -> [].
-- No devuelve ids de Stripe, telefono ni correo. Oculta los pedidos de prueba (status 'cancelled%'). Solo LEE: no escribe nada. Volver a correrlo es seguro.
CREATE OR REPLACE FUNCTION public.get_my_ticket_orders()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT lower(btrim(u.email)) INTO v_email
    FROM auth.users u
   WHERE u.id = v_uid AND u.email_confirmed_at IS NOT NULL;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT o.id, o.kind, o.status, o.items, o.reservation_name, o.total_cents, o.currency,
             o.created_at, o.checked_in_qty,
             e.title AS event_title, e.event_date, r.name AS room_name
        FROM public.venue_ticket_orders o
        LEFT JOIN public.venue_events e ON e.id = o.event_id
        LEFT JOIN public.venue_rooms  r ON r.id = e.room_id
       WHERE lower(btrim(o.customer_email)) = v_email
         AND o.status NOT LIKE 'cancelled%'
       ORDER BY o.created_at DESC
       LIMIT 50
    ) x
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_ticket_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ticket_orders() TO authenticated;

-- Comprobacion (solo lectura): pedidos visibles para clientes (sin los de prueba) y cuantos tienen correo
select count(*) filter (where status not like 'cancelled%') as visibles,
       count(*) filter (where customer_email is not null)   as con_correo
  from public.venue_ticket_orders;
