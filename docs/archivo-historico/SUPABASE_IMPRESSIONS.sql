-- ══════════════════════════════════════════════════════
-- SEARCH IMPRESSIONS SYSTEM + leads.name fix
-- ══════════════════════════════════════════════════════

-- 1. Fix leads.name column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Create search_impressions table (data estratégica)
CREATE TABLE IF NOT EXISTS search_impressions (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at    TIMESTAMPTZ DEFAULT now(),
    dj_slug       TEXT NOT NULL,           -- SHA256 slug (no raw UUID)
    search_date   DATE,                    -- fecha buscada por el cliente
    search_genre  TEXT,                    -- filtro: género
    search_city   TEXT,                    -- filtro: ciudad
    avail_status  TEXT,                    -- free | partial | busy | unknown
    session_id    TEXT,                    -- anon session fingerprint
    user_id       UUID,                    -- null si anon
    position      INTEGER                  -- posición en resultados (1=primero)
);

-- 3. RLS: anon can INSERT (logging), only service role can SELECT for analytics
ALTER TABLE search_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can log impressions" ON search_impressions;
CREATE POLICY "anon can log impressions" ON search_impressions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- DJs can only see impressions where dj_slug matches their own
DROP POLICY IF EXISTS "dj sees own impressions" ON search_impressions;
CREATE POLICY "dj sees own impressions" ON search_impressions
  FOR SELECT TO authenticated
  USING (
    dj_slug = encode(sha256(auth.uid()::text::bytea), 'hex')
  );

-- 4. Aggregated view: weekly impressions per DJ (fast, no heavy aggregation at query time)
DROP VIEW IF EXISTS dj_weekly_impressions;
CREATE VIEW dj_weekly_impressions AS
SELECT
    dj_slug,
    COUNT(*)                                                        AS impressions_total,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS impressions_week,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '1 day')  AS impressions_today,
    MIN(created_at)                                                 AS first_seen,
    MAX(created_at)                                                 AS last_seen
FROM search_impressions
GROUP BY dj_slug;

GRANT SELECT ON dj_weekly_impressions TO authenticated;

-- 5. Verify
SELECT 'search_impressions created' AS status, COUNT(*) AS rows FROM search_impressions
UNION ALL
SELECT 'leads.name added', COUNT(*) FROM information_schema.columns
  WHERE table_name='leads' AND column_name='name';
