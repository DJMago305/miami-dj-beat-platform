-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENTORNO: PRUEBA  (mdjb-ensayo / Supabase local)                          ║
-- ║  NO APLICAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- M2 · audit_log — Constitución Maestra, Fase 3 (§22 y §23)
--
-- LA PROPIEDAD QUE IMPORTA
--   Un registro de auditoría que se puede editar o borrar no es auditoría: es una
--   nota. Por eso lo esencial de esta migración no es la tabla, son los dos
--   triggers que hacen imposible modificar o eliminar una fila ya escrita —
--   incluidos los del propio dueño de la cuenta y los de cualquier función de
--   servicio. Solo se puede añadir.
--
-- POR QUÉ DESPUÉS DE M1
--   Cada entrada apunta al FENIX-ID del actor y del recurso. Si el identificador
--   pudiera cambiar, el historial quedaría huérfano en cuanto alguien editase su
--   correo o su nombre artístico. M1 tenía que ir antes por eso exactamente.
--
-- QUÉ NO HACE
--   · No engancha triggers a las tablas de negocio todavía: eso es M8, cuando
--     exista can() y se sepa qué operaciones son sensibles. Aquí se entrega el
--     registrador y una prueba piloto sobre las tablas de perfil.
--   · No toca ninguna columna existente.
--   · No borra ni renombra nada. Reversible por completo.
--
-- SECRETOS
--   §22 pide guardar el detalle técnico para auditoría, pero nunca datos
--   sensibles innecesarios. La función de registro CENSURA por nombre de campo
--   (contraseñas, tokens, cuentas bancarias) antes de escribir. Lo que no se
--   guarda no se puede filtrar.

BEGIN;

-- ── 1 · La tabla ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ocurrido_en        timestamptz  NOT NULL DEFAULT now(),

  -- QUIÉN — el usuario de sesión y su identidad permanente (M1)
  actor_user_id      uuid,
  actor_profile_id   text,
  actor_rol          text,
  -- Si actúa por delegación (§24), aquí queda a nombre de quién actuaba.
  actor_en_nombre_de text,

  -- QUÉ
  accion             text  NOT NULL,   -- 'perfil.email.cambio', 'permiso.revocado'…
  recurso_tabla      text,
  recurso_id         text,
  recurso_profile_id text,             -- dueño del dato tocado

  -- CÓMO — §22 pide método de verificación y referencia de dispositivo
  metodo_verificacion text,            -- 'password' | '2fa_sms' | 'email_code' | null
  dispositivo         text,
  ip_referencia       inet,
  origen              text,            -- 'web' | 'edge' | 'sistema'

  -- RESULTADO — los intentos FALLIDOS también se registran: un ataque se ve en
  -- los rechazos, no en los éxitos.
  resultado          text  NOT NULL DEFAULT 'ok'
                     CHECK (resultado IN ('ok','denegado','error')),
  detalle            text,

  -- EL CAMBIO — ya censurado por la función de registro
  antes              jsonb,
  despues            jsonb
);

COMMENT ON TABLE  public.audit_log IS
  'M2 · Registro append-only de acciones sensibles. No editable ni borrable por diseño (§22).';
COMMENT ON COLUMN public.audit_log.actor_en_nombre_de IS
  'FENIX-ID del propietario cuando la acción se ejecuta por acceso delegado (§24).';
COMMENT ON COLUMN public.audit_log.resultado IS
  'Se registran también los intentos denegados: un ataque se detecta en los rechazos.';

CREATE INDEX IF NOT EXISTS ix_audit_actor    ON public.audit_log (actor_profile_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_audit_recurso  ON public.audit_log (recurso_profile_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_audit_accion   ON public.audit_log (accion, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_audit_fecha    ON public.audit_log (ocurrido_en DESC);

-- ── 2 · Append-only, sellado en la base ─────────────────────────────────────
--   Sin esto, cualquiera con permiso de escritura podría reescribir su propio
--   historial. Es la diferencia entre una auditoría y un cuaderno.
CREATE OR REPLACE FUNCTION public.mdj_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo escritura: no se permite % ', TG_OP
    USING ERRCODE = 'restrict_violation',
          HINT    = 'Un registro de auditoría modificable no es auditoría (Constitución §22).';
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

-- TRUNCATE — el agujero que los dos disparadores anteriores NO tapaban.
--   Descubierto el 2026-08-17 auditando privilegios reales en mdjb-ensayo:
--   los privilegios por defecto de Supabase concedían TRUNCATE sobre esta
--   tabla a `anon` y a `authenticated`. Y TRUNCATE no dispara disparadores de
--   FILA ni pasa por RLS: el historial no se podía editar ni borrar fila a
--   fila, pero se podía VACIAR ENTERO, y ni siquiera hacía falta sesión.
--   Requiere FOR EACH STATEMENT: no existe el TRUNCATE por filas.
CREATE OR REPLACE FUNCTION public.mdj_audit_no_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo escritura: no se permite TRUNCATE'
    USING ERRCODE = 'restrict_violation',
          HINT    = 'Un registro de auditoría vaciable no es auditoría (Constitución §22).';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_no_truncate ON public.audit_log;
CREATE TRIGGER trg_audit_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.mdj_audit_no_truncate();

-- ── 2b · Privilegios: quitar lo que los valores por defecto dan de más ──────
--   El disparador de arriba es la segunda barrera. Esta es la primera: que el
--   permiso no exista. Confiar en que «PostgREST no expone TRUNCATE» sería
--   seguridad por ocultamiento, que es justo lo que la Constitución prohíbe.
--
--   `anon` es el visitante SIN sesión. No tiene nada que hacer aquí, ni
--   siquiera leyendo.
REVOKE ALL ON public.audit_log FROM anon;

--   `authenticated` solo lee, y el RLS decide QUÉ lee. No escribe nunca a
--   mano: todo entra por mdj_auditar(), que es SECURITY DEFINER y no necesita
--   que el llamante tenga INSERT.
REVOKE ALL    ON public.audit_log FROM authenticated;
GRANT  SELECT ON public.audit_log TO   authenticated;

--   `service_role` salta el RLS y lo usan las Edge Functions. Puede leer y
--   registrar, pero append-only vale para todos: si el backend pudiera vaciar
--   el historial, una credencial filtrada borraría la prueba del robo.
REVOKE DELETE, TRUNCATE ON public.audit_log FROM service_role;

--   NOTA para el futuro: esto corrige ESTA tabla. `ALTER DEFAULT PRIVILEGES`
--   seguirá concediendo de más a las tablas que se creen mañana. Cada tabla
--   sensible nueva necesita su propio REVOKE explícito.

-- ── 3 · Censura de campos sensibles ─────────────────────────────────────────
--   Deja constancia de que el campo cambió, sin guardar su contenido: para
--   auditar basta saber que la contraseña se cambió, nunca cuál era.
--
--   POR QUÉ ES UNA LISTA DE PERMITIDOS Y NO DE PROHIBIDOS
--   Una lista de prohibidos falla ABIERTA: el día que alguien añada una columna
--   `documento_identidad` — sin acordarse de esta función — su contenido entra
--   al registro en claro. La versión anterior de este archivo tenía justamente
--   ese agujero: dejaba pasar `birth_date`, `address` y las tres columnas
--   `sft_pay_*_instructions`, que contienen el teléfono o correo de cobro del
--   artista. Y censuraba de más: `referral_code` caía por contener «code».
--   Invertido el criterio, una columna nueva y desconocida se registra como
--   cambiada pero sin valor. Falla CERRADA, que es lo que exige §22.
--
--   La lista de permitidos está INCOMPLETA a propósito: solo contiene columnas
--   verificadas contra el esquema real. Ampliarla es una decisión deliberada,
--   campo por campo; no se rellena «para que el log se vea mejor».
CREATE OR REPLACE FUNCTION public.mdj_audit_censurar(datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  -- Campos cuyo VALOR puede quedar escrito. Revisados UNO A UNO contra las 155
  -- columnas reales de producción (dj_profiles 110 + client_profiles 45,
  -- inventario del 2026-08-17). Nada de lo que está aquí sirve por sí solo para
  -- localizar a una persona en el mundo físico, cobrarle, ni suplantarla.
  permitidos CONSTANT text[] := ARRAY[
    -- ── identidad operativa y estado de cuenta ──
    -- `role`/`roles` es lo MÁS importante que este registro puede contener: una
    -- escalada de privilegios se ve aquí o no se ve en ninguna parte.
    'id','user_id','profile_id','role','roles','rol','status',
    'plan','plan_type','plan_status','plan_expires_at',
    'member_id','member_number','category','artist_specialty',
    'is_founder','is_premium','is_resident','is_commercial',
    'username','stage_name','dj_name','company_name','venue_type',
    'language','language_preference','auto_translate',
    'created_at','updated_at',

    -- ── correo ──
    -- Es el identificador con el que se inicia sesión, y cambiarlo es el primer
    -- paso clásico de un secuestro de cuenta: hace falta ver el antes y el
    -- después. `full_name` NO entra: es el nombre legal, y junto a fecha de
    -- nacimiento y domicilio compone una identidad robable.
    'email',

    -- ── estado de seguridad (el estado, nunca el secreto) ──
    -- Que alguien apagara el segundo factor es justo lo que hay que poder ver.
    -- `security_preference`, `known_devices` y `hardware_token` quedan fuera.
    --
    -- AVISO 2026-08-17: hoy `two_factor_enabled` es una columna MUERTA. Nada
    -- en el código la lee ni la escribe, y en producción está en `false` en
    -- todas las filas. Se deja declarada para cuando el segundo factor sea
    -- real; hasta entonces no audita nada porque nada la cambia. Que aparezca
    -- aquí no significa que la plataforma tenga 2FA.
    'two_factor_enabled',

    -- ── dinero y estado comercial ──
    -- Con valor a propósito: un saldo o una comisión que se mueve sin dueño es
    -- exactamente el fraude que este registro existe para detectar.
    'wallet_balance','rewards_balance','referral_credits','commission_rate',
    'hourly_rate_usd','sft_manual_fee_pending_cents','total_spent',
    'loyalty_points','vip_score','tier_level','buyer_billing_tier',
    'total_events','total_events_booked','discount_eligible',
    'billing_period','next_renewal','subscription_status',
    'soundfortips_active','soundfortips_platform_fee_blocked',
    'billing_same_as_home',
    -- `sft_platform_fee_last_error` NO entra: es texto libre devuelto por
    -- Stripe, y sus mensajes arrastran identificadores (cus_…, pi_…) y a veces
    -- los cuatro últimos dígitos de la tarjeta. Registrar su valor metería por
    -- detrás justo lo que `card_last4` bloquea por delante. Regla: si no se
    -- puede predecir qué contiene un campo, su valor no se escribe.

    -- ── atribución de referidos ──
    -- Legible por decisión de producto: sin esto no se puede liquidar comisión.
    'referral_code','referred_by','referral_id','source_ref','reference_code',

    -- ── ficha pública (ya visible en el perfil de cara al mundo) ──
    'bio','bio_short','bio_long','bio_en','city','region','rating',
    'review_count','photo_url','avatar_url','background_url','cover_url',
    'photo_status','photo_rejected_reason','photo_focal_x','photo_focal_y',
    'hero_bg_zoom','social_links','social_instagram','social_tiktok',
    'social_youtube','social_facebook','social_soundcloud','social_mixcloud',
    'social_spotify','social_apple','social_web','social_beatport',
    'youtube_url','beatport_url','spotify_url','soundcloud_url',
    'instagram_url','tiktok_url','apple_music_url','twitter_url',
    'facebook_url','website_url','shazam_url',

    -- ── disponibilidad y agenda ──
    'available','availability','availability_schedule','busy_dates',
    'active_days','preferred_schedule','weekly_schedule','venue_schedule',
    'work_start','work_end','vacation_start','vacation_end',
    'advance_notice_hours','current_venue',

    -- ── preferencias de aviso ──
    'notify_email_bookings','notify_email_marketing','notify_sms',

    -- ── concesiones de permiso (M3) ──
    -- No son columnas de perfil: son las claves que M3 escribe al registrar un
    -- permiso. Un registro de permisos que no dice a quién, para qué ni hasta
    -- dónde no sirve de nada, así que su contenido tiene que ser legible.
    -- Llevan prefijo para que añadirlas aquí no abra de rebote una columna
    -- futura llamada `ref`, `nivel` o `motivo`.
    'permiso_beneficiario','permiso_ref','permiso_alcance','permiso_nivel',
    'permiso_limites','permiso_motivo',

    -- ── dispositivos (M4) ──
    -- Identifican el equipo ante una persona —«el MacBook, macOS, visto el
    -- martes»— sin exponer nada del aparato. `dispositivo_id` es un uuid
    -- nuestro, no derivado del hardware. La HUELLA (`device_fingerprint`) no
    -- está aquí y no debe estarlo: es un identificador de máquina física, y
    -- guardarlo convertiría el registro que protege a la persona en un rastro
    -- de seguimiento. Misma razón por la que `known_devices` está fuera.
    'dispositivo_id','dispositivo_nombre','dispositivo_plataforma',
    'dispositivo_zona','dispositivo_visto_por_ultima_vez'
  ];

  -- QUEDAN FUERA, y es deliberado — se registra que cambiaron, nunca su valor:
  --   tarjeta ....... card_last4, card_brand, card_holder, card_expiry,
  --                   billing_name_on_card
  --   cobro ......... sft_pay_zelle_instructions, sft_pay_venmo_instructions,
  --                   sft_pay_paypal_instructions
  --   pagos ext. .... stripe_customer_id, buyer_stripe_customer_id,
  --                   subscription_id
  --   domicilio ..... address, address_street, address_apt, address_state,
  --                   address_zip, address_country, billing_street,
  --                   billing_apt, billing_city, billing_state, billing_zip,
  --                   billing_country
  --   PII ........... full_name, phone, birth_date, wedding_anniversary
  --   seguridad ..... security_preference, known_devices, hardware_token
  --   texto ajeno ... sft_platform_fee_last_error (lo escribe Stripe)
  -- Y cualquier columna futura que nadie añada aquí. Ese es el punto.
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

-- ── 4 · Registrador ─────────────────────────────────────────────────────────
--   SECURITY DEFINER: escribe aunque el llamante no tenga permiso directo sobre
--   la tabla. Es lo que permite cerrar audit_log a escritura pública y aun así
--   registrar desde cualquier flujo autorizado.
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
  v_pid  text;
  v_rol  text;
  v_id   bigint;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT profile_id, role INTO v_pid, v_rol
      FROM public.dj_profiles WHERE user_id = v_uid LIMIT 1;
    IF v_pid IS NULL THEN
      SELECT profile_id, 'client' INTO v_pid, v_rol
        FROM public.client_profiles WHERE user_id = v_uid LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    actor_user_id, actor_profile_id, actor_rol, actor_en_nombre_de,
    accion, recurso_tabla, recurso_id, recurso_profile_id,
    metodo_verificacion, dispositivo, ip_referencia, origen,
    resultado, detalle, antes, despues
  ) VALUES (
    v_uid, v_pid, v_rol, p_en_nombre_de,
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

-- ── 4b · «¿Qué perfiles son míos?» ─────────────────────────────────────────
--   POR QUÉ ESTO EXISTE Y NO ES UNA SUBCONSULTA SUELTA
--   La primera versión de las políticas de M2 y M3 preguntaba directamente
--   `SELECT profile_id FROM dj_profiles WHERE user_id = auth.uid()`. Esa
--   subconsulta se ejecuta con el rol del llamante, así que queda sujeta al RLS
--   de `dj_profiles`. Si esa tabla no le contesta —el 2026-08-17 en mdjb-ensayo
--   tenía RLS activo y CERO políticas, que en Postgres significa denegar todo—
--   la subconsulta vuelve vacía y la política deniega a TODO EL MUNDO, incluido
--   el dueño. Y un `0` por denegación universal es indistinguible de un `0` por
--   aislamiento correcto: así se cuela un falso positivo en una suite de
--   seguridad.
--
--   SECURITY DEFINER rompe esa dependencia: la pregunta se responde siempre,
--   con independencia de cómo esté configurado el RLS de las tablas de perfil
--   hoy o dentro de seis meses.
--
--   Devuelve un CONJUNTO, no un valor: una misma persona puede tener perfil de
--   artista y de cliente, y quedarse con el primero le escondería la mitad de
--   su propio historial.
CREATE OR REPLACE FUNCTION public.mdj_perfiles_de_usuario(p_uid uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profile_id FROM public.dj_profiles     WHERE user_id = p_uid
  UNION
  SELECT profile_id FROM public.client_profiles WHERE user_id = p_uid;
$$;

COMMENT ON FUNCTION public.mdj_perfiles_de_usuario(uuid) IS
  'M2 · Todos los FENIX-ID de un usuario. SECURITY DEFINER: las políticas RLS no pueden depender del RLS de otra tabla.';

--   Variante escalar, por comodidad de quien solo necesita uno (M4 la usa para
--   etiquetar el dueño de un dispositivo). Misma lógica, un solo lugar.
CREATE OR REPLACE FUNCTION public.mdj_profile_de_usuario(p_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mdj_perfiles_de_usuario(p_uid) LIMIT 1;
$$;

COMMENT ON FUNCTION public.mdj_profile_de_usuario(uuid) IS
  'M2 · Un FENIX-ID del usuario (el primero). Para etiquetar, no para decidir permisos.';


-- ── 5 · RLS: cada uno ve su historial, nadie escribe a mano ─────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit: cada quien lee lo suyo" ON public.audit_log;
CREATE POLICY "audit: cada quien lee lo suyo"
  ON public.audit_log FOR SELECT
  USING (
    actor_user_id = auth.uid()
    OR recurso_profile_id IN (SELECT public.mdj_perfiles_de_usuario(auth.uid()))
  );

-- Sin política de INSERT/UPDATE/DELETE a propósito: con RLS activo y sin
-- política, esas operaciones quedan denegadas para todos. La única vía de
-- escritura es mdj_auditar(), que es SECURITY DEFINER y controlada.

-- ── 6 · Piloto sobre las tablas de perfil ───────────────────────────────────
--   Un trigger genérico que registra cambios en los perfiles. Es la prueba viva
--   de que el registrador funciona antes de extenderlo en M8.
CREATE OR REPLACE FUNCTION public.mdj_audit_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes   jsonb := to_jsonb(OLD);
  v_despues jsonb := to_jsonb(NEW);
  v_cambios jsonb := '{}'::jsonb;
  k text;
BEGIN
  -- Solo se guarda lo que REALMENTE cambió: un volcado completo en cada
  -- actualización haría la tabla ilegible y multiplicaría el dato sensible.
  FOR k IN SELECT jsonb_object_keys(v_despues) LOOP
    IF v_antes -> k IS DISTINCT FROM v_despues -> k THEN
      v_cambios := jsonb_set(v_cambios, ARRAY[k],
        jsonb_build_object('antes', v_antes -> k, 'despues', v_despues -> k));
    END IF;
  END LOOP;

  IF v_cambios = '{}'::jsonb THEN RETURN NEW; END IF;

  -- Las columnas se leen del jsonb, NUNCA como NEW.<campo>: un `NEW.id` sobre
  -- una tabla que no tiene `id` aborta el UPDATE entero y deja al usuario sin
  -- poder editar su perfil. `->>` devuelve NULL cuando la clave no existe, así
  -- que el registrador se adapta a la tabla en vez de imponerle un esquema.
  PERFORM public.mdj_auditar(
    p_accion             => TG_TABLE_NAME || '.actualizado',
    p_recurso_tabla      => TG_TABLE_NAME,
    p_recurso_id         => COALESCE(v_despues ->> 'id',
                                     v_despues ->> 'user_id',
                                     v_despues ->> 'profile_id'),
    p_recurso_profile_id => v_despues ->> 'profile_id',
    p_despues            => v_cambios,
    p_origen             => 'sistema'
  );
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text; tablas text[] := ARRAY['dj_profiles','client_profiles'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_auditoria ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_auditoria AFTER UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.mdj_audit_perfil()', t, t);
    RAISE NOTICE 'M2: auditoría activa sobre public.%', t;
  END LOOP;
END $$;

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN — ejecutar DESPUÉS, como consultas independientes          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · La tabla existe y está vacía o con lo ya registrado
--   SELECT count(*) AS entradas FROM public.audit_log;
--
-- V2 · El registrador escribe
--   SELECT public.mdj_auditar('prueba.m2', 'audit_log', NULL, NULL,
--          NULL, '{"campo":"valor"}'::jsonb) AS id_generado;
--   -- ESPERADO: devuelve un bigint.
--
-- V3 · La censura funciona (LA PRUEBA QUE IMPORTA)
--   Se prueban las tres clases a la vez: un campo permitido, un secreto obvio,
--   y — la que importa — un campo sensible que NADIE puso en ninguna lista.
--
--   SELECT public.mdj_auditar('prueba.censura', NULL, NULL, NULL, NULL,
--          '{"email":"a@b.com","password":"secreto123",
--            "birth_date":"1990-01-01","documento_identidad":"X-999",
--            "referral_code":"MDJB-77"}'::jsonb);
--   SELECT despues FROM public.audit_log WHERE accion = 'prueba.censura';
--
--   -- ESPERADO:
--   --   email          → "a@b.com"          (permitido)
--   --   referral_code  → "MDJB-77"          (permitido: hace falta para liquidar)
--   --   password       → "[no registrado]"
--   --   birth_date     → "[no registrado]"
--   --   documento_identidad → "[no registrado]"
--   --
--   -- `documento_identidad` es la prueba real: es un campo inventado que no
--   -- aparece en ninguna lista de este archivo. Si sale con su valor en claro,
--   -- la censura falla abierta y M2 NO debe aplicarse en producción.
--
-- V4 · Append-only: AMBAS deben FALLAR
--   UPDATE public.audit_log SET detalle = 'manipulado' WHERE id = 1;
--   -- ESPERADO: ERROR 'audit_log es de solo escritura'
--   DELETE FROM public.audit_log WHERE id = 1;
--   -- ESPERADO: ERROR 'audit_log es de solo escritura'
--   -- Si CUALQUIERA de las dos tiene éxito, M2 NO puede darse por válida.
--
-- V5 · El piloto registra cambios reales de perfil
--   UPDATE public.dj_profiles SET city = city WHERE profile_id IS NOT NULL LIMIT 1;
--   -- (no cambia nada → no debe registrar)
--   SELECT count(*) FROM public.audit_log WHERE accion = 'dj_profiles.actualizado';
--   -- ESPERADO: 0 — solo se registra lo que de verdad cambia.
--
-- V6 · Aislamiento por RLS
--   -- Con sesión de un usuario cualquiera:
--   SELECT count(*) FROM public.audit_log;
--   -- ESPERADO: solo sus propias filas. Nunca las de otro perfil.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  REVERSIÓN COMPLETA                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
--   BEGIN;
--   DO $$
--   DECLARE t text; tablas text[] := ARRAY['dj_profiles','client_profiles'];
--   BEGIN
--     FOREACH t IN ARRAY tablas LOOP
--       IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
--       EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_auditoria ON public.%I', t, t);
--     END LOOP;
--   END $$;
--   DROP FUNCTION IF EXISTS public.mdj_audit_perfil();
--   DROP FUNCTION IF EXISTS public.mdj_auditar(text,text,text,text,jsonb,jsonb,text,text,inet,text,text,text,text);
--   DROP FUNCTION IF EXISTS public.mdj_audit_censurar(jsonb);
--   DROP TRIGGER IF EXISTS trg_audit_no_update ON public.audit_log;
--   DROP TRIGGER IF EXISTS trg_audit_no_delete ON public.audit_log;
--   DROP FUNCTION IF EXISTS public.mdj_audit_append_only();
--   DROP TABLE IF EXISTS public.audit_log;
--   COMMIT;
--
--   ADVERTENCIA: revertir M2 DESTRUYE el historial de auditoría acumulado. No
--   toca ninguna columna preexistente de las tablas de negocio, pero lo que se
--   borra aquí no se puede reconstruir. Exportar antes si el historial importa.
