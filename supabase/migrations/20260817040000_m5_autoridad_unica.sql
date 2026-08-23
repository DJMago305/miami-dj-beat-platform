-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo                                          ║
-- ║  NO EJECUTAR EN PRODUCCIÓN                                               ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  M5 · AUTORIDAD ÚNICA — fenix_puede()                                    ║
-- ║  Requisitos: M1, M2, M3 aplicadas + cimentación 2A (fenix_can).          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- QUÉ RESUELVE
--   Hasta hoy la plataforma tenía DOS respuestas a «¿puede esta persona hacer
--   esto?», y cuál contestaba dependía de qué trozo de código preguntara:
--
--     fenix_can()            · rol + plan. Vive en PRUEBA y PRODUCCIÓN.
--                              No sabe qué es una delegación.
--     mdj_permiso_vigente()  · concesiones revocables y auditadas. Solo PRUEBA.
--                              No sabe qué es un plan.
--
--   No sobra ninguna: responden a preguntas distintas —capacidad propia frente
--   a autoridad prestada— y las dos hacen falta. Lo que faltaba era una tercera
--   que las compusiera con una regla de precedencia explícita.
--
--   fenix_puede() pasa a ser el ÚNICO punto de entrada. Las otras dos quedan
--   como piezas internas. Eso es lo que la cimentación 2A prometía al llamarse
--   «Autoridad Única» y hasta ahora no era única.
--
-- DECISIÓN DE VOCABULARIO — Opción A, aprobada por el PO el 2026-08-17
--   El `alcance` de las concesiones usa los MISMOS nombres de acción que
--   fenix_can. Sin tabla nueva y sin tocar producción. A cambio, la delegación
--   queda limitada al catálogo actual. La opción B —catálogo en tabla— se deja
--   preparada: basta sustituir el cuerpo de fenix_acciones_canonicas() por una
--   consulta, y nada más cambia.

BEGIN;

-- ── 0 · Guardias ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.fenix_can(uuid,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION
      'M5 requiere public.fenix_can(). Aplica la cimentación 2A (supabase/scripts/fenix_authority_2A.sql) primero';
  END IF;
  IF to_regprocedure('public.mdj_permiso_vigente(text,text,text,text,public.mdj_nivel_autoridad)') IS NULL THEN
    RAISE EXCEPTION
      'M5 requiere public.mdj_permiso_vigente(). Aplica 20260817020000_m3_permission_grants.sql primero';
  END IF;
  IF to_regprocedure('public.mdj_profile_de_usuario(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'M5 requiere public.mdj_profile_de_usuario(). Aplica 20260817010000_m2_audit_log.sql primero';
  END IF;
END $$;


-- ── 1 · El catálogo canónico de acciones ───────────────────────────────────
--   Las diez acciones que fenix_can() sabe evaluar hoy. Es la ÚNICA lista: el
--   `alcance` de una concesión tiene que ser una de estas, o la delegación
--   apuntaría a algo que fenix_can no puede acotar y el techo del punto 3b no
--   se podría comprobar.
--
--   IMMUTABLE para poder usarse en un CHECK. Cuando llegue la opción B, esto
--   se convierte en `SELECT array_agg(nombre) FROM public.acciones` y ni la
--   restricción ni fenix_puede() se enteran.
CREATE OR REPLACE FUNCTION public.fenix_acciones_canonicas()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'gmail.read', 'gmail.compose', 'gmail.send',
    'calendar.read', 'calendar.write',
    'campaign.prepare',
    'staff.read_all',
    'financial.read', 'financial.execute',
    'profile.bio.update'
  ];
$$;

COMMENT ON FUNCTION public.fenix_acciones_canonicas() IS
  'M5 · Vocabulario único de acciones. Lo comparten fenix_can() y el alcance de permission_grants (Opción A, 2026-08-17).';


-- ── 2 · El alcance de una concesión debe ser una acción canónica ───────────
--   NOT VALID a propósito: las filas de prueba de M3 usan alcances antiguos
--   ('calendario.disponibilidad', 'agenda.confirmar', 'contactos.analizar') y
--   están revocadas o son de ensayo. Reescribir historial para que encaje en
--   una regla nueva es falsear el historial. La restricción rige de aquí en
--   adelante; lo ya escrito se queda como está y se ve que es anterior.
ALTER TABLE public.permission_grants
  DROP CONSTRAINT IF EXISTS ck_alcance_canonico;

ALTER TABLE public.permission_grants
  ADD CONSTRAINT ck_alcance_canonico
  CHECK (alcance = ANY (public.fenix_acciones_canonicas()))
  NOT VALID;

COMMENT ON CONSTRAINT ck_alcance_canonico ON public.permission_grants IS
  'M5 · El alcance debe existir en el catálogo canónico. NOT VALID: no se reescriben las concesiones anteriores al 2026-08-17.';


-- ── 3 · La función compuesta ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fenix_puede(
  p_user          uuid,
  p_accion        text,
  p_en_nombre_de  text    DEFAULT NULL,   -- FENIX-ID del dueño, o NULL
  p_nivel         public.mdj_nivel_autoridad DEFAULT 'ejecutar',
  p_context       jsonb   DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mi_perfil  text;
  v_dueno_user uuid;

  -- Poderes que fenix_can otorga por ROL y no por plan. Son cargos, no tareas.
  -- El owner no puede conceder «ser el owner»: delegar un cargo no es delegar
  -- trabajo, es sustituir a la persona, y eso ningún registro puede auditarlo
  -- de forma útil. Lista explícita, nunca heurística.
  NO_DELEGABLES CONSTANT text[] := ARRAY[
    'financial.execute',
    'staff.read_all'
  ];
BEGIN
  -- ── Regla 1 · denegar por defecto ──
  IF p_user IS NULL OR p_accion IS NULL THEN
    RETURN false;
  END IF;

  -- Acción fuera del catálogo: no se puede acotar, luego no se concede.
  IF NOT (p_accion = ANY (public.fenix_acciones_canonicas())) THEN
    RETURN false;
  END IF;

  -- ── Regla 2 · en nombre propio ──
  --   Manda la capacidad propia y la delegación no entra en juego.
  IF p_en_nombre_de IS NULL THEN
    RETURN public.fenix_can(p_user, p_accion, NULL, p_context);
  END IF;

  -- ── Regla 4 · hay poderes que no se delegan jamás ──
  IF p_accion = ANY (NO_DELEGABLES) THEN
    RETURN false;
  END IF;

  -- ── Regla 3a · ¿me lo concedieron a MÍ, vigente, a este nivel o superior? ──
  v_mi_perfil := public.mdj_profile_de_usuario(p_user);
  IF v_mi_perfil IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.mdj_permiso_vigente(
           p_en_nombre_de, 'perfil', v_mi_perfil, p_accion, p_nivel) THEN
    RETURN false;
  END IF;

  -- ── Regla 3b · EL TECHO: nadie delega más de lo que tiene ──
  --   Sin esto, permission_grants sería una puerta trasera para saltarse el
  --   plan: bastaría con concederse a uno mismo lo que no ha pagado.
  SELECT user_id INTO v_dueno_user FROM (
    SELECT user_id FROM public.dj_profiles     WHERE profile_id = p_en_nombre_de
    UNION ALL
    SELECT user_id FROM public.client_profiles WHERE profile_id = p_en_nombre_de
  ) t LIMIT 1;

  IF v_dueno_user IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.fenix_can(v_dueno_user, p_accion, NULL, p_context);
END;
$$;

COMMENT ON FUNCTION public.fenix_puede(uuid,text,text,public.mdj_nivel_autoridad,jsonb) IS
  'M5 · Autoridad Única. Punto de entrada único: compone capacidad propia (fenix_can) con autoridad delegada (mdj_permiso_vigente). Nadie delega más de lo que tiene.';

REVOKE ALL ON FUNCTION public.fenix_puede(uuid,text,text,public.mdj_nivel_autoridad,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fenix_puede(uuid,text,text,public.mdj_nivel_autoridad,jsonb)
  TO authenticated, service_role;

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN — bloque a bloque, después                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · El catálogo responde
--   SELECT public.fenix_acciones_canonicas();
--   -- ESPERADO: array de 10 acciones.
--
-- V2 · Acción fuera del catálogo → deniega
--   SELECT public.fenix_puede(
--            (SELECT user_id FROM public.dj_profiles ORDER BY profile_id LIMIT 1),
--            'inventada.total') AS deberia_ser_false;
--   -- ESPERADO: false
--
-- V3 · EL TECHO — la prueba que define M5
--   Un artista concede al mánager una acción que su propio plan no le da.
--
--   INSERT INTO public.permission_grants
--     (otorgante_profile_id, beneficiario_tipo, beneficiario_ref,
--      alcance, nivel, concedido_metodo)
--   SELECT (SELECT profile_id FROM public.dj_profiles ORDER BY profile_id LIMIT 1),
--          'perfil',
--          (SELECT profile_id FROM public.dj_profiles ORDER BY profile_id OFFSET 1 LIMIT 1),
--          'campaign.prepare', 'preparar', 'ui';
--
--   SELECT public.fenix_puede(
--            (SELECT user_id FROM public.dj_profiles ORDER BY profile_id OFFSET 1 LIMIT 1),
--            'campaign.prepare',
--            (SELECT profile_id FROM public.dj_profiles ORDER BY profile_id LIMIT 1),
--            'preparar') AS el_manager_puede;
--
--   -- ESPERADO: false, SI el plan del artista no incluye campaign.prepare.
--   -- Comprobar el plan antes para saber qué se está midiendo:
--   --   SELECT profile_id, plan FROM public.dj_profiles ORDER BY profile_id LIMIT 2;
--   -- Si el artista es `free` y sale TRUE, la tabla de concesiones se ha
--   -- convertido en una forma de saltarse el plan y M5 NO vale.
--
-- V4 · CARGOS QUE NO SE PRESTAN
--   INSERT INTO public.permission_grants
--     (otorgante_profile_id, beneficiario_tipo, beneficiario_ref,
--      alcance, nivel, concedido_metodo)
--   SELECT (SELECT profile_id FROM public.dj_profiles ORDER BY profile_id OFFSET 1 LIMIT 1),
--          'perfil',
--          (SELECT profile_id FROM public.dj_profiles ORDER BY profile_id LIMIT 1),
--          'financial.execute', 'ejecutar', 'ui';
--
--   SELECT public.fenix_puede(
--            (SELECT user_id FROM public.dj_profiles ORDER BY profile_id LIMIT 1),
--            'financial.execute',
--            (SELECT profile_id FROM public.dj_profiles ORDER BY profile_id OFFSET 1 LIMIT 1),
--            'ejecutar') AS puede_ejecutar_finanzas;
--
--   -- ESPERADO: false SIEMPRE, aunque la concesión exista y esté vigente y el
--   -- otorgante sea owner. B es `owner` en ensayo, así que este bloque prueba
--   -- el caso real: ni el owner puede prestar su cargo.
--
-- V5 · En nombre propio sigue mandando el plan
--   SELECT public.fenix_puede(
--            (SELECT user_id FROM public.dj_profiles WHERE role='owner' LIMIT 1),
--            'financial.execute') AS owner_en_persona;
--   -- ESPERADO: true — el owner sí puede, actuando él.
--   -- Contrasta con V4: el mismo poder, delegado, es false.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  REVERSIÓN                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--   BEGIN;
--   ALTER TABLE public.permission_grants DROP CONSTRAINT IF EXISTS ck_alcance_canonico;
--   DROP FUNCTION IF EXISTS public.fenix_puede(uuid,text,text,public.mdj_nivel_autoridad,jsonb);
--   DROP FUNCTION IF EXISTS public.fenix_acciones_canonicas();
--   COMMIT;
--
--   Revertir M5 NO toca fenix_can() ni mdj_permiso_vigente(): vuelven a quedar
--   como estaban, cada una respondiendo por su lado. Que es el problema que M5
--   existe para resolver.
