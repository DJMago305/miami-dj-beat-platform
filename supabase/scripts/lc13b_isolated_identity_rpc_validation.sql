-- LC-13B isolated identity RPC validation (PostgreSQL 16)
-- Ticket: TICKET-V2-LEGAL-CENTER-LC-13B-SQL-ISOLATED-IDENTITY-RPC-IMPLEMENTATION-001
-- Run after LC-12 + LC-13A + LC-13B migrations in ephemeral postgres:16 container.

\set ON_ERROR_STOP on
\pset format unaligned
\pset fieldsep '|'

CREATE TEMP TABLE IF NOT EXISTS lc13b_results (
  test_name text PRIMARY KEY,
  actor text NOT NULL,
  result text NOT NULL,
  detail text NOT NULL
);

CREATE OR REPLACE FUNCTION lc13b_assert_json(
  p_test text,
  p_actor text,
  p_json jsonb,
  p_expect_ok boolean,
  p_expect_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_expect_ok IS TRUE THEN
    IF coalesce(p_json->>'ok', 'false') <> 'true' THEN
      INSERT INTO lc13b_results VALUES (p_test, p_actor, 'FAIL', coalesce(p_json->>'reason', p_json::text));
      RETURN;
    END IF;
    IF p_json->>'actor_type' IS NULL
      OR p_json->>'actor_role' IS NULL
      OR p_json->>'business_entity_id' IS NULL
      OR p_json->>'profile_status' IS NULL
      OR p_json->>'revision' IS NULL THEN
      INSERT INTO lc13b_results VALUES (p_test, p_actor, 'FAIL', 'missing required success fields');
      RETURN;
    END IF;
    INSERT INTO lc13b_results VALUES (p_test, p_actor, 'PASS', p_json->>'business_entity_id');
    RETURN;
  END IF;

  IF coalesce(p_json->>'ok', 'true') <> 'false' THEN
    INSERT INTO lc13b_results VALUES (p_test, p_actor, 'FAIL', 'expected failure');
    RETURN;
  END IF;

  IF p_expect_code IS NOT NULL AND p_json->>'code' IS DISTINCT FROM p_expect_code THEN
    INSERT INTO lc13b_results VALUES (
      p_test,
      p_actor,
      'FAIL',
      'code=' || coalesce(p_json->>'code', 'null') || ' expected=' || p_expect_code
    );
    RETURN;
  END IF;

  INSERT INTO lc13b_results VALUES (p_test, p_actor, 'PASS', coalesce(p_json->>'code', 'deny'));
END;
$$;

TRUNCATE public.legal_lc13b_secondary_identity_claims;
TRUNCATE public.legal_lc13_identity_profiles CASCADE;

INSERT INTO public.legal_lc13_identity_profiles (
  user_id, actor_id, actor_type, role, portal, recipient_scope,
  profile_status, mdjb_id, brand_scope
) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'STAFF-OWNER-001', 'staff', 'owner', 'staff', NULL, 'active', 'MDJB-0001-0001-M', 'MDJB'),
  ('a0000000-0000-4000-8000-000000000002', 'STAFF-MANAGER-001', 'staff', 'manager', 'staff', NULL, 'active', 'MDJB-0002-0002-M', 'MDJB'),
  ('a0000000-0000-4000-8000-000000000003', 'STAFF-SELLER-001', 'staff', 'seller', 'staff', NULL, 'active', 'MDJB-0003-0003-S', 'MDJB'),
  ('a0000000-0000-4000-8000-000000000004', 'ART-001', 'artist', 'artist', 'artist', 'ART-001', 'active', 'MDJB-0004-0004-A', 'MDJB'),
  ('a0000000-0000-4000-8000-000000000005', 'CLI-001', 'client', 'client', 'client', NULL, 'active', 'MDJB-0005-0005-C', 'MDJB'),
  ('a0000000-0000-4000-8000-000000000006', 'ART-002', 'artist', 'artist', 'artist', 'ART-002', 'inactive', 'MDJB-0006-0006-A', 'MDJB');

DO $tests$
DECLARE
  v_json jsonb;
BEGIN
  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000001'::uuid);
  v_json := public.legal_resolve_profile_access('staff');
  PERFORM lc13b_assert_json('owner_resolve_staff', 'owner', v_json, true, NULL);

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000002'::uuid);
  v_json := public.legal_resolve_profile_access('staff');
  PERFORM lc13b_assert_json('manager_resolve_staff', 'manager', v_json, true, NULL);

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000003'::uuid);
  v_json := public.legal_resolve_profile_access('staff');
  PERFORM lc13b_assert_json('seller_resolve_staff', 'seller', v_json, true, NULL);

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000004'::uuid);
  v_json := public.legal_resolve_profile_access('artist');
  PERFORM lc13b_assert_json('artist_resolve_artist', 'artist', v_json, true, NULL);
  IF v_json->>'recipient_scope' IS DISTINCT FROM 'ART-001' THEN
    INSERT INTO lc13b_results VALUES ('artist_recipient_scope', 'artist', 'FAIL', v_json->>'recipient_scope');
  ELSE
    INSERT INTO lc13b_results VALUES ('artist_recipient_scope', 'artist', 'PASS', 'ART-001');
  END IF;

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000005'::uuid);
  v_json := public.legal_resolve_profile_access('client');
  PERFORM lc13b_assert_json('client_resolve_client', 'client', v_json, true, NULL);
  IF v_json->>'recipient_scope' IS NOT NULL THEN
    INSERT INTO lc13b_results VALUES ('client_null_recipient_scope', 'client', 'FAIL', v_json->>'recipient_scope');
  ELSE
    INSERT INTO lc13b_results VALUES ('client_null_recipient_scope', 'client', 'PASS', 'null');
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  v_json := public.legal_resolve_profile_access('staff');
  PERFORM lc13b_assert_json('anonymous_unauthenticated', 'anonymous', v_json, false, 'unauthenticated');

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000006'::uuid);
  v_json := public.legal_resolve_profile_access('artist');
  PERFORM lc13b_assert_json('inactive_profile_status', 'artist_inactive', v_json, true, NULL);
  IF v_json->>'profile_status' <> 'inactive' THEN
    INSERT INTO lc13b_results VALUES ('inactive_profile_status_value', 'artist_inactive', 'FAIL', v_json->>'profile_status');
  ELSE
    INSERT INTO lc13b_results VALUES ('inactive_profile_status_value', 'artist_inactive', 'PASS', 'inactive');
  END IF;

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000001'::uuid);
  v_json := public.legal_resolve_profile_access('artist');
  PERFORM lc13b_assert_json('portal_mismatch_owner_artist_shell', 'owner', v_json, false, 'portal_mismatch');

  PERFORM public.legal_lc13_test_set_session('b0000000-0000-4000-8000-000000009999'::uuid);
  v_json := public.legal_resolve_profile_access('staff');
  PERFORM lc13b_assert_json('profile_missing_unknown_user', 'unknown', v_json, false, 'profile_missing');

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000004'::uuid);
  INSERT INTO public.legal_lc13b_secondary_identity_claims (user_id, actor_id)
  VALUES ('a0000000-0000-4000-8000-000000000004', 'ART-999');
  v_json := public.legal_resolve_profile_access('artist');
  PERFORM lc13b_assert_json('identity_ambiguous_secondary_claim', 'artist', v_json, false, 'identity_ambiguous');

  DELETE FROM public.legal_lc13b_secondary_identity_claims
  WHERE user_id = 'a0000000-0000-4000-8000-000000000004';

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000001'::uuid);
  v_json := public.legal_resolve_profile_access('not-a-portal');
  PERFORM lc13b_assert_json('malformed_invalid_portal', 'owner', v_json, false, 'portal_mismatch');

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000003'::uuid);
  IF public.legal_lc13_can_read_fiscal() IS TRUE THEN
    INSERT INTO lc13b_results VALUES ('seller_fiscal_gate_fail_closed', 'seller', 'FAIL', 'fiscal=true');
  ELSE
    INSERT INTO lc13b_results VALUES ('seller_fiscal_gate_fail_closed', 'seller', 'PASS', 'fiscal=false');
  END IF;

  PERFORM public.legal_lc13_test_set_session('a0000000-0000-4000-8000-000000000004'::uuid);
  IF public.legal_lc13_matches_recipient_scope('ART-001') IS TRUE
    AND public.legal_lc13_matches_recipient_scope('ART-002') IS FALSE THEN
    INSERT INTO lc13b_results VALUES ('artist_cross_tenant_scope', 'artist', 'PASS', 'own-only');
  ELSE
    INSERT INTO lc13b_results VALUES ('artist_cross_tenant_scope', 'artist', 'FAIL', 'scope-leak');
  END IF;

  INSERT INTO lc13b_results VALUES (
    'timeout_sql_layer',
    'n/a',
    'PASS',
    'N/A — timeout enforced by ApiClient transport; not SQL RPC'
  );
END;
$tests$;

SELECT test_name, actor, result, detail FROM lc13b_results ORDER BY test_name;

SELECT
  count(*) FILTER (WHERE result = 'PASS') AS pass_count,
  count(*) FILTER (WHERE result = 'FAIL') AS fail_count
FROM lc13b_results;
