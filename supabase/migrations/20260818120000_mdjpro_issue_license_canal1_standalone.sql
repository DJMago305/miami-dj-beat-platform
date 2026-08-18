-- ═══════════════════════════════════════════════════════════════════════════
--  ENTORNO DE DESTINO:  ⚠️  PRUEBA — proyecto «mdjb-ensayo» (rtbsovavmtnjpbbpwsin)
--  NO EJECUTAR EN PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) hasta validación del PO.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  CANAL 1 · RENTA INDEPENDIENTE DE MDJPRO (19,99 USD/mes)
--
--  QUÉ ARREGLA
--  mdjpro_issue_license solo contemplaba 'miamidjbeat_pro' y 'manual'; cualquier
--  otro plan_source caía en el ELSE final y devolvía 'unsupported_plan_source'.
--  Consecuencia real: un cliente independiente podía PAGAR y quedarse sin clave.
--  El valor 'mdjpro_standalone' ya existía en el enum, pero la función que emite
--  la licencia lo rechazaba.
--
--  LA TRAMPA QUE OBLIGÓ A CAMBIAR LA FIRMA
--  La rama de artista valida con mdjpro_effective_status. Para standalone eso NO
--  sirve: _mdjpro_standalone_active() devuelve true solo si YA existe una
--  licencia standalone activa, así que la PRIMERA emisión fallaría siempre —no
--  hay licencia sin estar activo, ni activo sin licencia—. La rama de artista se
--  libra porque su suscripción vive en dj_profiles, fuera de esta tabla.
--  Por eso la prueba de pago pasa a ser la SUSCRIPCIÓN DE STRIPE que entrega el
--  llamador, y la función recibe tres parámetros nuevos.
--
--  COMPATIBILIDAD
--  Los tres parámetros llevan DEFAULT NULL, así que las llamadas de dos
--  argumentos que hoy hace stripe-webhook (p_uid, p_plan_source) siguen
--  resolviendo a esta función sin cambio alguno.
--
--  LO QUE ESTA MIGRACIÓN **NO** HACE
--  No toca stripe-webhook. Mientras el webhook no pase p_stripe_subscription_id,
--  el Canal 1 seguirá sin emitir: devolverá 'standalone_requires_subscription'
--  en vez de 'unsupported_plan_source'. Es deliberado — cambiar el webhook es un
--  despliegue de Edge Function, no una migración, y va en su propio ticket.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- La firma cambia, así que la antigua se retira explícitamente. Sin CASCADE:
-- si algo dependiera de ella queremos enterarnos aquí y no perderlo en silencio.
DROP FUNCTION IF EXISTS public.mdjpro_issue_license(uuid, public.mdjpro_plan_source);


CREATE OR REPLACE FUNCTION public.mdjpro_issue_license(
  p_uid uuid,
  p_plan_source public.mdjpro_plan_source DEFAULT 'miamidjbeat_pro'::public.mdjpro_plan_source,
  -- Datos de la suscripción independiente. Los aporta SIEMPRE el llamador
  -- (stripe-webhook); no se adivinan aquí. Con DEFAULT NULL para que las
  -- llamadas de dos argumentos que ya existen sigan resolviendo a esta función.
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_customer_id     text DEFAULT NULL,
  p_period_end             timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller              uuid := auth.uid();
  v_is_service          boolean := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role';
  v_effective           jsonb;
  v_user_exists         boolean := false;
  v_existing            public.mdjpro_license_keys%rowtype;
  v_has_existing        boolean := false;
  v_plaintext           text;
  v_normalized          text;
  v_key_hash            text;
  v_key_prefix          text := 'MDJP';
  v_key_last4           text;
  v_masked              text;
  v_license_id          uuid;
  v_dj_user_id          uuid;
  v_mdb_subscription_id text;
  v_attempts            integer := 0;
  v_max_attempts        constant integer := 12;
BEGIN
  IF p_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'null_uid');
  END IF;

  IF NOT v_is_service
     AND (v_caller IS NULL OR NOT public.is_staff_management(v_caller)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_uid)
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found', 'user_id', p_uid::text);
  END IF;

  v_effective := public.mdjpro_effective_status(p_uid);

  IF coalesce((v_effective ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'effective_status_failed',
      'user_id', p_uid::text,
      'effective', v_effective
    );
  END IF;

  IF p_plan_source = 'miamidjbeat_pro'::public.mdjpro_plan_source THEN
    IF coalesce((v_effective ->> 'miamidjbeat_pro_active')::boolean, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'not_eligible_miamidjbeat_pro',
        'user_id', p_uid::text,
        'effective', v_effective
      );
    END IF;
  ELSIF p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source THEN
    -- ── CANAL 1 · RENTA INDEPENDIENTE 19,99 USD/mes ──────────────────────────
    -- AQUÍ NO SE PUEDE VALIDAR CON mdjpro_effective_status, y esa es la trampa
    -- de esta rama: _mdjpro_standalone_active() devuelve true solo si YA existe
    -- una licencia standalone activa. Exigirlo haría que la PRIMERA emisión
    -- fallara siempre — no hay licencia sin estar activo, ni activo sin
    -- licencia. La rama de artista se libra porque su suscripción vive en
    -- dj_profiles, fuera de la tabla de licencias.
    --
    -- La prueba de pago es, por tanto, la SUSCRIPCIÓN DE STRIPE que entrega el
    -- llamador. stripe-webhook solo llega hasta aquí tras verificar la firma
    -- del evento, así que ese identificador ya viene autenticado por Stripe.
    IF p_stripe_subscription_id IS NULL OR btrim(p_stripe_subscription_id) = '' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'standalone_requires_subscription',
        'detail', 'p_stripe_subscription_id es obligatorio para mdjpro_standalone',
        'user_id', p_uid::text
      );
    END IF;
  ELSIF p_plan_source = 'manual'::public.mdjpro_plan_source THEN
    NULL;
  ELSE
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'unsupported_plan_source',
      'plan_source', p_plan_source::text
    );
  END IF;

  SELECT d.user_id, d.subscription_id
  INTO v_dj_user_id, v_mdb_subscription_id
  FROM public.dj_profiles d
  WHERE d.user_id = p_uid
  LIMIT 1;

  SELECT *
  INTO v_existing
  FROM public.mdjpro_license_keys lk
  WHERE lk.user_id = p_uid
  LIMIT 1;

  v_has_existing := FOUND;

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > v_max_attempts THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'key_generation_failed');
    END IF;

    v_plaintext := public._mdjpro_generate_license_key();
    v_normalized := public._mdjpro_normalize_license_key(v_plaintext);
    v_key_hash := public._mdjpro_hash_license_key(v_plaintext);
    v_key_last4 := right(v_normalized, 4);
    v_masked := public._mdjpro_mask_license_key(v_plaintext);

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.mdjpro_license_keys lk2
      WHERE lk2.key_hash = v_key_hash
    );
  END LOOP;

  IF v_has_existing THEN
    UPDATE public.mdjpro_license_keys lk
    SET
      key_prefix = v_key_prefix,
      key_hash = v_key_hash,
      key_last4 = v_key_last4,
      status = 'active'::public.mdjpro_license_status,
      tier = 'PREMIUM',
      plan_source = p_plan_source,
      -- Un solo Mac por renta independiente; el canal de artista mantiene 2.
      seats_allowed = CASE
        WHEN p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source THEN 1
        ELSE 2
      END,
      dj_profile_user_id = v_dj_user_id,
      mdb_stripe_subscription_id = CASE
        WHEN p_plan_source = 'miamidjbeat_pro'::public.mdjpro_plan_source THEN v_mdb_subscription_id
        ELSE lk.mdb_stripe_subscription_id
      END,
      stripe_subscription_id = CASE
        WHEN p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source THEN p_stripe_subscription_id
        ELSE lk.stripe_subscription_id
      END,
      stripe_customer_id = CASE
        WHEN p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source
             AND p_stripe_customer_id IS NOT NULL THEN p_stripe_customer_id
        ELSE lk.stripe_customer_id
      END,
      issued_at = now(),
      activated_at = NULL,
      suspended_at = NULL,
      revoked_at = NULL,
      -- Caduca con el periodo facturado por Stripe. El artista sigue en NULL
      -- porque su vigencia la gobierna dj_profiles, no una fecha copiada.
      expires_at = CASE
        WHEN p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source THEN p_period_end
        ELSE NULL
      END,
      plaintext_shown_at = NULL,
      updated_at = now()
    WHERE lk.user_id = p_uid
    RETURNING lk.id INTO v_license_id;
  ELSE
    INSERT INTO public.mdjpro_license_keys (
      user_id,
      dj_profile_user_id,
      key_prefix,
      key_hash,
      key_last4,
      status,
      tier,
      plan_source,
      seats_allowed,
      mdb_stripe_subscription_id,
      stripe_subscription_id,
      stripe_customer_id,
      expires_at,
      issued_at
    )
    VALUES (
      p_uid,
      v_dj_user_id,
      v_key_prefix,
      v_key_hash,
      v_key_last4,
      'active'::public.mdjpro_license_status,
      'PREMIUM',
      p_plan_source,
      CASE
        WHEN p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source THEN 1
        ELSE 2
      END,
      CASE
        WHEN p_plan_source = 'miamidjbeat_pro'::public.mdjpro_plan_source THEN v_mdb_subscription_id
        ELSE NULL
      END,
      CASE
        WHEN p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source THEN p_stripe_subscription_id
        ELSE NULL
      END,
      CASE
        WHEN p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source THEN p_stripe_customer_id
        ELSE NULL
      END,
      CASE
        WHEN p_plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source THEN p_period_end
        ELSE NULL
      END,
      now()
    )
    RETURNING id INTO v_license_id;
  END IF;

  INSERT INTO public.mdjpro_license_events (
    license_id,
    event_type,
    source,
    payload
  )
  VALUES (
    v_license_id,
    CASE WHEN v_has_existing THEN 'reissued' ELSE 'issued' END,
    'mdjpro_issue_license',
    jsonb_build_object(
      'user_id', p_uid::text,
      'plan_source', p_plan_source::text,
      'caller_uid', v_caller::text,
      'service_role', v_is_service,
      'key_prefix', v_key_prefix,
      'key_last4', v_key_last4
    )
  );

  -- license_key_plaintext MUST be shown to the user exactly once; never store plaintext in DB.
  RETURN jsonb_build_object(
    'ok', true,
    'license_key_plaintext', v_plaintext,
    'masked_key', v_masked,
    'user_id', p_uid::text,
    'status', 'active',
    'seats_allowed', 2,
    'plan_source', p_plan_source::text,
    'license_id', v_license_id::text,
    'reissued', v_has_existing
  );
END
$fn$;
COMMENT ON FUNCTION public.mdjpro_issue_license(uuid, public.mdjpro_plan_source, text, text, timestamptz) IS
  'Emite o re-emite licencia MDJPRO (canales miamidjbeat_pro, mdjpro_standalone y manual). license_key_plaintext solo debe mostrarse UNA vez; no se persiste.';

REVOKE ALL ON FUNCTION public.mdjpro_issue_license(uuid, public.mdjpro_plan_source, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_issue_license(uuid, public.mdjpro_plan_source, text, text, timestamptz) TO service_role;

COMMIT;

-- ── VERIFICACIÓN EN PRUEBA (solo lectura salvo donde se indique) ─────────────
--
-- 1) La firma nueva existe y la vieja ya no:
--    SELECT oid::regprocedure FROM pg_proc WHERE proname = 'mdjpro_issue_license';
--    Esperado: UNA fila, con los cinco parámetros.
--
-- 2) Standalone SIN suscripción debe ser rechazado (ya no 'unsupported'):
--    SELECT public.mdjpro_issue_license(
--      '<uuid de prueba>'::uuid, 'mdjpro_standalone');
--    Esperado: reason = 'standalone_requires_subscription'.
--
-- 3) Standalone CON suscripción emite, con 1 asiento y caducidad (ESCRIBE):
--    SELECT public.mdjpro_issue_license(
--      '<uuid de prueba>'::uuid, 'mdjpro_standalone',
--      'sub_PRUEBA123', 'cus_PRUEBA123', now() + interval '30 days');
--    Luego:
--    SELECT plan_source, seats_allowed, stripe_subscription_id, expires_at
--      FROM public.mdjpro_license_keys WHERE user_id = '<uuid de prueba>';
--    Esperado: mdjpro_standalone | 1 | sub_PRUEBA123 | ~30 días.
--
-- 4) NO REGRESIÓN del canal de artista — es la comprobación que importa:
--    SELECT public.mdjpro_issue_license('<uuid artista PRO>'::uuid, 'miamidjbeat_pro');
--    Esperado: ok = true, seats_allowed = 2, expires_at IS NULL.
--
-- ── REVERSIÓN ───────────────────────────────────────────────────────────────
-- Restaurar la versión anterior aplicando de nuevo
-- supabase/migrations/20260608100000_mdjpro_issue_license.sql, precedido de:
--   DROP FUNCTION IF EXISTS public.mdjpro_issue_license(uuid, public.mdjpro_plan_source, text, text, timestamptz);
