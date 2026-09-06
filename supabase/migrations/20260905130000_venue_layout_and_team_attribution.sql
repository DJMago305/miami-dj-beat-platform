-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
--
-- Extension aditiva al esquema de venues/salas/taquilla (ver
-- 20260905120000_venue_rooms_qr_ticketing.sql), a pedido explicito del PO
-- antes de construir el CRUD de Staff (Fase 2):
--
-- 1. Reserva de espacio para el mapa interactivo de asientos estilo
--    seleccion de avion (mesas/sillas/sofas VIP, puntos de referencia:
--    banos, barra, cabina de DJ, salidas) -- roadmap futuro, comenzando por
--    Mojitos Calle 8. El plano real y la numeracion de mesas se levantaran
--    directo con la gerencia del local, nunca inventados. Por ahora queda
--    vacio (JSONB libre), sin CRUD todavia -- solo reservado para no tener
--    que romper la estructura relacional base cuando llegue ese dato real.
-- 2. Atribucion por equipo/promotor: en locales como Mojitos Calle 8 (full
--    bar + reserva de botellas) la disposicion y venta cambia segun quien
--    esta a cargo del evento -- se necesita un identificador de equipo/zona
--    sin atar la sala a un plano estatico unico.

alter table public.venue_rooms
  add column if not exists layout jsonb not null default '{}'::jsonb;
comment on column public.venue_rooms.layout is
  'Reservado para el mapa interactivo de asientos (mesas/sillas/puntos de referencia). Vacio hasta que exista el levantamiento real del local.';

alter table public.venue_events
  add column if not exists team_label text;
comment on column public.venue_events.team_label is
  'Equipo/promotor a cargo de esta ocasion (opcional). Permite que la misma sala tenga noches con distinta atribucion de venta.';

alter table public.venue_ticket_types
  add column if not exists zone_label text;
comment on column public.venue_ticket_types.zone_label is
  'Zona o seccion con nombre propio dentro del evento (ej. "Zona A", "Team Marlon VIP"), independiente del team_label del evento.';
