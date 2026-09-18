-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-18
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO ("arregla el
-- mdj_auditar para producción")
-- ============================================================
--
-- Contexto: supabase/migrations/20260817010000_m2_audit_log.sql (audit_log +
-- mdj_auditar()) quedó marcado "ENTORNO: PRUEBA -- no aplicar en producción
-- sin autorización expresa del PO" porque depende conceptualmente de M1
-- (FENIX-ID / columna profile_id inmutable en dj_profiles/client_profiles).
-- Verificado hoy: esa columna profile_id NO existe en producción (M1 nunca se
-- aplicó aquí, solo en el entorno de ensayo) -- aplicar M2 tal cual rompería
-- en el primer INSERT ("column profile_id does not exist").
--
-- Dos features construidas hoy mismo (residency-schedule-manage/index.ts y
-- el borrado de leads en calendario-operacional-inteligente.html) ya llaman
-- a mdj_auditar() dando por hecho que existe -- la acción real siempre
-- funciona, pero la llamada de auditoría falla en silencio (try/catch mudo)
-- y no queda NINGÚN rastro. El PO pidió arreglar puntualmente eso, no
-- adoptar el sistema FENIX-ID completo (esa es una decisión más grande, ya
-- señalada aparte en memoria como pendiente/contradictoria).
--
-- Este script es una versión standalone de mdj_auditar(), sin ninguna
-- dependencia de M1: usa auth.uid() + dj_profiles.role (columna que sí
-- existe) en vez de profile_id. Misma firma de parámetros que M2 (los
-- nombres que ya usa el código de hoy: p_accion, p_recurso_tabla,
-- p_recurso_id, p_antes, p_despues, p_origen, p_resultado, p_detalle),
-- mismas protecciones append-only/no-truncate/censura de campos sensibles.
--
-- NO incluye la sección 6 de M2 (trigger automático de auditoría sobre
-- dj_profiles/client_profiles en cada UPDATE) -- eso es una feature nueva no
-- pedida, fuera del alcance de "arregla mdj_auditar". Si se quiere después,
-- es un ticket aparte.
--
-- Si el día de mañana se aplica M1 de verdad, este audit_log no necesita
-- migrar: actor_profile_id/recurso_profile_id quedan como columnas nullable
-- ya declaradas, listas para que una versión futura de mdj_auditar() las
-- empiece a rellenar sin tocar el esquema.

BEGIN;

-- ── 1 · La tabla (idéntica a M2) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ocurrido_en        timestamptz  NOT NULL DEFAULT now(),

  actor_user_id      uuid,
  actor_profile_id   text,   -- reservada para cuando exista M1; hoy siempre NULL
  actor_rol          text,
  actor_en_nombre_de text,

  accion             text  NOT NULL,
  recurso_tabla      text,
  recurso_id         text,
  recurso_profile_id text,  -- reservada para cuando exista M1; hoy siempre NULL

  metodo_verificacion text,
  dispositivo         text,
  ip_referencia        inet,
  origen               text,

  resultado          text  NOT NULL DEFAULT 'ok'
                     CHECK (resultado IN ('ok','denegado','error')),
  detalle            text,

  antes              jsonb,
  despues            jsonb
);

COMMENT ON TABLE public.audit_log IS
  'Registro append-only de acciones sensibles. No editable ni borrable por diseño. Versión standalone de producción (ver 20260918140000_mdj_auditar_produccion.sql) -- actor_profile_id/recurso_profile_id quedan sin usar hasta que M1 (FENIX-ID) se aplique aquí.';

CREATE INDEX IF NOT EXISTS ix_audit_actor_user ON public.audit_log (actor_user_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_audit_recurso    ON public.audit_log (recurso_tabla, recurso_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_audit_accion     ON public.audit_log (accion, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_audit_fecha      ON public.audit_log (ocurrido_en DESC);

-- ── 2 · Append-only, sellado en la base (idéntico a M2) ─────────────────────
CREATE OR REPLACE FUNCTION public.mdj_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo escritura: no se permite %', TG_OP
    USING ERRCODE = 'restrict_violation',
          HINT    = 'Un registro de auditoría modificable no es auditoría.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_no_update ON public.audit_log;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.mdj_audit_append_only();

DROP TRIGGER IF EXISTS trg_audit_no_delete ON public.audit_log;
CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.mdj_audit_append_only();

CREATE OR REPLACE FUNCTION public.mdj_audit_no_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo escritura: no se permite TRUNCATE'
    USING ERRCODE = 'restrict_violation',
          HINT    = 'Un registro de auditoría vaciable no es auditoría.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_no_truncate ON public.audit_log;
CREATE TRIGGER trg_audit_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.mdj_audit_no_truncate();

-- ── 2b · Privilegios (idéntico a M2 en criterio) ────────────────────────────
REVOKE ALL ON public.audit_log FROM anon;
REVOKE ALL    ON public.audit_log FROM authenticated;
GRANT  SELECT ON public.audit_log TO   authenticated;
REVOKE DELETE, TRUNCATE ON public.audit_log FROM service_role;

-- ── 3 · Censura de campos sensibles (idéntica a M2) ─────────────────────────
-- Lista de PERMITIDOS (falla cerrada): un campo nuevo/desconocido se registra
-- como cambiado pero sin valor, nunca al revés.
CREATE OR REPLACE FUNCTION public.mdj_audit_censurar(datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  permitidos CONSTANT text[] := ARRAY[
    'id','user_id','profile_id','role','roles','rol','status',
    'plan','plan_type','plan_status','plan_expires_at',
    'member_id','member_number','category','artist_specialty',
    'is_founder','is_premium','is_resident','is_commercial',
    'username','stage_name','dj_name','company_name','venue_type',
    'language','language_preference','auto_translate',
    'created_at','updated_at',
    'email',
    'two_factor_enabled',
    'wallet_balance','rewards_balance','referral_credits','commission_rate',
    'hourly_rate_usd','sft_manual_fee_pending_cents','total_spent',
    'loyalty_points','vip_score','tier_level','buyer_billing_tier',
    'total_events','total_events_booked','discount_eligible',
    'billing_period','next_renewal','subscription_status',
    'soundfortips_active','soundfortips_platform_fee_blocked',
    'billing_same_as_home',
    'referral_code','referred_by','referral_id','source_ref','reference_code',
    'bio','bio_short','bio_long','bio_en','city','region','rating',
    'review_count','photo_url','avatar_url','background_url','cover_url',
    'photo_status','photo_rejected_reason','photo_focal_x','photo_focal_y',
    'hero_bg_zoom','social_links','social_instagram','social_tiktok',
    'social_youtube','social_facebook','social_soundcloud','social_mixcloud',
    'social_spotify','social_apple','social_web','social_beatport',
    'youtube_url','beatport_url','spotify_url','soundcloud_url',
    'instagram_url','tiktok_url','apple_music_url','twitter_url',
    'facebook_url','website_url','shazam_url',
    'available','availability','availability_schedule','busy_dates',
    'active_days','preferred_schedule','weekly_schedule','venue_schedule',
    'work_start','work_end','vacation_start','vacation_end',
    'advance_notice_hours','current_venue',
    'notify_email_bookings','notify_email_marketing','notify_sms',
    -- claves propias de las escrituras de hoy (residency-schedule-manage /
    -- calendario-operacional-inteligente.html) -- sin PII, seguras de guardar
    -- en claro para que el registro sirva de algo:
    'accion','dia_semana','turno','venue','dj_nombre','hora_inicio',
    'hora_fin','venue_pay_usd','dj_pay_usd','notas','residency_id',
    'exception_date','skip','event_date','event_type','event_start_time',
    'event_end_time'
  ];
  clave text;
  salida jsonb := COALESCE(datos, '{}'::jsonb);
BEGIN
  IF datos IS NULL THEN RETURN NULL; END IF;
  FOR clave IN SELECT jsonb_object_keys(salida) LOOP
    IF NOT (lower(clave) = ANY (permitidos)) THEN
      salida := jsonb_set(salida, ARRAY[clave], '"[no registrado]"'::jsonb);
    END IF;
  END LOOP;
  RETURN salida;
END;
$$;

-- ── 4 · Registrador -- SIN dependencia de M1/profile_id ─────────────────────
CREATE OR REPLACE FUNCTION public.mdj_auditar(
  p_accion              text,
  p_recurso_tabla       text    DEFAULT NULL,
  p_recurso_id          text    DEFAULT NULL,
  p_recurso_profile_id  text    DEFAULT NULL,
  p_antes               jsonb   DEFAULT NULL,
  p_despues             jsonb   DEFAULT NULL,
  p_metodo_verificacion text    DEFAULT NULL,
  p_dispositivo         text    DEFAULT NULL,
  p_ip                  inet    DEFAULT NULL,
  p_origen              text    DEFAULT 'web',
  p_resultado           text    DEFAULT 'ok',
  p_detalle             text    DEFAULT NULL,
  p_en_nombre_de        text    DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_rol  text;
  v_id   bigint;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT role INTO v_rol FROM public.dj_profiles WHERE user_id = v_uid LIMIT 1;
    IF v_rol IS NULL AND EXISTS (SELECT 1 FROM public.client_profiles WHERE user_id = v_uid) THEN
      v_rol := 'client';
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    actor_user_id, actor_rol, actor_en_nombre_de,
    accion, recurso_tabla, recurso_id, recurso_profile_id,
    metodo_verificacion, dispositivo, ip_referencia, origen,
    resultado, detalle, antes, despues
  ) VALUES (
    v_uid, v_rol, p_en_nombre_de,
    p_accion, p_recurso_tabla, p_recurso_id, p_recurso_profile_id,
    p_metodo_verificacion, p_dispositivo, p_ip, p_origen,
    p_resultado, p_detalle,
    public.mdj_audit_censurar(p_antes),
    public.mdj_audit_censurar(p_despues)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mdj_auditar(text,text,text,text,jsonb,jsonb,text,text,inet,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mdj_auditar(text,text,text,text,jsonb,jsonb,text,text,inet,text,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mdj_auditar(text,text,text,text,jsonb,jsonb,text,text,inet,text,text,text,text) TO authenticated;

-- ── 5 · RLS: cada quien lee lo suyo, staff lee todo ─────────────────────────
-- (Sin mdj_perfiles_de_usuario()/profile_id -- no existe la base de M1 aquí.
-- is_staff() ya existe y ya es el patrón usado por el resto de la plataforma
-- para "el staff ve todo".)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit: cada quien lee lo suyo" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log: propio o staff" ON public.audit_log;
CREATE POLICY "audit_log: propio o staff"
  ON public.audit_log FOR SELECT
  USING (
    actor_user_id = auth.uid()
    OR public.is_staff(auth.uid())
  );

-- Sin política de INSERT/UPDATE/DELETE a propósito: con RLS activo y sin
-- política, esas operaciones quedan denegadas para todos. La única vía de
-- escritura es mdj_auditar(), SECURITY DEFINER.

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICACIÓN -- ejecutar después, como consultas independientes
-- ============================================================
-- V1 · El registrador escribe:
--   SELECT public.mdj_auditar('prueba.produccion', 'audit_log', NULL, NULL,
--          NULL, '{"campo":"valor"}'::jsonb) AS id_generado;
--   -- ESPERADO: devuelve un bigint.
--
-- V2 · La censura falla cerrada:
--   SELECT public.mdj_auditar('prueba.censura', NULL, NULL, NULL, NULL,
--          '{"email":"a@b.com","password":"secreto123",
--            "birth_date":"1990-01-01","documento_identidad":"X-999"}'::jsonb);
--   SELECT despues FROM public.audit_log WHERE accion = 'prueba.censura';
--   -- ESPERADO: email en claro, password/birth_date/documento_identidad → "[no registrado]"
--
-- V3 · Append-only -- AMBAS deben FALLAR:
--   UPDATE public.audit_log SET detalle = 'manipulado' WHERE id = 1;
--   DELETE FROM public.audit_log WHERE id = 1;
--
-- V4 · Las dos features de hoy ya escriben de verdad:
--   SELECT * FROM public.audit_log WHERE accion LIKE 'residencia.%' OR accion = 'evento.eliminado' ORDER BY ocurrido_en DESC LIMIT 10;

-- ============================================================
-- REVERSIÓN
-- ============================================================
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.mdj_auditar(text,text,text,text,jsonb,jsonb,text,text,inet,text,text,text,text);
--   DROP FUNCTION IF EXISTS public.mdj_audit_censurar(jsonb);
--   DROP TRIGGER IF EXISTS trg_audit_no_update ON public.audit_log;
--   DROP TRIGGER IF EXISTS trg_audit_no_delete ON public.audit_log;
--   DROP TRIGGER IF EXISTS trg_audit_no_truncate ON public.audit_log;
--   DROP FUNCTION IF EXISTS public.mdj_audit_append_only();
--   DROP FUNCTION IF EXISTS public.mdj_audit_no_truncate();
--   DROP TABLE IF EXISTS public.audit_log;
--   COMMIT;
--   ADVERTENCIA: destruye el historial acumulado. Exportar antes si importa.
