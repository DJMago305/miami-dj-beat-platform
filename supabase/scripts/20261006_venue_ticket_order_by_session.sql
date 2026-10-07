-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Entrega inmediata del QR (estilo Ticketmaster), Fase 1: la pantalla de «gracias» necesita encontrar la orden recién pagada.
--
-- Problema: al terminar el pago Stripe devuelve al comprador a venue-room.html con ?session_id=cs_… (el id de la sesión de pago), pero el id de la ORDEN
-- (el que lleva el QR) lo crea el webhook un instante después y el navegador no lo conoce. La tabla venue_ticket_orders no es legible por el público.
--
-- Qué agrega (aditivo e idempotente; no toca ninguna tabla ni función existente):
--   venue_ticket_order_by_session(p_session_id text) → jsonb, SECURITY DEFINER, solo LEE.
--   · El id de sesión de Stripe (cs_live_… / cs_test_…, ~66 caracteres al azar) solo lo conoce quien pagó (viene en SU redirección): hace de llave.
--   · Si la orden todavía no existe (el webhook no ha llegado) devuelve {"found": false}: la pantalla vuelve a preguntar cada pocos segundos.
--   · Devuelve lo que el propio comprador ya sabe: evento, fecha, sala, titular (nombre de la reserva o del comprador), artículos y su cantidad,
--     y si está anulado. NUNCA devuelve correo, teléfono, importes, ids de Stripe ni el estado interno.
--   · GRANT a anon y authenticated (el comprador no tiene que iniciar sesión).

create or replace function public.venue_ticket_order_by_session(p_session_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v        record;
  v_void   boolean := false;
  v_holder text;
  v_items  jsonb := '[]'::jsonb;
begin
  if p_session_id is null or length(p_session_id) < 20 or length(p_session_id) > 200 or p_session_id !~ '^cs_[A-Za-z0-9_]+$' then
    return jsonb_build_object('found', false);
  end if;

  select ord.id, ord.kind, ord.status, ord.reservation_name, ord.customer_name, ord.items,
         e.title as event_title, e.event_date, r.name as room_name
    into v
    from public.venue_ticket_orders ord
    left join public.venue_events e on e.id = ord.event_id
    left join public.venue_rooms  r on r.id = e.room_id
   where ord.stripe_session_id = p_session_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v.status like 'cancelled%' or v.status like '%refund%' or v.status like '%conflict%' then
    v_void := true;
  end if;

  v_holder := coalesce(nullif(btrim(v.reservation_name), ''), nullif(btrim(v.customer_name), ''), 'Cliente');

  if jsonb_typeof(v.items) = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'label', it->>'label',
             'qty',   case when (it->>'qty') ~ '^[0-9]{1,4}$' then (it->>'qty')::integer else 1 end)), '[]'::jsonb)
      into v_items
      from jsonb_array_elements(v.items) it;
  end if;

  return jsonb_build_object(
    'found',       true,
    'order_id',    v.id,
    'kind',        v.kind,
    'event_title', v.event_title,
    'event_date',  v.event_date,
    'room_name',   v.room_name,
    'holder',      v_holder,
    'items',       v_items,
    'void',        v_void
  );
end;
$function$;

revoke all on function public.venue_ticket_order_by_session(text) from public;
grant execute on function public.venue_ticket_order_by_session(text) to anon, authenticated;

-- ── Comprobación (solo lectura): funcion=true, anon=true, authenticated=true, sesion_falsa devuelve {"found": false}, entrada_basura devuelve {"found": false} ──
select
  (to_regprocedure('public.venue_ticket_order_by_session(text)') is not null)                                  as funcion,
  has_function_privilege('anon',          'public.venue_ticket_order_by_session(text)', 'execute')              as anon_ejecuta,
  has_function_privilege('authenticated', 'public.venue_ticket_order_by_session(text)', 'execute')              as authenticated_ejecuta,
  public.venue_ticket_order_by_session('cs_test_a1B2c3D4e5F6g7H8i9J0')                                          as sesion_falsa,
  public.venue_ticket_order_by_session('x; drop table x')                                                       as entrada_basura;
