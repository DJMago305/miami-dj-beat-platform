-- MDJPRO License Bridge — Fase 2A SQL
-- Desktop activate, heartbeat, revoke via mdjpro_device_leases (seats_allowed, 7-day valid_until).
-- NO aplicar automáticamente. NO ejecutar en producción hasta autorización manual.
--
-- Depende de:
--   20260607100000_mdjpro_license_bridge.sql
--   20260608100000_mdjpro_issue_license.sql
--   20260608110000_mdjpro_issue_license_hotfix_segment.sql

-- ── Helpers internos (no API pública) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mdjpro_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role'
$$;

REVOKE ALL ON FUNCTION public._mdjpro_is_service_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_is_service_role() TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_offline_grace_interval()
RETURNS interval
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT interval '7 days'
$$;

REVOKE ALL ON FUNCTION public._mdjpro_offline_grace_interval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_offline_grace_interval() TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_normalize_device_fingerprint(p_fingerprint text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  v_norm text := lower(trim(coalesce(p_fingerprint, '')));
BEGIN
  IF v_norm = '' OR length(v_norm) < 16 THEN
    RETURN NULL;
  END IF;

  IF length(v_norm) > 256 THEN
    v_norm := left(v_norm, 256);
  END IF;

  RETURN v_norm;
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_normalize_device_fingerprint(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_normalize_device_fingerprint(text) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_generate_lease_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
BEGIN
  RETURN 'MDJL-'
    || public._mdjpro_random_key_segment(4) || '-'
    || public._mdjpro_random_key_segment(4) || '-'
    || public._mdjpro_random_key_segment(4) || '-'
    || public._mdjpro_random_key_segment(4);
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_generate_lease_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_generate_lease_id() TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_activation_rate_limited(
  p_device_fingerprint text,
  p_client_ip          inet DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(count(*)::integer, 0) >= 10
  FROM public.mdjpro_activation_attempts aa
  WHERE aa.success IS NOT TRUE
    AND aa.created_at >= (now() - interval '15 minutes')
    AND (
      (p_device_fingerprint IS NOT NULL AND aa.device_fingerprint = p_device_fingerprint)
      OR (p_client_ip IS NOT NULL AND aa.ip = p_client_ip)
    )
$$;

REVOKE ALL ON FUNCTION public._mdjpro_activation_rate_limited(text, inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_activation_rate_limited(text, inet) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_expire_stale_leases(p_license_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_license_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.mdjpro_device_leases dl
  SET
    status = 'expired'::public.mdjpro_lease_status,
    updated_at = now()
  WHERE dl.license_id = p_license_id
    AND dl.status = 'active'::public.mdjpro_lease_status
    AND dl.valid_until < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_expire_stale_leases(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_expire_stale_leases(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_log_activation_attempt(
  p_user_id            uuid,
  p_device_fingerprint text,
  p_client_ip          inet,
  p_success            boolean,
  p_error_code         text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.mdjpro_activation_attempts (
    user_id,
    ip,
    device_fingerprint,
    success,
    error_code
  )
  VALUES (
    p_user_id,
    p_client_ip,
    p_device_fingerprint,
    coalesce(p_success, false),
    nullif(trim(coalesce(p_error_code, '')), '')
  );
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_log_activation_attempt(uuid, text, inet, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_log_activation_attempt(uuid, text, inet, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_log_license_event(
  p_license_id uuid,
  p_event_type text,
  p_source     text,
  p_payload    jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.mdjpro_license_events (
    license_id,
    event_type,
    source,
    payload
  )
  VALUES (
    p_license_id,
    p_event_type,
    p_source,
    coalesce(p_payload, '{}'::jsonb)
  );
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_log_license_event(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_log_license_event(uuid, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_activate_fail(
  p_user_id            uuid,
  p_device_fingerprint text,
  p_client_ip          inet,
  p_license_id         uuid,
  p_reason             text,
  p_source             text DEFAULT 'mdjpro_activate_device'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
BEGIN
  PERFORM public._mdjpro_log_activation_attempt(
    p_user_id,
    p_device_fingerprint,
    p_client_ip,
    false,
    p_reason
  );

  IF p_license_id IS NOT NULL THEN
    PERFORM public._mdjpro_log_license_event(
      p_license_id,
      'activation_rejected',
      p_source,
      jsonb_build_object(
        'reason', p_reason,
        'device_fingerprint', left(coalesce(p_device_fingerprint, ''), 16)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', false,
    'reason', p_reason
  );
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_activate_fail(uuid, text, inet, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_activate_fail(uuid, text, inet, uuid, text, text) TO service_role;

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

REVOKE ALL ON FUNCTION public._mdjpro_effective_license_gate(uuid, public.mdjpro_license_keys) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_effective_license_gate(uuid, public.mdjpro_license_keys) TO service_role;

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
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'lease_id', p_lease.lease_id,
    'license_id', p_lk.id::text,
    'user_id', p_lk.user_id::text,
    'valid_until', p_lease.valid_until,
    'offline_grace_until', p_lease.valid_until,
    'effective_premium', coalesce((p_effective ->> 'effective_premium')::boolean, true),
    'license_status', coalesce(p_effective ->> 'license_status', 'active'),
    'lease_status', p_lease.status::text,
    'seats_used', coalesce((p_effective ->> 'seats_used')::integer, public._mdjpro_count_active_leases(p_lk.id)),
    'seats_allowed', p_lk.seats_allowed,
    'reactivated', coalesce(p_reactivated, false)
  );
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_build_activation_ok(public.mdjpro_license_keys, public.mdjpro_device_leases, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_build_activation_ok(public.mdjpro_license_keys, public.mdjpro_device_leases, jsonb, boolean) TO service_role;

-- ── Index: expire sweep + seat queries ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_mdjpro_device_leases_license_status_valid_until
  ON public.mdjpro_device_leases (license_id, status, valid_until);

-- ── RPC: mdjpro_activate_device ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_activate_device(text, text, text, text, text, text, inet);

CREATE OR REPLACE FUNCTION public.mdjpro_activate_device(
  p_license_key        text,
  p_device_fingerprint text,
  p_hwid_hash          text DEFAULT NULL,
  p_device_label       text DEFAULT NULL,
  p_app_version        text DEFAULT NULL,
  p_os_version         text DEFAULT NULL,
  p_client_ip          inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_fp_norm          text;
  v_key_hash         text;
  v_lk               public.mdjpro_license_keys%rowtype;
  v_existing_lease   public.mdjpro_device_leases%rowtype;
  v_has_lease        boolean := false;
  v_effective        jsonb;
  v_gate_reason      text;
  v_seats_used       integer;
  v_new_lease_id     text;
  v_attempts         integer := 0;
  v_max_attempts     constant integer := 12;
  v_new_lease        public.mdjpro_device_leases%rowtype;
  v_reactivated      boolean := false;
  v_grace            interval := public._mdjpro_offline_grace_interval();
BEGIN
  IF NOT public._mdjpro_is_service_role() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  v_fp_norm := public._mdjpro_normalize_device_fingerprint(p_device_fingerprint);
  IF v_fp_norm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_fingerprint');
  END IF;

  IF public._mdjpro_activation_rate_limited(v_fp_norm, p_client_ip) THEN
    PERFORM public._mdjpro_log_activation_attempt(NULL, v_fp_norm, p_client_ip, false, 'rate_limited');
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  IF coalesce(trim(p_license_key), '') = '' THEN
    PERFORM public._mdjpro_log_activation_attempt(NULL, v_fp_norm, p_client_ip, false, 'invalid_key');
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_key');
  END IF;

  v_key_hash := public._mdjpro_hash_license_key(p_license_key);

  SELECT *
  INTO v_lk
  FROM public.mdjpro_license_keys lk
  WHERE lk.key_hash = v_key_hash
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public._mdjpro_log_activation_attempt(NULL, v_fp_norm, p_client_ip, false, 'invalid_key');
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_key');
  END IF;

  v_gate_reason := public._mdjpro_effective_license_gate(v_lk.user_id, v_lk);
  IF v_gate_reason IS NOT NULL THEN
    RETURN public._mdjpro_activate_fail(
      v_lk.user_id,
      v_fp_norm,
      p_client_ip,
      v_lk.id,
      v_gate_reason,
      'mdjpro_activate_device'
    );
  END IF;

  PERFORM public._mdjpro_expire_stale_leases(v_lk.id);

  SELECT *
  INTO v_existing_lease
  FROM public.mdjpro_device_leases dl
  WHERE dl.license_id = v_lk.id
    AND dl.device_fingerprint = v_fp_norm
  LIMIT 1;

  v_has_lease := FOUND;

  IF v_has_lease THEN
    UPDATE public.mdjpro_device_leases dl
    SET
      status = 'active'::public.mdjpro_lease_status,
      valid_until = now() + v_grace,
      last_seen_at = now(),
      hwid_hash = nullif(trim(coalesce(p_hwid_hash, dl.hwid_hash)), ''),
      device_label = coalesce(nullif(trim(p_device_label), ''), dl.device_label),
      app_version = nullif(trim(coalesce(p_app_version, '')), ''),
      os_version = nullif(trim(coalesce(p_os_version, '')), ''),
      revoked_at = NULL,
      revoke_reason = NULL,
      updated_at = now()
    WHERE dl.id = v_existing_lease.id
    RETURNING * INTO v_new_lease;

    v_reactivated := true;
  ELSE
    v_seats_used := public._mdjpro_count_active_leases(v_lk.id);

    IF v_seats_used >= v_lk.seats_allowed THEN
      RETURN public._mdjpro_activate_fail(
        v_lk.user_id,
        v_fp_norm,
        p_client_ip,
        v_lk.id,
        'seats_exhausted',
        'mdjpro_activate_device'
      );
    END IF;

    LOOP
      v_attempts := v_attempts + 1;
      IF v_attempts > v_max_attempts THEN
        RETURN public._mdjpro_activate_fail(
          v_lk.user_id,
          v_fp_norm,
          p_client_ip,
          v_lk.id,
          'lease_id_generation_failed',
          'mdjpro_activate_device'
        );
      END IF;

      v_new_lease_id := public._mdjpro_generate_lease_id();

      BEGIN
        INSERT INTO public.mdjpro_device_leases (
          license_id,
          user_id,
          lease_id,
          device_fingerprint,
          device_label,
          hwid_hash,
          status,
          valid_until,
          app_version,
          os_version,
          last_seen_at
        )
        VALUES (
          v_lk.id,
          v_lk.user_id,
          v_new_lease_id,
          v_fp_norm,
          nullif(trim(coalesce(p_device_label, '')), ''),
          nullif(trim(coalesce(p_hwid_hash, '')), ''),
          'active'::public.mdjpro_lease_status,
          now() + v_grace,
          nullif(trim(coalesce(p_app_version, '')), ''),
          nullif(trim(coalesce(p_os_version, '')), ''),
          now()
        )
        RETURNING * INTO v_new_lease;

        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          IF EXISTS (
            SELECT 1
            FROM public.mdjpro_device_leases dl2
            WHERE dl2.license_id = v_lk.id
              AND dl2.device_fingerprint = v_fp_norm
          ) THEN
            SELECT *
            INTO v_existing_lease
            FROM public.mdjpro_device_leases dl3
            WHERE dl3.license_id = v_lk.id
              AND dl3.device_fingerprint = v_fp_norm
            LIMIT 1;

            UPDATE public.mdjpro_device_leases dl
            SET
              status = 'active'::public.mdjpro_lease_status,
              valid_until = now() + v_grace,
              last_seen_at = now(),
              revoked_at = NULL,
              revoke_reason = NULL,
              updated_at = now()
            WHERE dl.id = v_existing_lease.id
            RETURNING * INTO v_new_lease;

            v_reactivated := true;
            EXIT;
          END IF;
      END;
    END LOOP;
  END IF;

  UPDATE public.mdjpro_license_keys lk
  SET
    activated_at = coalesce(lk.activated_at, now()),
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE lk.id = v_lk.id
  RETURNING * INTO v_lk;

  v_effective := public.mdjpro_effective_status(v_lk.user_id);

  PERFORM public._mdjpro_log_activation_attempt(
    v_lk.user_id,
    v_fp_norm,
    p_client_ip,
    true,
    NULL
  );

  PERFORM public._mdjpro_log_license_event(
    v_lk.id,
    CASE WHEN v_reactivated THEN 'device_reactivated' ELSE 'device_activated' END,
    'mdjpro_activate_device',
    jsonb_build_object(
      'lease_id', v_new_lease.lease_id,
      'device_fingerprint', left(v_fp_norm, 16),
      'key_last4', v_lk.key_last4,
      'seats_used', coalesce((v_effective ->> 'seats_used')::integer, public._mdjpro_count_active_leases(v_lk.id))
    )
  );

  RETURN public._mdjpro_build_activation_ok(v_lk, v_new_lease, v_effective, v_reactivated);
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_activate_device(text, text, text, text, text, text, inet) IS
  'Activa MDJPRO desktop por license key + device fingerprint. service_role only. Nunca persiste license key plaintext.';

REVOKE ALL ON FUNCTION public.mdjpro_activate_device(text, text, text, text, text, text, inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_activate_device(text, text, text, text, text, text, inet) TO service_role;

-- ── RPC: mdjpro_heartbeat ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_heartbeat(text, text, text, text, inet);

CREATE OR REPLACE FUNCTION public.mdjpro_heartbeat(
  p_lease_id           text,
  p_device_fingerprint text,
  p_app_version        text DEFAULT NULL,
  p_os_version         text DEFAULT NULL,
  p_client_ip          inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_fp_norm     text;
  v_lease       public.mdjpro_device_leases%rowtype;
  v_lk          public.mdjpro_license_keys%rowtype;
  v_effective   jsonb;
  v_gate_reason text;
  v_grace       interval := public._mdjpro_offline_grace_interval();
BEGIN
  IF NOT public._mdjpro_is_service_role() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  v_fp_norm := public._mdjpro_normalize_device_fingerprint(p_device_fingerprint);
  IF v_fp_norm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_fingerprint');
  END IF;

  IF coalesce(trim(p_lease_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_not_found');
  END IF;

  SELECT *
  INTO v_lease
  FROM public.mdjpro_device_leases dl
  WHERE dl.lease_id = trim(p_lease_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_not_found');
  END IF;

  IF v_lease.device_fingerprint <> v_fp_norm THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_fingerprint_mismatch');
  END IF;

  IF v_lease.status = 'revoked'::public.mdjpro_lease_status THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_revoked');
  END IF;

  IF v_lease.status = 'expired'::public.mdjpro_lease_status
     OR v_lease.valid_until < now() THEN
    UPDATE public.mdjpro_device_leases dl
    SET
      status = 'expired'::public.mdjpro_lease_status,
      updated_at = now()
    WHERE dl.id = v_lease.id
      AND dl.status = 'active'::public.mdjpro_lease_status;

    RETURN jsonb_build_object('ok', false, 'reason', 'lease_expired');
  END IF;

  SELECT *
  INTO v_lk
  FROM public.mdjpro_license_keys lk
  WHERE lk.id = v_lease.license_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_not_found');
  END IF;

  v_gate_reason := public._mdjpro_effective_license_gate(v_lk.user_id, v_lk);
  IF v_gate_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_gate_reason);
  END IF;

  UPDATE public.mdjpro_device_leases dl
  SET
    valid_until = now() + v_grace,
    last_seen_at = now(),
    app_version = coalesce(nullif(trim(coalesce(p_app_version, '')), ''), dl.app_version),
    os_version = coalesce(nullif(trim(coalesce(p_os_version, '')), ''), dl.os_version),
    updated_at = now()
  WHERE dl.id = v_lease.id
  RETURNING * INTO v_lease;

  UPDATE public.mdjpro_license_keys lk
  SET
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE lk.id = v_lk.id
  RETURNING * INTO v_lk;

  v_effective := public.mdjpro_effective_status(v_lk.user_id);

  PERFORM public._mdjpro_log_license_event(
    v_lk.id,
    'heartbeat_ok',
    'mdjpro_heartbeat',
    jsonb_build_object(
      'lease_id', v_lease.lease_id,
      'device_fingerprint', left(v_fp_norm, 16),
      'valid_until', v_lease.valid_until
    )
  );

  RETURN public._mdjpro_build_activation_ok(v_lk, v_lease, v_effective, false);
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_heartbeat(text, text, text, text, inet) IS
  'Renueva lease MDJPRO (7-day valid_until). service_role only. Requiere lease_id + device fingerprint.';

REVOKE ALL ON FUNCTION public.mdjpro_heartbeat(text, text, text, text, inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_heartbeat(text, text, text, text, inet) TO service_role;

-- ── RPC: mdjpro_revoke_device ─────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_revoke_device(text, text, text);

CREATE OR REPLACE FUNCTION public.mdjpro_revoke_device(
  p_lease_id           text,
  p_device_fingerprint text,
  p_revoke_reason      text DEFAULT 'user_requested'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_fp_norm text;
  v_lease   public.mdjpro_device_leases%rowtype;
  v_reason  text := nullif(trim(coalesce(p_revoke_reason, '')), '');
BEGIN
  IF NOT public._mdjpro_is_service_role() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  v_fp_norm := public._mdjpro_normalize_device_fingerprint(p_device_fingerprint);
  IF v_fp_norm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_fingerprint');
  END IF;

  IF coalesce(trim(p_lease_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_not_found');
  END IF;

  SELECT *
  INTO v_lease
  FROM public.mdjpro_device_leases dl
  WHERE dl.lease_id = trim(p_lease_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_not_found');
  END IF;

  IF v_lease.device_fingerprint <> v_fp_norm THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_fingerprint_mismatch');
  END IF;

  IF v_lease.status = 'revoked'::public.mdjpro_lease_status THEN
    RETURN jsonb_build_object(
      'ok', true,
      'lease_id', v_lease.lease_id,
      'license_id', v_lease.license_id::text,
      'lease_status', 'revoked'
    );
  END IF;

  UPDATE public.mdjpro_device_leases dl
  SET
    status = 'revoked'::public.mdjpro_lease_status,
    revoked_at = now(),
    revoke_reason = coalesce(v_reason, 'user_requested'),
    updated_at = now()
  WHERE dl.id = v_lease.id
  RETURNING * INTO v_lease;

  PERFORM public._mdjpro_log_license_event(
    v_lease.license_id,
    'device_revoked',
    'mdjpro_revoke_device',
    jsonb_build_object(
      'lease_id', v_lease.lease_id,
      'device_fingerprint', left(v_fp_norm, 16),
      'revoke_reason', coalesce(v_reason, 'user_requested')
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'lease_id', v_lease.lease_id,
    'license_id', v_lease.license_id::text,
    'lease_status', v_lease.status::text
  );
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_revoke_device(text, text, text) IS
  'Revoca un lease MDJPRO activo. service_role only. Requiere lease_id + device fingerprint.';

REVOKE ALL ON FUNCTION public.mdjpro_revoke_device(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_revoke_device(text, text, text) TO service_role;
