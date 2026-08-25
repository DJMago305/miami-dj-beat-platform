-- ═══════════════════════════════════════════════════════════════════════
-- SECURITY + SCHEMA FIX v3 — Add columns FIRST, then create the view
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. ADD ALL DISPLAY COLUMNS (safe IF NOT EXISTS — no data loss) ────────
-- Core profile fields
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS stage_name   TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS bio_short    TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS bio_long     TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS photo_url    TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS roles        TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS category     TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS city         TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS plan         TEXT DEFAULT 'LITE';
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS genres       TEXT;

-- Availability
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS availability_schedule JSONB DEFAULT '{}';
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS work_start            TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS work_end              TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS advance_notice_hours  INTEGER;

-- Social
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS social_instagram TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS social_tiktok    TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS social_youtube   TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS social_spotify   TEXT;
ALTER TABLE dj_profiles ADD COLUMN IF NOT EXISTS social_web       TEXT;

-- Leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS event_location      TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_estimate     TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dj_name_requested   TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_dj_id      UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source              TEXT DEFAULT 'direct';

-- ── 2. PUBLIC VIEW — Now safe: all columns guaranteed to exist ────────────
DROP VIEW IF EXISTS public_dj_profiles;
CREATE VIEW public_dj_profiles AS
SELECT
    encode(sha256(user_id::text::bytea), 'hex') AS dj_slug,
    stage_name,
    photo_url,
    bio_short,
    city,
    roles,
    category,
    plan,
    available,
    availability_schedule,
    genres,
    social_instagram,
    social_tiktok,
    social_youtube,
    social_spotify,
    social_web,
    updated_at
FROM dj_profiles
WHERE available = true;

GRANT SELECT ON public_dj_profiles TO anon;
GRANT SELECT ON public_dj_profiles TO authenticated;

-- ── 3. LEADS INSERT POLICY ────────────────────────────────────────────────
DROP POLICY IF EXISTS "public insert leads" ON leads;
CREATE POLICY "public insert leads" ON leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ── 4. VERIFY ─────────────────────────────────────────────────────────────
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name = 'dj_profiles'
  AND column_name IN ('stage_name','bio_short','photo_url','roles','city','plan','availability_schedule')
UNION ALL
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('event_location','budget_estimate','dj_name_requested','source')
ORDER BY table_name, column_name;
