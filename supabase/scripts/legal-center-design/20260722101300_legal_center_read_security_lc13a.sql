-- LC-13A — Legal Center read security (RLS + 7 read RPCs)
-- Ticket: TICKET-V2-LEGAL-CENTER-LC-13A-ISOLATED-READ-SECURITY-VALIDATION-001
-- Prerequisite: 20260721044500_legal_center_persistence_foundation.sql (LC-12)
-- Mode: isolated Postgres validation — NOT applied to legacy 110-migration chain by this ticket

-- ---------------------------------------------------------------------------
-- A) Minimal auth + identity helpers (isolated-bridge stub — not dj_profiles)
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

COMMENT ON FUNCTION auth.uid() IS
  'LC-13A isolated stub. Production integrates Supabase auth.uid() + profile lookup (LC-13B).';

CREATE TABLE IF NOT EXISTS public.legal_lc13_identity_profiles (
  user_id uuid PRIMARY KEY,
  actor_id text NOT NULL,
  actor_type text NOT NULL,
  role text NOT NULL,
  portal text NOT NULL,
  recipient_scope text,
  CONSTRAINT legal_lc13_identity_profiles_actor_type_valid CHECK (
    actor_type IN ('staff', 'artist', 'client')
  ),
  CONSTRAINT legal_lc13_identity_profiles_role_valid CHECK (
    role IN ('owner', 'manager', 'seller', 'artist', 'client')
  ),
  CONSTRAINT legal_lc13_identity_profiles_portal_valid CHECK (
    portal IN ('staff', 'artist', 'client')
  )
);

COMMENT ON TABLE public.legal_lc13_identity_profiles IS
  'LC-13A validation identity bridge stub. Maps auth.uid() to LegalReadAccessContext fields.';

CREATE OR REPLACE FUNCTION public.legal_lc13_read_access_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_row public.legal_lc13_identity_profiles%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.legal_lc13_identity_profiles
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'actor_type', v_row.actor_type,
    'actor_id', v_row.actor_id,
    'role', v_row.role,
    'portal', v_row.portal,
    'recipient_scope', COALESCE(v_row.recipient_scope, v_row.actor_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_test_set_session(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
END;
$$;

COMMENT ON FUNCTION public.legal_lc13_test_set_session(uuid) IS
  'Validation-only session setter for isolated Postgres. Not for production browsers.';

CREATE OR REPLACE FUNCTION public.legal_lc13_is_fiscal_template(p_business_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_business_id = 'SPC-001';
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_is_public_library_template(
  p_business_id text,
  p_category text,
  p_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_status = 'published'
    AND NOT public.legal_lc13_is_fiscal_template(p_business_id)
    AND p_category IN ('public', 'terms', 'privacy', 'library');
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_can_read_fiscal()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RETURN false;
  END IF;
  IF (ctx ->> 'portal') = 'client' THEN
    RETURN false;
  END IF;
  IF (ctx ->> 'portal') = 'staff' AND (ctx ->> 'role') = 'seller' THEN
    RETURN false;
  END IF;
  RETURN (ctx ->> 'portal') IN ('staff', 'artist');
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_can_read_full_audit()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RETURN false;
  END IF;
  RETURN (ctx ->> 'portal') = 'staff'
    AND (ctx ->> 'role') IN ('owner', 'manager');
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_can_read_deleted_submissions()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RETURN false;
  END IF;
  RETURN (ctx ->> 'portal') = 'staff' AND (ctx ->> 'role') = 'owner';
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_matches_recipient_scope(p_recipient_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RETURN false;
  END IF;
  IF (ctx ->> 'portal') = 'staff'
    AND (ctx ->> 'role') IN ('owner', 'manager') THEN
    RETURN true;
  END IF;
  IF (ctx ->> 'portal') = 'artist' THEN
    RETURN (ctx ->> 'actor_id') = p_recipient_id
      OR (ctx ->> 'recipient_scope') = p_recipient_id;
  END IF;
  IF (ctx ->> 'portal') = 'client' THEN
    RETURN (ctx ->> 'actor_id') = p_recipient_id;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_can_select_template(
  p_business_id text,
  p_category text,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RETURN false;
  END IF;

  IF (ctx ->> 'portal') = 'staff'
    AND (ctx ->> 'role') IN ('owner', 'manager') THEN
    RETURN true;
  END IF;

  IF public.legal_lc13_is_fiscal_template(p_business_id) THEN
    IF (ctx ->> 'portal') = 'artist' THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  IF public.legal_lc13_is_public_library_template(p_business_id, p_category, p_status) THEN
    IF (ctx ->> 'portal') IN ('artist', 'client') THEN
      RETURN true;
    END IF;
    IF (ctx ->> 'portal') = 'staff' AND (ctx ->> 'role') = 'seller' THEN
      RETURN true;
    END IF;
  END IF;

  IF (ctx ->> 'portal') = 'artist' AND p_status = 'published' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_can_select_template_asset(
  p_template_business_id text,
  p_category text,
  p_is_public_library_document boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RETURN false;
  END IF;

  IF (ctx ->> 'portal') = 'staff'
    AND (ctx ->> 'role') IN ('owner', 'manager') THEN
    RETURN true;
  END IF;

  IF public.legal_lc13_is_fiscal_template(p_template_business_id)
    OR p_category IN ('tax', 'w9', 'fiscal')
    OR NOT p_is_public_library_document AND p_category = 'tax' THEN
    IF (ctx ->> 'portal') = 'artist' THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  IF (ctx ->> 'portal') = 'artist' AND p_is_public_library_document THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_can_select_audit_event(
  p_actor_id text,
  p_actor_portal text,
  p_entity_type text,
  p_entity_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RETURN false;
  END IF;

  IF public.legal_lc13_can_read_full_audit() THEN
    RETURN true;
  END IF;

  IF (ctx ->> 'portal') = 'client'
    OR ((ctx ->> 'portal') = 'staff' AND (ctx ->> 'role') = 'seller') THEN
    RETURN false;
  END IF;

  IF (ctx ->> 'portal') = 'artist' THEN
    IF p_actor_portal = 'artist' AND p_actor_id = (ctx ->> 'actor_id') THEN
      RETURN true;
    END IF;
    IF p_entity_type = 'legal_document_instance' THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.legal_document_instances i
        WHERE i.business_id = p_entity_id
          AND public.legal_lc13_matches_recipient_scope(i.recipient_id)
      );
    END IF;
    IF p_entity_type = 'w9_request' THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.legal_w9_requests w
        WHERE w.business_id = p_entity_id
          AND public.legal_lc13_matches_recipient_scope(w.recipient_id)
      );
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_normalize_read_limit(p_limit int)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_limit IS NULL THEN
    RETURN 25;
  END IF;
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'persistence_limit_invalid';
  END IF;
  RETURN p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_lc13_empty_read_envelope()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object('data', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
$$;

-- ---------------------------------------------------------------------------
-- B) RLS — SELECT scoped; INSERT/UPDATE/DELETE denied (no policies)
-- ---------------------------------------------------------------------------

ALTER TABLE public.legal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_template_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_w9_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_audit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.legal_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legal_template_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legal_template_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legal_w9_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legal_audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_templates_select ON public.legal_templates;
CREATE POLICY legal_templates_select ON public.legal_templates
  FOR SELECT
  USING (
    public.legal_lc13_can_select_template(business_id, category, status)
  );

DROP POLICY IF EXISTS legal_templates_deny_delete ON public.legal_templates;
CREATE POLICY legal_templates_deny_delete ON public.legal_templates
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS legal_template_versions_select ON public.legal_template_versions;
CREATE POLICY legal_template_versions_select ON public.legal_template_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.legal_templates t
      WHERE t.id = template_row_id
        AND public.legal_lc13_can_select_template(t.business_id, t.category, t.status)
    )
  );

DROP POLICY IF EXISTS legal_template_versions_deny_delete ON public.legal_template_versions;
CREATE POLICY legal_template_versions_deny_delete ON public.legal_template_versions
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS legal_template_assets_select ON public.legal_template_assets;
CREATE POLICY legal_template_assets_select ON public.legal_template_assets
  FOR SELECT
  USING (
    public.legal_lc13_can_select_template_asset(
      template_business_id,
      category,
      is_public_library_document
    )
  );

DROP POLICY IF EXISTS legal_template_assets_deny_delete ON public.legal_template_assets;
CREATE POLICY legal_template_assets_deny_delete ON public.legal_template_assets
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS legal_document_instances_select ON public.legal_document_instances;
CREATE POLICY legal_document_instances_select ON public.legal_document_instances
  FOR SELECT
  USING (
    public.legal_lc13_matches_recipient_scope(recipient_id)
  );

DROP POLICY IF EXISTS legal_document_instances_deny_delete ON public.legal_document_instances;
CREATE POLICY legal_document_instances_deny_delete ON public.legal_document_instances
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS legal_w9_requests_select ON public.legal_w9_requests;
CREATE POLICY legal_w9_requests_select ON public.legal_w9_requests
  FOR SELECT
  USING (
    public.legal_lc13_can_read_fiscal()
    AND public.legal_lc13_matches_recipient_scope(recipient_id)
  );

DROP POLICY IF EXISTS legal_w9_requests_deny_delete ON public.legal_w9_requests;
CREATE POLICY legal_w9_requests_deny_delete ON public.legal_w9_requests
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS legal_document_submissions_select ON public.legal_document_submissions;
CREATE POLICY legal_document_submissions_select ON public.legal_document_submissions
  FOR SELECT
  USING (
    public.legal_lc13_can_read_fiscal()
    AND public.legal_lc13_matches_recipient_scope(recipient_id)
    AND (
      status <> 'deleted'
      OR public.legal_lc13_can_read_deleted_submissions()
    )
  );

DROP POLICY IF EXISTS legal_document_submissions_deny_delete ON public.legal_document_submissions;
CREATE POLICY legal_document_submissions_deny_delete ON public.legal_document_submissions
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS legal_audit_events_select ON public.legal_audit_events;
CREATE POLICY legal_audit_events_select ON public.legal_audit_events
  FOR SELECT
  USING (
    public.legal_lc13_can_select_audit_event(
      actor_id,
      actor_portal,
      entity_type,
      entity_id
    )
  );

DROP POLICY IF EXISTS legal_audit_events_deny_delete ON public.legal_audit_events;
CREATE POLICY legal_audit_events_deny_delete ON public.legal_audit_events
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS legal_audit_events_deny_update ON public.legal_audit_events;
CREATE POLICY legal_audit_events_deny_update ON public.legal_audit_events
  FOR UPDATE
  USING (false);

-- ---------------------------------------------------------------------------
-- C) Read RPCs — SECURITY INVOKER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.legal_read_templates(
  p_template_id text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_is_fiscal boolean DEFAULT NULL,
  p_active_only boolean DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_rows jsonb;
BEGIN
  IF public.legal_lc13_read_access_context() IS NULL THEN
    RAISE EXCEPTION 'persistence_identity_unavailable';
  END IF;

  IF p_is_fiscal IS TRUE AND NOT public.legal_lc13_can_read_fiscal() THEN
    RAISE EXCEPTION 'persistence_access_forbidden';
  END IF;

  v_limit := public.legal_lc13_normalize_read_limit(p_limit);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'business_id', t.business_id,
        'template_code', t.template_code,
        'official_name', t.official_name,
        'category', t.category,
        'status', t.status,
        'is_policy', t.is_policy,
        'is_fiscal', public.legal_lc13_is_fiscal_template(t.business_id),
        'current_published_version_id', t.current_published_version_id
      )
      ORDER BY t.business_id
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT *
    FROM public.legal_templates t
    WHERE (p_template_id IS NULL OR t.business_id = p_template_id)
      AND (p_category IS NULL OR t.category = p_category)
      AND (p_status IS NULL OR t.status = p_status)
      AND (
        p_is_fiscal IS NULL
        OR public.legal_lc13_is_fiscal_template(t.business_id) = p_is_fiscal
      )
      AND (
        p_active_only IS DISTINCT FROM true
        OR (t.status = 'published' AND t.current_published_version_id IS NOT NULL)
      )
    ORDER BY t.business_id
    LIMIT v_limit
  ) t;

  RETURN jsonb_build_object(
    'data', v_rows,
    'next_cursor', NULL,
    'has_more', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_read_template_versions(
  p_template_id text DEFAULT NULL,
  p_version_id text DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_rows jsonb;
BEGIN
  IF public.legal_lc13_read_access_context() IS NULL THEN
    RAISE EXCEPTION 'persistence_identity_unavailable';
  END IF;

  v_limit := public.legal_lc13_normalize_read_limit(p_limit);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'business_id', v.business_id,
        'template_business_id', v.template_business_id,
        'semver', v.semver,
        'effective_from', v.effective_from,
        'published_at', v.published_at
      )
      ORDER BY v.business_id
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT v.*
    FROM public.legal_template_versions v
    JOIN public.legal_templates t ON t.id = v.template_row_id
    WHERE (p_template_id IS NULL OR v.template_business_id = p_template_id)
      AND (p_version_id IS NULL OR v.business_id = p_version_id)
    ORDER BY v.business_id
    LIMIT v_limit
  ) v;

  RETURN jsonb_build_object(
    'data', v_rows,
    'next_cursor', NULL,
    'has_more', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_read_template_assets(
  p_template_id text DEFAULT NULL,
  p_asset_key text DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_rows jsonb;
BEGIN
  IF public.legal_lc13_read_access_context() IS NULL THEN
    RAISE EXCEPTION 'persistence_identity_unavailable';
  END IF;

  v_limit := public.legal_lc13_normalize_read_limit(p_limit);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'asset_key', a.asset_key,
        'template_business_id', a.template_business_id,
        'template_version_business_id', a.template_version_business_id,
        'filename', a.filename,
        'mime_type', a.mime_type,
        'kind', a.kind,
        'category', a.category,
        'availability', a.availability,
        'allowed_portals', a.allowed_portals,
        'is_public_library_document', a.is_public_library_document
      )
      ORDER BY a.asset_key
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT a.*
    FROM public.legal_template_assets a
    WHERE (p_template_id IS NULL OR a.template_business_id = p_template_id)
      AND (p_asset_key IS NULL OR a.asset_key = p_asset_key)
    ORDER BY a.asset_key
    LIMIT v_limit
  ) a;

  RETURN jsonb_build_object(
    'data', v_rows,
    'next_cursor', NULL,
    'has_more', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_read_instances(
  p_instance_id text DEFAULT NULL,
  p_recipient_type text DEFAULT NULL,
  p_recipient_id text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_template_id text DEFAULT NULL,
  p_created_from timestamptz DEFAULT NULL,
  p_created_to timestamptz DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_rows jsonb;
  v_scope text;
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RAISE EXCEPTION 'persistence_identity_unavailable';
  END IF;

  v_scope := ctx ->> 'recipient_scope';
  IF (ctx ->> 'portal') IN ('artist', 'client') THEN
    IF p_recipient_id IS NOT NULL AND p_recipient_id <> v_scope THEN
      RETURN public.legal_lc13_empty_read_envelope();
    END IF;
  END IF;

  v_limit := public.legal_lc13_normalize_read_limit(p_limit);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'business_id', i.business_id,
        'title', i.title,
        'status', i.status,
        'recipient_type', i.recipient_type,
        'recipient_id', i.recipient_id,
        'recipient_display_name', i.recipient_display_name,
        'template_business_id', i.template_business_id,
        'template_version_business_id', i.template_version_business_id,
        'created_at', i.created_at
      )
      ORDER BY i.created_at DESC, i.business_id DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT i.*
    FROM public.legal_document_instances i
    WHERE (p_instance_id IS NULL OR i.business_id = p_instance_id)
      AND (p_recipient_type IS NULL OR i.recipient_type = p_recipient_type)
      AND (p_status IS NULL OR i.status = p_status)
      AND (p_template_id IS NULL OR i.template_business_id = p_template_id)
      AND (p_created_from IS NULL OR i.created_at >= p_created_from)
      AND (p_created_to IS NULL OR i.created_at <= p_created_to)
    ORDER BY i.created_at DESC, i.business_id DESC
    LIMIT v_limit
  ) i;

  RETURN jsonb_build_object(
    'data', v_rows,
    'next_cursor', NULL,
    'has_more', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_read_w9_requests(
  p_w9_request_id text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_recipient_type text DEFAULT NULL,
  p_recipient_id text DEFAULT NULL,
  p_active_only boolean DEFAULT NULL,
  p_requested_from timestamptz DEFAULT NULL,
  p_requested_to timestamptz DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_rows jsonb;
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RAISE EXCEPTION 'persistence_identity_unavailable';
  END IF;

  IF NOT public.legal_lc13_can_read_fiscal() THEN
    RAISE EXCEPTION 'persistence_access_forbidden';
  END IF;

  IF (ctx ->> 'portal') IN ('artist', 'client')
    AND p_recipient_id IS NOT NULL
    AND NOT public.legal_lc13_matches_recipient_scope(p_recipient_id) THEN
    RETURN public.legal_lc13_empty_read_envelope();
  END IF;

  v_limit := public.legal_lc13_normalize_read_limit(p_limit);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'business_id', w.business_id,
        'status', w.status,
        'review_status', w.review_status,
        'recipient_type', w.recipient_type,
        'recipient_id', w.recipient_id,
        'template_business_id', w.template_business_id,
        'requested_at', w.requested_at
      )
      ORDER BY w.requested_at DESC, w.business_id DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT w.*
    FROM public.legal_w9_requests w
    WHERE (p_w9_request_id IS NULL OR w.business_id = p_w9_request_id)
      AND (p_status IS NULL OR w.status = p_status)
      AND (p_recipient_type IS NULL OR w.recipient_type = p_recipient_type)
      AND (
        p_active_only IS DISTINCT FROM true
        OR w.status IN (
          'requested', 'available', 'viewed', 'awaiting_upload', 'submitted'
        )
      )
      AND (p_requested_from IS NULL OR w.requested_at >= p_requested_from)
      AND (p_requested_to IS NULL OR w.requested_at <= p_requested_to)
    ORDER BY w.requested_at DESC, w.business_id DESC
    LIMIT v_limit
  ) w;

  RETURN jsonb_build_object(
    'data', v_rows,
    'next_cursor', NULL,
    'has_more', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_read_submissions(
  p_submission_id text DEFAULT NULL,
  p_document_instance_id text DEFAULT NULL,
  p_w9_request_id text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_include_deleted boolean DEFAULT false,
  p_submitted_from timestamptz DEFAULT NULL,
  p_submitted_to timestamptz DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_rows jsonb;
BEGIN
  IF public.legal_lc13_read_access_context() IS NULL THEN
    RAISE EXCEPTION 'persistence_identity_unavailable';
  END IF;

  IF NOT public.legal_lc13_can_read_fiscal() THEN
    RAISE EXCEPTION 'persistence_access_forbidden';
  END IF;

  IF p_include_deleted IS TRUE AND NOT public.legal_lc13_can_read_deleted_submissions() THEN
    RAISE EXCEPTION 'persistence_access_forbidden';
  END IF;

  v_limit := public.legal_lc13_normalize_read_limit(p_limit);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'business_id', s.business_id,
        'document_instance_business_id', s.document_instance_business_id,
        'filename', s.filename,
        'mime_type', s.mime_type,
        'size_bytes', s.size_bytes,
        'status', s.status,
        'recipient_type', s.recipient_type,
        'recipient_id', s.recipient_id,
        'submitted_at', s.submitted_at
      )
      ORDER BY s.submitted_at DESC, s.business_id DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT s.*
    FROM public.legal_document_submissions s
    WHERE (p_submission_id IS NULL OR s.business_id = p_submission_id)
      AND (p_document_instance_id IS NULL OR s.document_instance_business_id = p_document_instance_id)
      AND (p_w9_request_id IS NULL OR s.workflow_business_id = p_w9_request_id)
      AND (p_status IS NULL OR s.status = p_status)
      AND (p_include_deleted IS TRUE OR s.status <> 'deleted')
      AND (p_submitted_from IS NULL OR s.submitted_at >= p_submitted_from)
      AND (p_submitted_to IS NULL OR s.submitted_at <= p_submitted_to)
    ORDER BY s.submitted_at DESC, s.business_id DESC
    LIMIT v_limit
  ) s;

  RETURN jsonb_build_object(
    'data', v_rows,
    'next_cursor', NULL,
    'has_more', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.legal_read_audit_events(
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_actor_type text DEFAULT NULL,
  p_outcome text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL,
  p_occurred_from timestamptz DEFAULT NULL,
  p_occurred_to timestamptz DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_rows jsonb;
  ctx jsonb;
BEGIN
  ctx := public.legal_lc13_read_access_context();
  IF ctx IS NULL THEN
    RAISE EXCEPTION 'persistence_identity_unavailable';
  END IF;

  IF (ctx ->> 'portal') = 'client'
    OR ((ctx ->> 'portal') = 'staff' AND (ctx ->> 'role') = 'seller') THEN
    RAISE EXCEPTION 'persistence_access_forbidden';
  END IF;

  v_limit := public.legal_lc13_normalize_read_limit(p_limit);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'business_id', e.business_id,
        'sequence', e.sequence,
        'occurred_at', e.occurred_at,
        'action', e.action,
        'entity_type', e.entity_type,
        'entity_id', e.entity_id,
        'outcome', e.outcome,
        'actor_type', e.actor_type,
        'actor_portal', e.actor_portal
      )
      ORDER BY e.sequence ASC, e.business_id ASC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT e.*
    FROM public.legal_audit_events e
    WHERE (p_entity_type IS NULL OR e.entity_type = p_entity_type)
      AND (p_entity_id IS NULL OR e.entity_id = p_entity_id)
      AND (p_action IS NULL OR e.action = p_action)
      AND (p_actor_type IS NULL OR e.actor_type = p_actor_type)
      AND (p_outcome IS NULL OR e.outcome = p_outcome)
      AND (p_correlation_id IS NULL OR e.correlation_id = p_correlation_id)
      AND (p_occurred_from IS NULL OR e.occurred_at >= p_occurred_from)
      AND (p_occurred_to IS NULL OR e.occurred_at <= p_occurred_to)
    ORDER BY e.sequence ASC, e.business_id ASC
    LIMIT v_limit
  ) e;

  RETURN jsonb_build_object(
    'data', v_rows,
    'next_cursor', NULL,
    'has_more', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.legal_read_templates(text, text, text, boolean, boolean, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_read_template_versions(text, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_read_template_assets(text, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_read_instances(text, text, text, text, text, timestamptz, timestamptz, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_read_w9_requests(text, text, text, text, boolean, timestamptz, timestamptz, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_read_submissions(text, text, text, text, boolean, timestamptz, timestamptz, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legal_read_audit_events(text, text, text, text, text, text, timestamptz, timestamptz, text, int) FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.legal_read_templates(text, text, text, boolean, boolean, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_read_template_versions(text, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_read_template_assets(text, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_read_instances(text, text, text, text, text, timestamptz, timestamptz, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_read_w9_requests(text, text, text, text, boolean, timestamptz, timestamptz, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_read_submissions(text, text, text, text, boolean, timestamptz, timestamptz, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_read_audit_events(text, text, text, text, text, text, timestamptz, timestamptz, text, int) TO authenticated;

COMMENT ON FUNCTION public.legal_read_templates IS 'LC-13A read RPC — templates (SECURITY INVOKER).';
COMMENT ON FUNCTION public.legal_read_template_versions IS 'LC-13A read RPC — template versions (SECURITY INVOKER).';
COMMENT ON FUNCTION public.legal_read_template_assets IS 'LC-13A read RPC — template assets metadata (SECURITY INVOKER).';
COMMENT ON FUNCTION public.legal_read_instances IS 'LC-13A read RPC — document instances (SECURITY INVOKER).';
COMMENT ON FUNCTION public.legal_read_w9_requests IS 'LC-13A read RPC — W-9 requests (SECURITY INVOKER).';
COMMENT ON FUNCTION public.legal_read_submissions IS 'LC-13A read RPC — submissions (SECURITY INVOKER).';
COMMENT ON FUNCTION public.legal_read_audit_events IS 'LC-13A read RPC — audit events (SECURITY INVOKER).';
