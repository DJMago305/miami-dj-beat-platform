-- LC-13B-SQL — Legal identity RPC (isolated Postgres validation)
-- Ticket: TICKET-V2-LEGAL-CENTER-LC-13B-SQL-ISOLATED-IDENTITY-RPC-IMPLEMENTATION-001
-- Prerequisite: 20260722101300_legal_center_read_security_lc13a.sql (LC-13A)
-- Mode: isolated Postgres validation — NOT applied to legacy 110-migration chain by this ticket

-- ---------------------------------------------------------------------------
-- A) Extend LC-13A identity stub (LAB_ONLY until dj_profiles replacement)
-- ---------------------------------------------------------------------------

ALTER TABLE public.legal_lc13_identity_profiles
  ADD COLUMN IF NOT EXISTS profile_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS revision timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS mdjb_id text,
  ADD COLUMN IF NOT EXISTS brand_scope text NOT NULL DEFAULT 'MDJB';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'legal_lc13_identity_profiles_profile_status_valid'
  ) THEN
    ALTER TABLE public.legal_lc13_identity_profiles
      ADD CONSTRAINT legal_lc13_identity_profiles_profile_status_valid
      CHECK (profile_status IN ('active', 'inactive'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.legal_lc13_identity_profiles.profile_status IS
  'LC-13B isolated stub. Production resolves from authoritative profile tables.';
COMMENT ON COLUMN public.legal_lc13_identity_profiles.revision IS
  'LC-13B revision token for cache invalidation (isolated stub).';
COMMENT ON COLUMN public.legal_lc13_identity_profiles.mdjb_id IS
  'Optional MDJB public account id — no PII.';
COMMENT ON COLUMN public.legal_lc13_identity_profiles.brand_scope IS
  'Brand/tenant scope marker for isolated validation.';

-- LAB_ONLY: secondary claims to exercise identity_ambiguous in isolated tests.
CREATE TABLE IF NOT EXISTS public.legal_lc13b_secondary_identity_claims (
  user_id uuid NOT NULL,
  actor_id text NOT NULL,
  CONSTRAINT legal_lc13b_secondary_identity_claims_pkey PRIMARY KEY (user_id, actor_id)
);

COMMENT ON TABLE public.legal_lc13b_secondary_identity_claims IS
  'LC-13B LAB_ONLY ambiguity fixture. DROP after productive identity lookup replaces stub.';

-- ---------------------------------------------------------------------------
-- B) RPC — legal_resolve_profile_access (SECURITY DEFINER · auth.uid() authority)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.legal_resolve_profile_access(
  p_source_portal text,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_row public.legal_lc13_identity_profiles%ROWTYPE;
  v_recipient_scope text;
  v_distinct_actor_ids int;
BEGIN
  -- correlation_id is audit-only; never used for authorization.
  IF p_correlation_id IS NOT NULL AND length(trim(p_correlation_id)) = 0 THEN
    NULL;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'unauthenticated',
      'reason', 'Authentication required.'
    );
  END IF;

  IF p_source_portal IS NULL
    OR trim(p_source_portal) = ''
    OR p_source_portal NOT IN ('staff', 'artist', 'client') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'portal_mismatch',
      'reason', 'Invalid or missing source_portal.'
    );
  END IF;

  SELECT *
  INTO v_row
  FROM public.legal_lc13_identity_profiles
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'profile_missing',
      'reason', 'No legal profile for authenticated user.'
    );
  END IF;

  SELECT count(DISTINCT actor_id)
  INTO v_distinct_actor_ids
  FROM (
    SELECT v_row.actor_id AS actor_id
    UNION
    SELECT c.actor_id
    FROM public.legal_lc13b_secondary_identity_claims c
    WHERE c.user_id = v_uid
  ) claims;

  IF v_distinct_actor_ids > 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'identity_ambiguous',
      'reason', 'Multiple legal business entity IDs for authenticated user.'
    );
  END IF;

  IF v_row.portal IS DISTINCT FROM p_source_portal THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'portal_mismatch',
      'reason', 'Source portal does not match identity portal.'
    );
  END IF;

  IF v_row.role NOT IN ('owner', 'manager', 'seller', 'artist', 'client') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'role_unsupported',
      'reason', 'Unsupported legal role for profile access resolution.'
    );
  END IF;

  IF v_row.actor_type NOT IN ('staff', 'artist', 'client') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'role_unsupported',
      'reason', 'Unsupported actor type for profile access resolution.'
    );
  END IF;

  v_recipient_scope := CASE
    WHEN v_row.actor_type = 'artist' THEN COALESCE(v_row.recipient_scope, v_row.actor_id)
    ELSE NULL
  END;

  IF v_row.actor_type = 'artist'
    AND (v_recipient_scope IS NULL OR v_recipient_scope <> v_row.actor_id) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'identity_ambiguous',
      'reason', 'Artist recipient scope must match business entity id.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'actor_type', v_row.actor_type,
    'actor_role', v_row.role,
    'business_entity_id', v_row.actor_id,
    'recipient_scope', v_recipient_scope,
    'profile_status', v_row.profile_status,
    'revision', to_char(v_row.revision AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'mdjb_id', v_row.mdjb_id,
    'brand_scope', v_row.brand_scope,
    'source_version', 'lc13b-isolated-v1'
  );
END;
$$;

COMMENT ON FUNCTION public.legal_resolve_profile_access(text, text) IS
  'LC-13B identity RPC. Resolves legal business entity from auth.uid() only. Isolated stub reads legal_lc13_identity_profiles.';

REVOKE ALL ON FUNCTION public.legal_resolve_profile_access(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legal_resolve_profile_access(text, text) TO authenticated;
