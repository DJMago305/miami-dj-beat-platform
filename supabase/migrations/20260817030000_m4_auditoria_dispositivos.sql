-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo                                          ║
-- ║  NO EJECUTAR EN PRODUCCIÓN                                               ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  M4 · AUDITORÍA DE DISPOSITIVOS                                          ║
-- ║  Requisitos: M1, M2 y M3 aplicadas.                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ESTA MIGRACIÓN NO CREA NINGUNA TABLA. Y ese es su contenido principal.
--
-- QUÉ SE ENCONTRÓ (inspección forense del 2026-08-17)
--   El plan original era crear `user_devices`. Habría sido el TERCER mecanismo
--   de dispositivos de la plataforma. Ya existen dos:
--
--   A · public.user_login_devices — VIVO
--       Tabla completa con RLS y dos RPC, creada en
--       20260430160000_security_known_devices_login.sql y ampliada en
--       20260527200000_user_login_devices_delete_and_name.sql.
--       Se usa de verdad: web/auth.js llama a mdj_record_login_device() en
--       cada login con contraseña, y account-settings.html y staff-config.html
--       pintan la lista de dispositivos del usuario.
--       Guarda huella, user_agent, plataforma, zona horaria aproximada,
--       primera y última vez visto, y un nombre editable.
--
--   B · dj_profiles.known_devices / security_preference / two_factor_enabled
--       MUERTO. Las creó web/sql/migrations/05_security_alerts_infra.sql,
--       fuera del historial de supabase/migrations. Su único consumidor es
--       web/security-shield.js, que se carga en login.html y NUNCA se invoca:
--       define window.MIAMI_DJ_SECURITY y ninguna otra línea lo llama.
--       Verificado en producción el 2026-08-17: 0 perfiles con dispositivos,
--       0 con two_factor_enabled, y un único valor distinto de
--       security_preference (el DEFAULT). Cero datos.
--       NO SE TOCAN AQUÍ. Retirarlas es una decisión de producto con informe
--       propio; esta migración solo deja constancia de lo encontrado.
--
-- QUÉ HACE M4 ENTONCES
--   `user_login_devices` resuelve la persistencia mejor de lo que la habría
--   resuelto una tabla nueva. Lo que NO tiene es rastro: hoy un dispositivo
--   nuevo entra sin dejar constancia, y eliminarlo lo borra sin dejar nada.
--   Cualquiera con la sesión de una persona puede quitar la prueba de desde
--   qué máquina entró. Eso es justo lo que §22 no permite.
--
--   M4 = enganchar lo que ya existe a la auditoría de M2, y taparle el mismo
--   agujero de privilegios que se encontró en audit_log.

BEGIN;

-- ── 0 · Guardia: la tabla tiene que existir ────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.user_login_devices') IS NULL THEN
    RAISE EXCEPTION
      'M4 requiere public.user_login_devices. Falta aplicar 20260430160000_security_known_devices_login.sql';
  END IF;
END $$;


-- ── 1 · Quién es el dueño, en FENIX-ID ─────────────────────────────────────
--   `user_login_devices` se identifica por user_id (auth.users). El resto de
--   la Constitución razona en FENIX-ID. Sin esta traducción, el rastro del
--   dispositivo no se podría cruzar con el rastro del perfil.
--
--   La función VIVE EN M2, no aquí. Estuvo definida en este archivo hasta el
--   2026-08-17, cuando las políticas de M2 y M3 pasaron a necesitarla; tener
--   dos copias de una función de seguridad es la clase de duplicado que acaba
--   divergiendo en silencio. Aquí solo se comprueba que existe.
DO $$
BEGIN
  IF to_regprocedure('public.mdj_profile_de_usuario(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'M4 requiere public.mdj_profile_de_usuario(uuid), que define M2. Aplica 20260817010000_m2_audit_log.sql primero';
  END IF;
END $$;


-- ── 2 · El rastro ──────────────────────────────────────────────────────────
--   Tres sucesos, y solo tres. `last_seen_at` cambia en CADA inicio de sesión:
--   registrarlo inundaría el historial con ruido hasta volverlo ilegible, y un
--   registro que nadie puede leer no protege a nadie.
--
--   LA HUELLA NO SE REGISTRA. `device_fingerprint` identifica una máquina
--   física; guardarlo en el historial sería crear un rastro de seguimiento
--   dentro de la tabla que existe para proteger a la persona. Lo mismo que
--   `known_devices`, que M2 ya bloquea. Se registra el `id` interno —que es un
--   uuid nuestro, no derivado del hardware— y con él se correlaciona sin
--   exponer nada del dispositivo.
CREATE OR REPLACE FUNCTION public.mdj_auditar_dispositivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fila    record := COALESCE(NEW, OLD);
  v_accion  text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_accion := 'dispositivo.registrado';
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'dispositivo.eliminado';
  ELSIF NEW.device_name IS DISTINCT FROM OLD.device_name THEN
    v_accion := 'dispositivo.renombrado';
  ELSE
    RETURN NEW;   -- solo cambió last_seen_at: no es un suceso, es rutina
  END IF;

  PERFORM public.mdj_auditar(
    p_accion             => v_accion,
    p_recurso_tabla      => 'user_login_devices',
    p_recurso_id         => v_fila.id::text,
    p_recurso_profile_id => public.mdj_profile_de_usuario(v_fila.user_id),
    p_despues            => jsonb_build_object(
                              'dispositivo_id',        v_fila.id,
                              'dispositivo_nombre',    v_fila.device_name,
                              'dispositivo_plataforma',v_fila.platform_label,
                              'dispositivo_zona',      v_fila.approximate_tz,
                              'dispositivo_visto_por_ultima_vez', v_fila.last_seen_at),
    p_origen             => 'sistema'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dispositivo_auditar_ins ON public.user_login_devices;
CREATE TRIGGER trg_dispositivo_auditar_ins
  AFTER INSERT ON public.user_login_devices
  FOR EACH ROW EXECUTE FUNCTION public.mdj_auditar_dispositivo();

DROP TRIGGER IF EXISTS trg_dispositivo_auditar_upd ON public.user_login_devices;
CREATE TRIGGER trg_dispositivo_auditar_upd
  AFTER UPDATE ON public.user_login_devices
  FOR EACH ROW EXECUTE FUNCTION public.mdj_auditar_dispositivo();

-- El borrado SÍ se permite: una persona tiene derecho a retirar un equipo de
-- su lista. Lo que no se permite es que ese borrado sea invisible. La entrada
-- queda en audit_log, que es append-only: la fila se va, la prueba no.
DROP TRIGGER IF EXISTS trg_dispositivo_auditar_del ON public.user_login_devices;
CREATE TRIGGER trg_dispositivo_auditar_del
  AFTER DELETE ON public.user_login_devices
  FOR EACH ROW EXECUTE FUNCTION public.mdj_auditar_dispositivo();


-- ── 3 · El mismo agujero de privilegios que tenía audit_log ────────────────
--   Esta tabla se creó con GRANT explícitos, pero los privilegios por defecto
--   de Supabase se aplicaron igual: hay que comprobar `anon` y TRUNCATE.
--   Un TRUNCATE aquí borraría de golpe la lista de equipos de TODA la
--   plataforma, sin pasar por RLS ni disparar los triggers de fila de arriba.
CREATE OR REPLACE FUNCTION public.mdj_dispositivos_no_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'user_login_devices no se vacía: los dispositivos se eliminan uno a uno'
    USING ERRCODE = 'restrict_violation',
          HINT    = 'Un TRUNCATE saltaría la auditoría de M4 y borraría la lista de todos.';
END;
$$;

DROP TRIGGER IF EXISTS trg_dispositivos_no_truncate ON public.user_login_devices;
CREATE TRIGGER trg_dispositivos_no_truncate
  BEFORE TRUNCATE ON public.user_login_devices
  FOR EACH STATEMENT EXECUTE FUNCTION public.mdj_dispositivos_no_truncate();

--   `anon` no tiene sesión: no puede ver ni tocar la lista de equipos de nadie.
REVOKE ALL ON public.user_login_devices FROM anon;

--   `authenticated` conserva lo que la aplicación usa de verdad —consultar,
--   registrar, renombrar y eliminar SUS equipos, filtrado por RLS— y pierde
--   TRUNCATE, que ninguna pantalla necesita.
REVOKE TRUNCATE ON public.user_login_devices FROM authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.user_login_devices TO authenticated;

REVOKE TRUNCATE ON public.user_login_devices FROM service_role;

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DEPENDENCIA CON M2                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--   Las claves `dispositivo_*` tienen que estar en la lista de permitidos de
--   mdj_audit_censurar(), o el rastro saldrá en blanco. Ya están añadidas en
--   20260817010000_m2_audit_log.sql: REAPLICA M2 ANTES QUE M4.
--
--   OLOR ARQUITECTÓNICO, anotado a propósito: cada módulo nuevo obliga a
--   editar la lista de M2. Con tres módulos se aguanta; con diez habrá que
--   mover la lista a una tabla que cada migración alimente por su cuenta.
--   No se hace ahora porque leer una tabla dentro del censor le quitaría el
--   IMMUTABLE, y eso es un cambio que merece su propia decisión.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN — ejecutar DESPUÉS, bloque a bloque                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V0 · Comprobación previa OBLIGATORIA
--   user_login_devices.user_id apunta a auth.users por clave foránea. En un
--   proyecto de ensayo los perfiles pueden estar sembrados a mano con UUID
--   inventados que no existen como usuarios de autenticación; en ese caso V1
--   fallaría por clave foránea y el error no diría nada útil.
--
--   SELECT (SELECT count(*) FROM auth.users) AS usuarios_auth,
--          (SELECT count(*) FROM public.dj_profiles p
--             JOIN auth.users u ON u.id = p.user_id) AS perfiles_con_usuario_real;
--   -- Si perfiles_con_usuario_real = 0, las pruebas de abajo no pueden
--   -- ejecutarse tal cual: hace falta un usuario real con perfil asociado.
--
-- V1 · Registrar un dispositivo deja rastro
--   El JOIN con auth.users no es decorativo: garantiza que la fila elegida
--   tiene un usuario de autenticación real detrás.
--   INSERT INTO public.user_login_devices
--     (user_id, device_fingerprint, user_agent, platform_label, device_name)
--   SELECT p.user_id, 'huella-de-prueba-0123456789', 'Mozilla/5.0 (prueba)',
--          'macOS', 'Portátil de prueba'
--     FROM public.dj_profiles p
--     JOIN auth.users u ON u.id = p.user_id
--    ORDER BY p.profile_id LIMIT 1;
--
--   SELECT accion, recurso_profile_id,
--          despues->>'dispositivo_nombre'     AS nombre,
--          despues->>'dispositivo_plataforma' AS plataforma
--     FROM public.audit_log WHERE accion = 'dispositivo.registrado'
--    ORDER BY id DESC LIMIT 1;
--   -- ESPERADO: dispositivo.registrado · un FENIX-ID · 'Portátil de prueba' · 'macOS'
--   -- Si el FENIX-ID sale NULL, mdj_profile_de_usuario() no encontró el perfil.
--
-- V2 · LA HUELLA NO APARECE — la prueba que importa
--   SELECT despues::text LIKE '%huella-de-prueba%' AS se_filtro_la_huella
--     FROM public.audit_log WHERE accion = 'dispositivo.registrado'
--    ORDER BY id DESC LIMIT 1;
--   -- ESPERADO: false. Si sale true, el registro guarda un identificador de
--   -- máquina física y M4 NO puede aplicarse.
--
-- V3 · Renombrar deja rastro, y tocar last_seen_at NO
--   UPDATE public.user_login_devices SET device_name = 'Renombrado'
--    WHERE device_fingerprint = 'huella-de-prueba-0123456789';
--   UPDATE public.user_login_devices SET last_seen_at = now()
--    WHERE device_fingerprint = 'huella-de-prueba-0123456789';
--   SELECT count(*) FROM public.audit_log WHERE accion = 'dispositivo.renombrado';
--   -- ESPERADO: 1 — el segundo UPDATE no genera entrada. Es rutina, no suceso.
--
-- V4 · Eliminar el dispositivo NO borra la prueba
--   DELETE FROM public.user_login_devices
--    WHERE device_fingerprint = 'huella-de-prueba-0123456789';
--   SELECT count(*) AS filas_que_quedan FROM public.user_login_devices
--    WHERE device_fingerprint = 'huella-de-prueba-0123456789';
--   -- ESPERADO: 0 — la fila se fue, como debe.
--   SELECT accion, despues->>'dispositivo_nombre' AS nombre
--     FROM public.audit_log WHERE accion = 'dispositivo.eliminado'
--    ORDER BY id DESC LIMIT 1;
--   -- ESPERADO: dispositivo.eliminado · 'Renombrado'
--   -- La fila desapareció; la constancia de que existió y de que alguien la
--   -- quitó, no. Ese es todo el objetivo de M4.
--
-- V5 · Vaciar la tabla — DEBE FALLAR
--   TRUNCATE public.user_login_devices;
--   -- ESPERADO: ERROR 'user_login_devices no se vacía'


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  REVERSIÓN                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--   BEGIN;
--   DROP TRIGGER IF EXISTS trg_dispositivo_auditar_ins  ON public.user_login_devices;
--   DROP TRIGGER IF EXISTS trg_dispositivo_auditar_upd  ON public.user_login_devices;
--   DROP TRIGGER IF EXISTS trg_dispositivo_auditar_del  ON public.user_login_devices;
--   DROP TRIGGER IF EXISTS trg_dispositivos_no_truncate ON public.user_login_devices;
--   DROP FUNCTION IF EXISTS public.mdj_auditar_dispositivo();
--   DROP FUNCTION IF EXISTS public.mdj_dispositivos_no_truncate();
--   DROP FUNCTION IF EXISTS public.mdj_profile_de_usuario(uuid);
--   COMMIT;
--
--   Revertir M4 NO borra la tabla ni los dispositivos: M4 nunca creó datos,
--   solo rastro. Las entradas ya escritas en audit_log sobreviven, porque
--   audit_log es append-only también frente a esto.
