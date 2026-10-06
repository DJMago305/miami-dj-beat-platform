-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Ficha pública de un ticket para la página https://www.miamidjbeat.com/t/<uuid> (la que abre la cámara normal del teléfono al escanear el QR).
-- venue_ticket_orders solo la lee el staff (RLS) y el cliente que escanea no tiene sesión: esta función SECURITY DEFINER devuelve SOLO lo informativo,
-- sin cantidades, sin correo, sin teléfono, sin ids de Stripe y sin estado interno. Es de SOLO LECTURA: abrir la página nunca registra un ingreso.
-- Devuelve: found, kind, void (cancelado/reembolsado/conflicto), event_id (los eventos ya son de lectura pública), event_title, event_date, room_name y
-- holder = titular ENMASCARADO (primer nombre + inicial del siguiente: «Ana P.»). El UUID de la orden (122 bits, no adivinable) es la llave.
-- Idempotente: volver a correrlo es seguro.
CREATE OR REPLACE FUNCTION public.venue_ticket_public_info(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o        public.venue_ticket_orders%rowtype;
  e        record;
  v_name   text;
  v_parts  text[];
  v_holder text;
  v_void   boolean;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO o FROM public.venue_ticket_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_name := btrim(coalesce(nullif(btrim(o.reservation_name), ''), nullif(btrim(o.customer_name), ''), ''));
  v_parts := regexp_split_to_array(v_name, '\s+');
  v_holder := CASE
    WHEN v_name = '' THEN NULL
    WHEN array_length(v_parts, 1) > 1 THEN v_parts[1] || ' ' || upper(left(v_parts[2], 1)) || '.'
    ELSE v_parts[1]
  END;

  SELECT ev.id AS id, ev.title AS title, ev.event_date AS event_date, r.name AS room_name
    INTO e
    FROM public.venue_events ev
    LEFT JOIN public.venue_rooms r ON r.id = ev.room_id
   WHERE ev.id = o.event_id;

  v_void := o.status LIKE 'cancelled%' OR o.status LIKE '%refund%' OR o.status LIKE '%conflict%';

  RETURN jsonb_build_object(
    'found',       true,
    'kind',        o.kind,
    'void',        v_void,
    'event_id',    o.event_id,
    'event_title', e.title,
    'event_date',  e.event_date,
    'room_name',   e.room_name,
    'holder',      v_holder
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.venue_ticket_public_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venue_ticket_public_info(uuid) TO anon, authenticated;

-- Comprobación (solo lectura): la función existe y devuelve found=false para un id inexistente
select to_regprocedure('public.venue_ticket_public_info(uuid)') is not null as funcion,
       public.venue_ticket_public_info('00000000-0000-4000-8000-000000000000'::uuid) as prueba_inexistente;
