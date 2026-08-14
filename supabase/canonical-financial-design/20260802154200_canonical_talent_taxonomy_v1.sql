-- TICKET-V1-CANONICAL-TALENT-TAXONOMY-SCHEMA-006
-- Model D Hybrid — Phase 1 DDL only (nullable, backward-compatible).
-- Does NOT: UPDATE dj_profiles, classify profiles, modify views, or touch runtime.
-- Remote apply: NOT AUTHORIZED until PO approves separate deploy ticket.

-- ── Preflight: dj_profiles.id required for capability/audit FKs ─────────────
DO $$
BEGIN
  IF to_regclass('public.dj_profiles') IS NULL THEN
    RAISE EXCEPTION 'canonical_talent_taxonomy_v1: public.dj_profiles missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dj_profiles'
      AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'canonical_talent_taxonomy_v1: dj_profiles.id column required';
  END IF;
END $$;

-- ── 1) talent_category_catalog ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.talent_category_catalog (
  code                   text PRIMARY KEY,
  label_key_i18n         text NOT NULL,
  entity_types           text[] NOT NULL,
  requires_subscription  boolean NOT NULL DEFAULT false,
  is_active              boolean NOT NULL DEFAULT true,
  is_assignable          boolean NOT NULL DEFAULT true,
  is_public              boolean NOT NULL DEFAULT true,
  sort_order             integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid NULL,
  updated_by             uuid NULL,
  CONSTRAINT chk_talent_category_catalog_entity_types CHECK (
    entity_types <@ ARRAY['ARTIST', 'STAFF', 'VENDOR', 'CONTRACTOR']::text[]
    AND cardinality(entity_types) >= 1
  ),
  CONSTRAINT chk_talent_category_catalog_code_nonempty CHECK (length(trim(code)) > 0),
  CONSTRAINT chk_talent_category_catalog_label_key_nonempty CHECK (length(trim(label_key_i18n)) > 0)
);

COMMENT ON TABLE public.talent_category_catalog IS
  'Canonical primary talent category codes (Model D). Future MDJ_TAXONOMY_V1_ENABLED: when false, runtime must not write taxonomy columns; legacy artist_specialty/roles stay authoritative.';

COMMENT ON COLUMN public.talent_category_catalog.entity_types IS
  'Allowed entity_type values for profiles using this category. V1 talent rows: ARTIST | STAFF only. VENDOR/CONTRACTOR reserved for future domains.';

COMMENT ON COLUMN public.talent_category_catalog.requires_subscription IS
  'V1: only ORQUESTA=true. Other categories: operational approval + availability; subscription may rank publicly but does not block staff assignment unless PO extends rule.';

-- ── 2) talent_capability_catalog (structure only; no seed rows in 006) ───────
CREATE TABLE IF NOT EXISTS public.talent_capability_catalog (
  code            text PRIMARY KEY,
  label_key_i18n  text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_talent_capability_catalog_code_nonempty CHECK (length(trim(code)) > 0),
  CONSTRAINT chk_talent_capability_catalog_label_key_nonempty CHECK (length(trim(label_key_i18n)) > 0)
);

COMMENT ON TABLE public.talent_capability_catalog IS
  'Secondary capability codes (Jobs multi-select, recommendations). Not primary identity.';

-- ── 3) dj_profiles extension (legacy artist_specialty / roles untouched) ─────
ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS entity_type text NULL,
  ADD COLUMN IF NOT EXISTS primary_talent_category text NULL,
  ADD COLUMN IF NOT EXISTS taxonomy_classification_status text NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN IF NOT EXISTS taxonomy_classified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS taxonomy_classified_by uuid NULL;

COMMENT ON COLUMN public.dj_profiles.entity_type IS
  'Operational entity class on roster row: ARTIST | STAFF. Not VENDOR/CONTRACTOR (separate future tables). Distinct from platform role column.';

COMMENT ON COLUMN public.dj_profiles.primary_talent_category IS
  'Canonical primary category code FK → talent_category_catalog. Search/filter primary identity; not artist_specialty.';

COMMENT ON COLUMN public.dj_profiles.taxonomy_classification_status IS
  'UNCLASSIFIED: no canonical category. AUTO_MAPPED: legacy value mapped deterministically (staff review). SUGGESTED: proposal only. MANUAL: staff applied. CONFIRMED: staff reviewed and confirmed.';

COMMENT ON COLUMN public.dj_profiles.taxonomy_classified_at IS
  'Timestamp of last taxonomy classification action on this profile.';

COMMENT ON COLUMN public.dj_profiles.taxonomy_classified_by IS
  'auth.users.id of staff actor who classified/confirmed, when applicable.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_dj_profiles_entity_type'
      AND conrelid = 'public.dj_profiles'::regclass
  ) THEN
    ALTER TABLE public.dj_profiles
      ADD CONSTRAINT chk_dj_profiles_entity_type
      CHECK (entity_type IS NULL OR entity_type IN ('ARTIST', 'STAFF'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_dj_profiles_taxonomy_classification_status'
      AND conrelid = 'public.dj_profiles'::regclass
  ) THEN
    ALTER TABLE public.dj_profiles
      ADD CONSTRAINT chk_dj_profiles_taxonomy_classification_status
      CHECK (
        taxonomy_classification_status IN (
          'UNCLASSIFIED',
          'AUTO_MAPPED',
          'SUGGESTED',
          'MANUAL',
          'CONFIRMED'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_dj_profiles_primary_talent_category'
      AND conrelid = 'public.dj_profiles'::regclass
  ) THEN
    ALTER TABLE public.dj_profiles
      ADD CONSTRAINT fk_dj_profiles_primary_talent_category
      FOREIGN KEY (primary_talent_category)
      REFERENCES public.talent_category_catalog (code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON CONSTRAINT chk_dj_profiles_taxonomy_classification_status ON public.dj_profiles IS
  'AUTO_MAPPED: only for unambiguous legacy values (e.g. artist_specialty=dj). SUGGESTED: non-authoritative proposals. MANUAL/CONFIRMED: staff actions. Músicos en Vivo must never auto-map to ORQUESTA/BANDA/CANTANTE/MUSICO/SAXOFONISTA/PERCUSIONISTA.';

-- ── 4) dj_profile_capabilities ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_profile_capabilities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL,
  capability_code text NOT NULL,
  source          text NOT NULL,
  confirmed       boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid NULL,
  CONSTRAINT fk_dj_profile_capabilities_profile
    FOREIGN KEY (profile_id)
    REFERENCES public.dj_profiles (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dj_profile_capabilities_code
    FOREIGN KEY (capability_code)
    REFERENCES public.talent_capability_catalog (code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT uq_dj_profile_capabilities_profile_code
    UNIQUE (profile_id, capability_code),
  CONSTRAINT chk_dj_profile_capabilities_source CHECK (
    source IN (
      'jobs_application',
      'staff_manual',
      'migration_suggestion',
      'system_import'
    )
  )
);

COMMENT ON TABLE public.dj_profile_capabilities IS
  'Secondary capabilities per dj_profiles row. Primary search uses primary_talent_category.';

COMMENT ON COLUMN public.dj_profile_capabilities.confirmed IS
  'Only confirmed capabilities count for operational recommendations.';

-- ── 5) profile_taxonomy_audit_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_taxonomy_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL,
  action_type     text NOT NULL,
  before_snapshot jsonb NULL,
  after_snapshot  jsonb NULL,
  reason_code     text NULL,
  reason_text     text NULL,
  source          text NOT NULL,
  actor_uid       uuid NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_profile_taxonomy_audit_log_profile
    FOREIGN KEY (profile_id)
    REFERENCES public.dj_profiles (id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_profile_taxonomy_audit_log_action_type CHECK (
    action_type IN (
      'CLASSIFY',
      'RECLASSIFY',
      'CONFIRM',
      'CLEAR',
      'CAPABILITY_ADD',
      'CAPABILITY_REMOVE',
      'ENTITY_TYPE_CHANGE'
    )
  ),
  CONSTRAINT chk_profile_taxonomy_audit_log_source_nonempty CHECK (length(trim(source)) > 0)
);

COMMENT ON TABLE public.profile_taxonomy_audit_log IS
  'Append-only taxonomy audit trail. No UPDATE/DELETE in V1. Reconstructs before/after snapshots including capabilities.';

-- ── 6) Seed category catalog (metadata only; no profile rows) ──────────────
INSERT INTO public.talent_category_catalog (
  code, label_key_i18n, entity_types, requires_subscription, sort_order
) VALUES
  ('DJ',              'talent_cat_DJ',              ARRAY['ARTIST'],           false, 10),
  ('ORQUESTA',        'talent_cat_ORQUESTA',        ARRAY['ARTIST'],           true,  20),
  ('BANDA_GRUPO',     'talent_cat_BANDA_GRUPO',     ARRAY['ARTIST'],           false, 30),
  ('CANTANTE',        'talent_cat_CANTANTE',        ARRAY['ARTIST'],           false, 40),
  ('MC_PRESENTADOR',  'talent_cat_MC_PRESENTADOR',  ARRAY['ARTIST'],           false, 50),
  ('MUSICO',          'talent_cat_MUSICO',          ARRAY['ARTIST'],           false, 60),
  ('SAXOFONISTA',     'talent_cat_SAXOFONISTA',     ARRAY['ARTIST'],           false, 70),
  ('PERCUSIONISTA',   'talent_cat_PERCUSIONISTA',   ARRAY['ARTIST'],           false, 80),
  ('BAILARIN',        'talent_cat_BAILARIN',        ARRAY['ARTIST'],           false, 90),
  ('COMPANIA_BAILE',  'talent_cat_COMPANIA_BAILE',  ARRAY['ARTIST'],           false, 100),
  ('HORA_LOCA',       'talent_cat_HORA_LOCA',       ARRAY['ARTIST'],           false, 110),
  ('FOTOGRAFO',       'talent_cat_FOTOGRAFO',       ARRAY['ARTIST'],           false, 120),
  ('VIDEOGRAFO',      'talent_cat_VIDEOGRAFO',      ARRAY['ARTIST'],           false, 130),
  ('TECNICO_AUDIO',   'talent_cat_TECNICO_AUDIO',   ARRAY['ARTIST', 'STAFF'],  false, 140),
  ('TECNICO_ILUMINACION', 'talent_cat_TECNICO_ILUMINACION', ARRAY['ARTIST', 'STAFF'], false, 150),
  ('TECNICO_VIDEO_LED', 'talent_cat_TECNICO_VIDEO_LED', ARRAY['ARTIST', 'STAFF'], false, 160),
  ('SEGURIDAD',       'talent_cat_SEGURIDAD',       ARRAY['ARTIST', 'STAFF'],  false, 170),
  ('OTRO_ARTISTA',    'talent_cat_OTRO_ARTISTA',    ARRAY['ARTIST'],           false, 180)
ON CONFLICT (code) DO UPDATE SET
  label_key_i18n        = EXCLUDED.label_key_i18n,
  entity_types          = EXCLUDED.entity_types,
  requires_subscription = EXCLUDED.requires_subscription,
  sort_order            = EXCLUDED.sort_order,
  is_active             = true,
  is_assignable         = true,
  is_public             = true,
  updated_at            = now();

-- ── 7) Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dj_profiles_primary_talent_category
  ON public.dj_profiles (primary_talent_category);

CREATE INDEX IF NOT EXISTS idx_dj_profiles_entity_type
  ON public.dj_profiles (entity_type);

CREATE INDEX IF NOT EXISTS idx_dj_profiles_taxonomy_classification_status
  ON public.dj_profiles (taxonomy_classification_status);

CREATE INDEX IF NOT EXISTS idx_dj_profile_capabilities_profile_id
  ON public.dj_profile_capabilities (profile_id);

CREATE INDEX IF NOT EXISTS idx_dj_profile_capabilities_capability_code
  ON public.dj_profile_capabilities (capability_code);

CREATE INDEX IF NOT EXISTS idx_profile_taxonomy_audit_log_profile_created
  ON public.profile_taxonomy_audit_log (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_talent_category_catalog_active_sort
  ON public.talent_category_catalog (is_active, sort_order);

-- ── 8) updated_at triggers (reuse existing helper if present) ───────────────
DO $$
BEGIN
  IF to_regprocedure('public._set_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_talent_category_catalog_updated_at ON public.talent_category_catalog;
    CREATE TRIGGER trg_talent_category_catalog_updated_at
      BEFORE UPDATE ON public.talent_category_catalog
      FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

    DROP TRIGGER IF EXISTS trg_talent_capability_catalog_updated_at ON public.talent_capability_catalog;
    CREATE TRIGGER trg_talent_capability_catalog_updated_at
      BEFORE UPDATE ON public.talent_capability_catalog
      FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

    DROP TRIGGER IF EXISTS trg_dj_profile_capabilities_updated_at ON public.dj_profile_capabilities;
    CREATE TRIGGER trg_dj_profile_capabilities_updated_at
      BEFORE UPDATE ON public.dj_profile_capabilities
      FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();
  END IF;
END $$;

-- ── 9) RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.talent_category_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_capability_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj_profile_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_taxonomy_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS talent_category_catalog_public_select ON public.talent_category_catalog;
CREATE POLICY talent_category_catalog_public_select
  ON public.talent_category_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND is_active = true);

DROP POLICY IF EXISTS talent_category_catalog_staff_select ON public.talent_category_catalog;
CREATE POLICY talent_category_catalog_staff_select
  ON public.talent_category_catalog
  FOR SELECT
  TO authenticated
  USING (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS talent_category_catalog_staff_insert ON public.talent_category_catalog;
CREATE POLICY talent_category_catalog_staff_insert
  ON public.talent_category_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS talent_category_catalog_staff_update ON public.talent_category_catalog;
CREATE POLICY talent_category_catalog_staff_update
  ON public.talent_category_catalog
  FOR UPDATE
  TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS talent_capability_catalog_auth_select ON public.talent_capability_catalog;
CREATE POLICY talent_capability_catalog_auth_select
  ON public.talent_capability_catalog
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS talent_capability_catalog_staff_select ON public.talent_capability_catalog;
CREATE POLICY talent_capability_catalog_staff_select
  ON public.talent_capability_catalog
  FOR SELECT
  TO authenticated
  USING (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS talent_capability_catalog_staff_insert ON public.talent_capability_catalog;
CREATE POLICY talent_capability_catalog_staff_insert
  ON public.talent_capability_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS talent_capability_catalog_staff_update ON public.talent_capability_catalog;
CREATE POLICY talent_capability_catalog_staff_update
  ON public.talent_capability_catalog
  FOR UPDATE
  TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS dj_profile_capabilities_staff_select ON public.dj_profile_capabilities;
CREATE POLICY dj_profile_capabilities_staff_select
  ON public.dj_profile_capabilities
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS dj_profile_capabilities_own_select ON public.dj_profile_capabilities;
CREATE POLICY dj_profile_capabilities_own_select
  ON public.dj_profile_capabilities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dj_profiles p
      WHERE p.id = profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS dj_profile_capabilities_staff_write ON public.dj_profile_capabilities;
CREATE POLICY dj_profile_capabilities_staff_write
  ON public.dj_profile_capabilities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS dj_profile_capabilities_staff_update ON public.dj_profile_capabilities;
CREATE POLICY dj_profile_capabilities_staff_update
  ON public.dj_profile_capabilities
  FOR UPDATE
  TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS profile_taxonomy_audit_log_staff_select ON public.profile_taxonomy_audit_log;
CREATE POLICY profile_taxonomy_audit_log_staff_select
  ON public.profile_taxonomy_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS profile_taxonomy_audit_log_staff_insert ON public.profile_taxonomy_audit_log;
CREATE POLICY profile_taxonomy_audit_log_staff_insert
  ON public.profile_taxonomy_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

-- ── 10) Grants (RLS-enforced) ────────────────────────────────────────────────
GRANT SELECT ON public.talent_category_catalog TO anon, authenticated;
GRANT SELECT ON public.talent_capability_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dj_profile_capabilities TO authenticated;
GRANT SELECT, INSERT ON public.profile_taxonomy_audit_log TO authenticated;

-- ── ROLLBACK (documentary — do not run in normal migration flow) ─────────────
-- 1) DROP POLICY ... ON new tables;
-- 2) DROP TABLE public.profile_taxonomy_audit_log;
-- 3) DROP TABLE public.dj_profile_capabilities;
-- 4) ALTER TABLE public.dj_profiles DROP CONSTRAINT IF EXISTS fk_dj_profiles_primary_talent_category;
--    ALTER TABLE public.dj_profiles DROP CONSTRAINT IF EXISTS chk_dj_profiles_entity_type;
--    ALTER TABLE public.dj_profiles DROP CONSTRAINT IF EXISTS chk_dj_profiles_taxonomy_classification_status;
--    ALTER TABLE public.dj_profiles DROP COLUMN IF EXISTS taxonomy_classified_by;
--    ALTER TABLE public.dj_profiles DROP COLUMN IF EXISTS taxonomy_classified_at;
--    ALTER TABLE public.dj_profiles DROP COLUMN IF EXISTS taxonomy_classification_status;
--    ALTER TABLE public.dj_profiles DROP COLUMN IF EXISTS primary_talent_category;
--    ALTER TABLE public.dj_profiles DROP COLUMN IF EXISTS entity_type;
-- 5) DROP TABLE public.talent_capability_catalog;
-- 6) DROP TABLE public.talent_category_catalog;
-- Legacy columns artist_specialty, roles, role are never dropped by this ticket.

NOTIFY pgrst, 'reload schema';
