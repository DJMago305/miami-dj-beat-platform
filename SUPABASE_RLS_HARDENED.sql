-- ═══════════════════════════════════════════════════════════════
-- MDJPRO — HARDENED SECURITY v3
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- ─── 0. HELPER: role check function ────────────────────────────
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'dj'
  );
$$;

-- ─── 1. AUDIT LOG TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event       TEXT        NOT NULL,          -- 'login','logout','profile_update','pwd_change','2fa_enabled','payment_attempt','booking_update'
  ip          TEXT,
  user_agent  TEXT,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by user and time
CREATE INDEX IF NOT EXISTS audit_log_user_idx    ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_event_idx   ON public.audit_log(event, created_at DESC);

-- RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- DJs can only INSERT their own events (no reads — they can't see audit trail directly)
CREATE POLICY "audit_log: DJ can insert own events" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins/managers can read all audit events
CREATE POLICY "audit_log: admin read all" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.user_role() IN ('admin', 'manager'));

-- ─── 2. DJ_PROFILES — Complete RLS ─────────────────────────────
ALTER TABLE public.dj_profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies first (avoid conflicts)
DROP POLICY IF EXISTS "Managers pueden ver todo" ON public.dj_profiles;
DROP POLICY IF EXISTS "DJs ven su propio perfil" ON public.dj_profiles;
DROP POLICY IF EXISTS "DJs editan su propio perfil" ON public.dj_profiles;

-- SELECT: DJ sees own, admin/manager sees all, public sees active profiles (for directory)
CREATE POLICY "dj_profiles: own select" ON public.dj_profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.user_role() IN ('admin', 'manager')
  );

CREATE POLICY "dj_profiles: public directory" ON public.dj_profiles
  FOR SELECT TO anon
  USING (status = 'ACTIVE');

-- INSERT: Only the authenticated user can create their OWN profile
CREATE POLICY "dj_profiles: own insert" ON public.dj_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: DJ can update only their own; admin can update any
CREATE POLICY "dj_profiles: own update" ON public.dj_profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.user_role() IN ('admin', 'manager')
  );

-- DELETE: Only admin can delete profiles
CREATE POLICY "dj_profiles: admin delete" ON public.dj_profiles
  FOR DELETE TO authenticated
  USING (public.user_role() IN ('admin', 'manager'));

-- ─── 3. LEADS — Complete RLS ────────────────────────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publico puede enviar leads" ON public.leads;
DROP POLICY IF EXISTS "Solo Managers ven leads" ON public.leads;

-- Anyone can INSERT a lead (contact form)
CREATE POLICY "leads: public insert" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admin/manager can read leads
CREATE POLICY "leads: admin read" ON public.leads
  FOR SELECT TO authenticated
  USING (public.user_role() IN ('admin', 'manager'));

-- Only admin/manager can update leads (mark as contacted, etc.)
CREATE POLICY "leads: admin update" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.user_role() IN ('admin', 'manager'));

-- ─── 4. BOOKINGS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id              BIGSERIAL PRIMARY KEY,
  dj_id           UUID REFERENCES public.dj_profiles(user_id) ON DELETE CASCADE,
  client_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_date      DATE NOT NULL,
  event_time      TEXT,
  venue           TEXT,
  event_type      TEXT,
  status          TEXT DEFAULT 'pending',  -- 'pending','confirmed','cancelled','completed'
  amount_cents    INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_dj_idx     ON public.bookings(dj_id, event_date);
CREATE INDEX IF NOT EXISTS bookings_client_idx ON public.bookings(client_id, event_date);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings(status);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- DJ sees their own bookings
CREATE POLICY "bookings: DJ sees own" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    auth.uid() = dj_id
    OR auth.uid() = client_id
    OR public.user_role() IN ('admin', 'manager')
  );

-- Client or DJ can insert a booking request
CREATE POLICY "bookings: client can create" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id OR auth.uid() = dj_id);

-- DJ and admin can update booking status
CREATE POLICY "bookings: DJ or admin update" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = dj_id
    OR public.user_role() IN ('admin', 'manager')
  );

-- Only admin can delete bookings
CREATE POLICY "bookings: admin delete" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.user_role() IN ('admin', 'manager'));

-- ─── 5. PAYMENTS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id        BIGINT REFERENCES public.bookings(id) ON DELETE SET NULL,
  stripe_session_id TEXT,
  stripe_intent_id  TEXT,
  amount_cents      INTEGER NOT NULL,
  currency          TEXT DEFAULT 'usd',
  status            TEXT DEFAULT 'pending',  -- 'pending','paid','failed','refunded'
  plan              TEXT,
  interval          TEXT,                    -- 'monthly','biannual','annual'
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- IMPORTANT: Never store raw card data — Stripe handles PCI DSS
-- Only store Stripe IDs and status

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own payment records (read-only)
CREATE POLICY "payments: user read own" ON public.payments
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.user_role() IN ('admin', 'manager')
  );

-- Only backend (service role) can insert/update payments — NOT users
-- Payments are created by Edge Functions using service_role key
-- No INSERT/UPDATE policies for authenticated users intentionally

-- ─── 6. PLATFORM_SETTINGS TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key     TEXT PRIMARY KEY,
  value   JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Public can read (prices, feature flags etc.)
CREATE POLICY "platform_settings: public read" ON public.platform_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only admin can write
CREATE POLICY "platform_settings: admin write" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.user_role() IN ('admin', 'manager'));

-- Seed default pricing
INSERT INTO public.platform_settings (key, value) VALUES
  ('pricing', '{"lite":{"monthly":0,"annual":0},"pro":{"monthly":2999,"annual":27999},"elite":{"monthly":4999,"annual":47999}}'),
  ('features', '{"directory":true,"booking":true,"analytics":false}')
ON CONFLICT (key) DO NOTHING;

-- ─── 7. UPDATE TRIGGER for bookings ────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 8. ASSIGN YOURSELF AS ADMIN ────────────────────────────────
-- Run this once for your admin email:
-- UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--   WHERE email = 'djmago305@gmail.com';

-- ═══════════════════════════════════════════════════════════════
-- DONE. Run this entire file in Supabase SQL Editor.
-- All tables now have RLS. Audit log captures all key events.
-- ═══════════════════════════════════════════════════════════════
