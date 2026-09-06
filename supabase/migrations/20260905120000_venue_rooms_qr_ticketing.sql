-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
--
-- Modulo de Salas Aisladas, QR Dinamicos y Taquilla (ticket de Producto/Backend
-- aprobado por el PO, ver docs/ESTADO_MAESTRO.md ~linea 1321, hilo "Events hub
-- SEO/GEO/AEO" -- la especificacion completa vive ahi, este es el ticket
-- independiente al que se traslado).
--
-- Aditiva por completo: no toca ninguna tabla existente. Todo lo que hoy
-- referencia un "venue" (residency_schedule.venue, leads.venue/event_location,
-- dj_events.venue, elixis_agenda_eventos.venue_nombre) sigue siendo texto
-- libre, sin FK a esta jerarquia nueva -- esa es una migracion aparte, futura,
-- no parte de este ticket.

-- ── venues ────────────────────────────────────────────────────────────────
create table if not exists public.venues (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  name          text not null,
  zone          text,
  address       text,
  city          text default 'Miami, FL',
  whatsapp_link text,
  created_by    uuid references public.dj_profiles(user_id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists idx_venues_slug_norm
  on public.venues (lower(trim(slug)));

-- ── venue_rooms ───────────────────────────────────────────────────────────
create table if not exists public.venue_rooms (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues(id) on delete cascade,
  slug          text not null,
  name          text not null,
  capacity      integer,
  whatsapp_link text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Slug unico DENTRO del venue (no globalmente) -- dos venues distintos pueden
-- tener cada uno una sala "vip" sin chocar.
create unique index if not exists idx_venue_rooms_venue_slug_norm
  on public.venue_rooms (venue_id, lower(trim(slug)));

-- ── venue_events (una fecha/ocasion vendible, o "por anunciar") ────────────
create table if not exists public.venue_events (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references public.venue_rooms(id) on delete set null,
  brand_slug  text,
  title       text not null,
  event_date  date,
  status      text not null default 'waitlist'
              check (status in ('waitlist','announced','sold_out','completed','cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_venue_events_room on public.venue_events(room_id);
create index if not exists idx_venue_events_brand_slug on public.venue_events(brand_slug);

-- ── venue_ticket_types ──────────────────────────────────────────────────────
create table if not exists public.venue_ticket_types (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.venue_events(id) on delete cascade,
  label               text not null,
  price_cents         integer not null check (price_cents >= 0),
  quantity_available  integer check (quantity_available is null or quantity_available >= 0),
  quantity_sold       integer not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create index if not exists idx_venue_ticket_types_event on public.venue_ticket_types(event_id);

-- ── venue_ticket_orders (misma forma que merch_orders) ─────────────────────
create table if not exists public.venue_ticket_orders (
  id                        uuid primary key default gen_random_uuid(),
  event_id                  uuid references public.venue_events(id),
  stripe_session_id         text unique,
  stripe_payment_intent_id  text,
  items                     jsonb not null default '[]'::jsonb,
  customer_name             text,
  customer_email            text,
  customer_phone            text,
  subtotal_cents            integer not null default 0,
  total_cents               integer not null default 0,
  currency                  text not null default 'usd',
  status                    text not null default 'paid_pending_fulfillment',
  created_at                timestamptz not null default now()
);

create index if not exists idx_venue_ticket_orders_event on public.venue_ticket_orders(event_id);

-- ── venue_waitlist_signups ──────────────────────────────────────────────────
create table if not exists public.venue_waitlist_signups (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references public.venue_events(id),
  venue_id     uuid references public.venues(id),
  room_id      uuid references public.venue_rooms(id),
  name         text,
  email        text not null,
  phone        text,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz
);

create index if not exists idx_venue_waitlist_event on public.venue_waitlist_signups(event_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.venues              enable row level security;
alter table public.venue_rooms         enable row level security;
alter table public.venue_events        enable row level security;
alter table public.venue_ticket_types  enable row level security;
alter table public.venue_ticket_orders     enable row level security;
alter table public.venue_waitlist_signups  enable row level security;

-- Lectura publica: la pagina de sala y el checkout anonimo necesitan leer
-- venues/salas/eventos/tipos de entrada sin sesion.
create policy venues_public_read on public.venues
  for select using (true);
create policy venue_rooms_public_read on public.venue_rooms
  for select using (true);
create policy venue_events_public_read on public.venue_events
  for select using (true);
create policy venue_ticket_types_public_read on public.venue_ticket_types
  for select using (true);

-- Escritura: solo staff/owner (mismo patron que residency_schedule).
create policy venues_staff_write on public.venues
  for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy venue_rooms_staff_write on public.venue_rooms
  for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy venue_events_staff_write on public.venue_events
  for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy venue_ticket_types_staff_write on public.venue_ticket_types
  for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- venue_ticket_orders / venue_waitlist_signups: SIN acceso publico de lectura
-- ni escritura directa -- solo el service-role (edge functions) escribe, y
-- solo staff puede leerlas para gestion (mismo aislamiento que merch_orders).
create policy venue_ticket_orders_staff_read on public.venue_ticket_orders
  for select using (public.is_staff(auth.uid()));
create policy venue_waitlist_staff_read on public.venue_waitlist_signups
  for select using (public.is_staff(auth.uid()));

comment on table public.venues is
  'Modulo de Salas/QR/Taquilla (docs/ESTADO_MAESTRO.md ~1321). Club/venue fisico -- padre de venue_rooms.';
comment on table public.venue_rooms is
  'Sala independiente de un venue: slug propio, canal de WhatsApp exclusivo, QR propio.';
comment on table public.venue_events is
  'Ocasion vendible en una sala (o itinerante sin sala aun via brand_slug, ej. one-hit-wonder). event_date NULL = fecha por anunciar.';
comment on table public.venue_ticket_types is
  'Tipos de entrada por evento (General/VIP/Early Bird). price_cents nunca lo fija el cliente en el checkout.';
comment on table public.venue_ticket_orders is
  'Ordenes de entradas confirmadas -- escritas SOLO desde stripe-webhook tras pago confirmado, igual que merch_orders.';
comment on table public.venue_waitlist_signups is
  'Lista de espera real para eventos sin fecha fija -- reemplaza el redirect a contact.html que usaba one-hit-wonder.html.';
