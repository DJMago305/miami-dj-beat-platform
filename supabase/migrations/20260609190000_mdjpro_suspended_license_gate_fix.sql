-- MDJPRO: enforce suspended license row in effective_status + activate/heartbeat gate.
-- Closes edge case where dj_profiles still shows active but license row was paused (moroso).

-- ── effective_status: respect suspended row even when subscription flag is stale ──

DROP FUNCTION IF EXISTS public.mdjpro_effective_status(uuid);

CREATE OR REPLACE FUNCTION public.mdjpro_effective_status(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_mdb_active        boolean;
  v_standalone_active boolean;
  v_premium           boolean;
  v_lk                public.mdjpro_license_keys%rowtype;
  v_has_license       boolean := false;
  v_seats_allowed     smallint := 2;
  v_seats_used        integer := 0;
  v_status            public.mdjpro_license_status;
  v_sources           jsonb := '[]'::jsonb;
  v_expires_policy    text;
BEGIN
  IF p_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'null_uid');
  END IF;

  v_mdb_active := public._mdjpro_miamidjbeat_pro_active(p_uid);
  v_standalone_active := public._mdjpro_standalone_active(p_uid);
  v_premium := v_mdb_active OR v_standalone_active;

  IF v_mdb_active THEN
    v_sources := v_sources || jsonb_build_array('miamidjbeat_pro');
  END IF;
  IF v_standalone_active THEN
    v_sources := v_sources || jsonb_build_array('mdjpro_standalone');
  END IF;

  SELECT *
  INTO v_lk
  FROM public.mdjpro_license_keys lk
  WHERE lk.user_id = p_uid
  LIMIT 1;

  v_has_license := FOUND;

  IF v_has_license THEN
    v_seats_allowed := v_lk.seats_allowed;
    v_seats_used := public._mdjpro_count_active_leases(v_lk.id);

    IF v_lk.status = 'revoked'::public.mdjpro_license_status THEN
      v_status := 'revoked'::public.mdjpro_license_status;
    ELSIF v_lk.status = 'expired'::public.mdjpro_license_status THEN
      v_status := 'expired'::public.mdjpro_license_status;
    ELSIF v_lk.status = 'suspended'::public.mdjpro_license_status THEN
      v_status := 'suspended'::public.mdjpro_license_status;
      v_premium := false;
    ELSIF v_premium THEN
      v_status := 'active'::public.mdjpro_license_status;
    ELSE
      v_status := 'suspended'::public.mdjpro_license_status;
    END IF;
  ELSE
    v_status := CASE
      WHEN v_premium THEN 'active'::public.mdjpro_license_status
      ELSE 'suspended'::public.mdjpro_license_status
    END;
  END IF;

  IF v_mdb_active AND v_standalone_active THEN
    v_expires_policy := 'while_miamidjbeat_pro_or_standalone_active';
  ELSIF v_mdb_active THEN
    v_expires_policy := 'while_miamidjbeat_pro_active';
  ELSIF v_standalone_active THEN
    v_expires_policy := 'while_mdjpro_standalone_active';
  ELSE
    v_expires_policy := 'none';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_uid::text,
    'effective_premium', v_premium,
    'license_status', v_status::text,
    'plan_sources_active', v_sources,
    'miamidjbeat_pro_active', v_mdb_active,
    'mdjpro_standalone_active', v_standalone_active,
    'seats_allowed', v_seats_allowed,
    'seats_used', v_seats_used,
    'expires_policy', v_expires_policy,
    'has_license_row', v_has_license
  );
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_effective_status(uuid) IS
  'Evalúa PREMIUM efectivo MDJPRO. Fila suspended en mdjpro_license_keys fuerza effective_premium=false.';

REVOKE ALL ON FUNCTION public.mdjpro_effective_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_effective_status(uuid) TO authenticated, service_role;

-- ── Gate: block activate/heartbeat when license row is suspended ──

CREATE OR REPLACE FUNCTION public._mdjpro_effective_license_gate(
  p_uid uuid,
  p_lk  public.mdjpro_license_keys
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_effective        jsonb;
  v_effective_status text;
  v_premium          boolean;
BEGIN
  IF p_lk.status = 'revoked'::public.mdjpro_license_status THEN
    RETURN 'license_revoked';
  END IF;

  IF p_lk.status = 'expired'::public.mdjpro_license_status THEN
    RETURN 'license_expired';
  END IF;

  IF p_lk.status = 'suspended'::public.mdjpro_license_status THEN
    RETURN 'license_suspended';
  END IF;

  v_effective := public.mdjpro_effective_status(p_uid);

  IF coalesce((v_effective ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN 'license_expired';
  END IF;

  v_premium := coalesce((v_effective ->> 'effective_premium')::boolean, false);
  v_effective_status := lower(trim(coalesce(v_effective ->> 'license_status', '')));

  IF v_effective_status = 'revoked' THEN
    RETURN 'license_revoked';
  END IF;

  IF v_effective_status = 'expired' THEN
    RETURN 'license_expired';
  END IF;

  IF v_effective_status = 'suspended' OR NOT v_premium THEN
    RETURN 'license_suspended';
  END IF;

  RETURN NULL;
END
$fn$;

-- ── activation_ok payload: include masked license_display for Mac UI refresh ──

CREATE OR REPLACE FUNCTION public._mdjpro_build_activation_ok(
  p_lk          public.mdjpro_license_keys,
  p_lease       public.mdjpro_device_leases,
  p_effective   jsonb,
  p_reactivated boolean
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_display text;
BEGIN
  v_display := trim(both FROM coalesce(p_lk.key_prefix, 'MDJP'))
    || '-****-****-****-'
    || coalesce(p_lk.key_last4, '????');

  RETURN jsonb_build_object(
    'ok', true,
    'lease_id', p_lease.lease_id,
    'license_id', p_lk.id::text,
    'user_id', p_lk.user_id::text,
    'valid_until', p_lease.valid_until,
    'offline_grace_until', p_lease.valid_until,
    'effective_premium', coalesce((p_effective ->> 'effective_premium')::boolean, true),
    'license_status', coalesce(p_effective ->> 'license_status', 'active'),
    'license_display', v_display,
    'lease_status', p_lease.status::text,
    'seats_used', coalesce((p_effective ->> 'seats_used')::integer, public._mdjpro_count_active_leases(p_lk.id)),
    'seats_allowed', p_lk.seats_allowed,
    'reactivated', coalesce(p_reactivated, false)
  );
END
$fn$;
