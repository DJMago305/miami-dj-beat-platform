-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENTORNO: PRUEBA  (mdjb-ensayo / Supabase local)                          ║
-- ║  NO APLICAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- M1 · profile_id inmutable — Constitución Maestra de Identidad, Fase 2
--
-- QUÉ HACE
--   Añade a las tablas de identidad un identificador público, único, permanente
--   y no editable, con formato FENIX-XXXXXXXX. Es el ancla a la que se atarán
--   después los permisos (M3), la auditoría (M2) y el acceso delegado (M6): sin
--   un identificador estable no hay a qué referirse cuando el correo cambia, el
--   nombre artístico cambia o el usuario se reasigna.
--
-- QUÉ NO HACE — límites que impone el PO y que esta migración respeta
--   · No toca las claves primarias existentes (id, user_id). Son UUID y siguen
--     siendo la clave real; profile_id es una columna ADITIVA con UNIQUE.
--   · No elimina ni renombra ninguna columna.
--   · No deja NULOS: rellena todos los perfiles existentes antes de exigir la
--     restricción.
--   · Es reversible por completo — el bloque de reversión está al final.
--
-- POR QUÉ EL FORMATO NO ES UN UUID
--   El UUID ya existe en `id`. Este identificador es el que una persona lee, dicta
--   por teléfono y escribe en un contrato. Por eso: prefijo legible, 8 caracteres,
--   y un alfabeto sin 0/O ni 1/I/L, que son los que se confunden al copiarlos a
--   mano. 32^8 ≈ 1.1 billones de combinaciones: con colisión comprobada en bucle,
--   el riesgo práctico es nulo.
--
-- NOTA DE HONESTIDAD TÉCNICA
--   `dj_profiles` no tiene CREATE TABLE en el historial de migraciones: se creó
--   fuera del versionado. Por eso esta migración NO asume su estructura: comprueba
--   la existencia de cada tabla antes de tocarla y usa ADD COLUMN IF NOT EXISTS.
--   Si aparece una tercera tabla de perfiles, basta añadirla al array `tablas`.

BEGIN;

-- ── 1 · Generador del identificador ────────────────────────────────────────
--   Alfabeto de 32 símbolos sin caracteres ambiguos. IMMUTABLE porque para la
--   misma entrada devuelve siempre lo mismo dentro de una llamada.
CREATE OR REPLACE FUNCTION public.mdj_generar_profile_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alfabeto CONSTANT text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- sin O,I,L,0,1
  n        CONSTANT int  := length(alfabeto);
  salida   text := '';
  i        int;
BEGIN
  FOR i IN 1..8 LOOP
    salida := salida || substr(alfabeto, 1 + floor(random() * n)::int, 1);
  END LOOP;
  RETURN 'FENIX-' || salida;
END;
$$;

COMMENT ON FUNCTION public.mdj_generar_profile_id() IS
  'M1 · Genera un identificador público FENIX-XXXXXXXX. Alfabeto sin caracteres ambiguos para que pueda dictarse y copiarse a mano sin error.';

-- ── 2 · Asignación con comprobación de colisión ─────────────────────────────
--   No basta con generar: hay que confirmar que nadie lo tiene ya. El bucle
--   reintenta y se rinde a las 50 vueltas antes que entregar un duplicado en
--   silencio. Consulta las DOS tablas porque el identificador es único en todo
--   el ecosistema, no por tabla: un contrato debe poder apuntar a un FENIX-ID
--   sin preguntar antes de qué tipo de perfil es.
CREATE OR REPLACE FUNCTION public.mdj_asignar_profile_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  candidato text;
  intentos  int := 0;
  ocupado   boolean;
BEGIN
  LOOP
    candidato := public.mdj_generar_profile_id();
    intentos  := intentos + 1;

    SELECT EXISTS (
      SELECT 1 FROM public.dj_profiles      WHERE profile_id = candidato
      UNION ALL
      SELECT 1 FROM public.client_profiles  WHERE profile_id = candidato
    ) INTO ocupado;

    EXIT WHEN NOT ocupado;

    IF intentos >= 50 THEN
      RAISE EXCEPTION
        'M1: no se pudo asignar un profile_id libre tras % intentos', intentos
        USING HINT = 'Espacio de identificadores agotándose: revisar el alfabeto o la longitud.';
    END IF;
  END LOOP;

  RETURN candidato;
END;
$$;

-- ── 3 · Guardia de inmutabilidad ────────────────────────────────────────────
--   El §28 del PO exige campos sellados. Ocultar el botón en la interfaz no es
--   protección: la prohibición vive aquí, en la base, donde ningún cliente ni
--   Edge Function puede saltársela. Se permite pasar de NULL a valor (el backfill)
--   pero jamás cambiar un valor ya asignado ni volverlo a NULL.
CREATE OR REPLACE FUNCTION public.mdj_profile_id_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.profile_id IS NOT NULL AND NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION
      'profile_id es inmutable: % no puede cambiarse a %', OLD.profile_id, NEW.profile_id
      USING ERRCODE = 'restrict_violation',
            HINT    = 'El identificador de perfil es permanente por diseño (Constitución §3 y §28).';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4 · Aplicación tabla por tabla ──────────────────────────────────────────
--   Todo condicionado a que la tabla exista: dj_profiles no está en el historial
--   de migraciones y no se puede dar por supuesta.
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY['dj_profiles', 'client_profiles'];
  pendientes bigint;
BEGIN
  FOREACH t IN ARRAY tablas LOOP

    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'M1: la tabla public.% no existe — se omite', t;
      CONTINUE;
    END IF;

    -- 4a · columna aditiva, sin DEFAULT todavía (el backfill va controlado)
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS profile_id text', t);

    -- 4b · backfill: solo filas sin identificador. Repetible sin efectos.
    EXECUTE format(
      'UPDATE public.%I SET profile_id = public.mdj_asignar_profile_id()
        WHERE profile_id IS NULL', t);

    -- 4c · verificación DENTRO de la transacción: si algo quedó nulo, aborta
    --      y revierte. Prefiero fallar aquí que dejar identidades a medias.
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE profile_id IS NULL', t) INTO pendientes;
    IF pendientes > 0 THEN
      RAISE EXCEPTION 'M1: quedaron % filas sin profile_id en public.%', pendientes, t;
    END IF;

    -- 4d · restricciones, ya con todo relleno
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN profile_id SET NOT NULL', t);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN profile_id SET DEFAULT public.mdj_asignar_profile_id()', t);

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_%s_profile_id ON public.%I (profile_id)', t, t);

    -- 4e · formato garantizado también desde la base
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'ck_' || t || '_profile_id_formato'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT ck_%s_profile_id_formato
           CHECK (profile_id ~ ''^FENIX-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'')', t, t);
    END IF;

    -- 4f · sello de inmutabilidad
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_profile_id_inmutable ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_profile_id_inmutable
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.mdj_profile_id_inmutable()', t, t);

    EXECUTE format(
      'COMMENT ON COLUMN public.%I.profile_id IS
         ''FENIX-ID · identificador público permanente. Solo lectura: sellado por trigger. No sustituye a id ni a user_id.''', t);

    RAISE NOTICE 'M1: public.% preparada', t;
  END LOOP;
END $$;

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN — ejecutar DESPUÉS, como consultas independientes          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · Cobertura: ninguna fila sin identificador
--
--   SELECT 'dj_profiles' AS tabla, count(*) AS total,
--          count(profile_id) AS con_id,
--          count(*) - count(profile_id) AS sin_id
--     FROM public.dj_profiles
--   UNION ALL
--   SELECT 'client_profiles', count(*), count(profile_id), count(*) - count(profile_id)
--     FROM public.client_profiles;
--   -- ESPERADO: sin_id = 0 en ambas filas.
--
-- V2 · Unicidad absoluta, cruzando las dos tablas
--
--   SELECT profile_id, count(*) AS repeticiones
--     FROM (SELECT profile_id FROM public.dj_profiles
--           UNION ALL
--           SELECT profile_id FROM public.client_profiles) AS todos
--    GROUP BY profile_id HAVING count(*) > 1;
--   -- ESPERADO: cero filas.
--
-- V3 · Formato canónico
--
--   SELECT count(*) AS fuera_de_formato
--     FROM (SELECT profile_id FROM public.dj_profiles
--           UNION ALL
--           SELECT profile_id FROM public.client_profiles) AS todos
--    WHERE profile_id !~ '^FENIX-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$';
--   -- ESPERADO: 0.
--
-- V4 · Cero impacto en las columnas existentes
--
--   No se nombra ninguna columna a mano: `dj_profiles` se creó fuera del
--   historial de migraciones (ver nota de cabecera) y su clave primaria no es
--   la misma en todos los proyectos — verificado 2026-08-17: en mdjb-ensayo NO
--   existe una columna `id`. Se pregunta al catálogo en vez de suponer.
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'dj_profiles'
--    ORDER BY ordinal_position;
--   -- ESPERADO: aparece profile_id (text) y TODAS las columnas previas siguen
--   -- ahí. Esta migración solo añade; no lee ni escribe ninguna otra columna.
--
-- V5 · El sello funciona (debe FALLAR — esa es la prueba)
--
--   UPDATE public.dj_profiles
--      SET profile_id = 'FENIX-AAAAAAAA'
--    WHERE profile_id IS NOT NULL
--    LIMIT 1;
--   -- ESPERADO: ERROR "profile_id es inmutable". Si esto tiene éxito, el sello
--   -- no está puesto y la migración NO puede darse por válida.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  REVERSIÓN COMPLETA — deja la base exactamente como estaba               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
--   BEGIN;
--   DO $$
--   DECLARE t text; tablas text[] := ARRAY['dj_profiles','client_profiles'];
--   BEGIN
--     FOREACH t IN ARRAY tablas LOOP
--       IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
--       EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_profile_id_inmutable ON public.%I', t, t);
--       EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS ck_%s_profile_id_formato', t, t);
--       EXECUTE format('DROP INDEX IF EXISTS public.ux_%s_profile_id', t);
--       EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS profile_id', t);
--     END LOOP;
--   END $$;
--   DROP FUNCTION IF EXISTS public.mdj_profile_id_inmutable();
--   DROP FUNCTION IF EXISTS public.mdj_asignar_profile_id();
--   DROP FUNCTION IF EXISTS public.mdj_generar_profile_id();
--   COMMIT;
--
--   La reversión elimina únicamente lo que M1 creó. Ninguna columna preexistente
--   se toca en ningún momento, así que revertir no puede perder datos.
