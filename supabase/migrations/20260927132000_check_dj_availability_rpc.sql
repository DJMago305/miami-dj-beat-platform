-- ═══════════════════════════════════════════════════════════════════════════
-- RESCATADA 2026-09-27 (orden del PO: "rescata check_dj_availability") del worktree abandonado
-- `dj-profile-engine-hardening` (rama fix/dj-profile-engine-hardening, sin comitear desde el 13 de
-- septiembre) — a diferencia de las otras dos migraciones de ese worktree, esta es trabajo real y
-- SIN aplicar: verificado en producción el 2026-09-27, ni el tipo `dj_availability_status` ni la
-- función `check_dj_availability` existían.
--
-- ⚠️ CORRECCIÓN AL RESCATARLA (2026-09-27): la versión original del 13 de septiembre asumía
-- `dj_profiles.dj_slug` como columna física ("WHERE dp.dj_slug = ..."). Verificado en producción:
-- esa columna NO existe en `dj_profiles` — `dj_slug` siempre fue un valor CALCULADO, solo presente en
-- vistas (`public_dj_profiles`, `public_dj_talent`), nunca en la tabla base. Con la versión original,
-- esta función habría fallado en cada llamada. Se corrige resolviendo el slug con la MISMA fórmula que
-- ya usan esas vistas y `tools/dj-profiles/build.mjs` (COALESCE username → stage_name → dj_name,
-- sanitizado a minúsculas/guiones) — no se inventa una fórmula nueva. El resto de la lógica (tri-state
-- a prueba de falsos positivos, SECURITY DEFINER, GRANT/REVOKE) es del worktree, sin cambios de fondo.
--
-- Entorno: FUENTE ÚNICA — se aplica PRIMERO a PRUEBA (rtbsovavmtnjpbbpwsin) y DESPUÉS a PRODUCCIÓN
-- (hkuvuqupbxwkiykxvqdr). Depende de public.dj_profiles (user_id, available — ya existen) y de
-- public.dj_events (dj_user_id, event_date, start_time, end_time, status — ya existe en PROD, RLS
-- habilitada, 0 filas confirmadas el 2026-09-27). NO existe versión para PRUEBA: ese proyecto no tiene
-- una tabla dj_profiles equivalente (ver docs/tickets — esquema de PRUEBA atrasado).
--
-- ═══ LA REGLA CENTRAL — por qué la tercera rama NUNCA es 'AVAILABLE' ═══
-- dj_events tiene 0 filas hoy y ningún camino de código conocido escribe en ella todavía. Eso significa
-- que "no encontramos ningún dj_events que choque" es indistinguible de "de verdad no hay conflicto":
-- la tabla no tiene aún cobertura para demostrar lo segundo. Devolver 'AVAILABLE' en esa rama sería
-- fabricar una confianza que los datos no sostienen. Por eso la lógica es tri-state y la tercera rama es
-- 'REQUIRES_CONFIRMATION', no 'AVAILABLE'. El día en que exista un escritor real y dj_events tenga
-- cobertura genuina, esta MISMA rama podría honestamente convertirse en 'AVAILABLE' — ese día no es hoy.
--
-- ═══ ZONA HORARIA ═══
-- dj_events.event_date es `date` y start_time/end_time son `time without time zone` (confirmado): no
-- hay ambigüedad de huso que resolver porque ambos lados se comparan dentro del MISMO event_date; la
-- interpretación operativa declarada es America/New_York — responsabilidad del LLAMADOR enviar los
-- valores ya en hora de Florida, como ya hace el resto del sitio.
--
-- ═══ STATUS EXCLUIDOS ═══
-- Solo 'cancelled'/'canceled' (case-insensitive) — mismas dos grafías que ya excluye
-- public.get_recommended_djs() (referencia de patrón, nunca se llama directo).
--
-- ═══ SEGURIDAD ═══
-- SECURITY DEFINER con `SET search_path = public, pg_catalog` explícito. Toda relación calificada con
-- `public.`. Se revoca EXECUTE de public/anon/authenticated por defecto y se otorga explícitamente solo
-- a anon (flujo público sin login) y authenticated. GRANT EXECUTE en una función SECURITY DEFINER NO
-- otorga acceso de tabla a quien la llama — la tabla mantiene su RLS existente sin cambios (esta
-- migración no toca GRANT/REVOKE de dj_events ni de dj_profiles). El tipo de retorno es un enum de 3
-- valores — estructuralmente imposible que devuelva una fila real. Un slug inexistente o malformado
-- resuelve a 'REQUIRES_CONFIRMATION' sin lanzar un error SQL crudo (evita filtrar detalle de esquema).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tipo de retorno — tri-state, nada más. ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dj_availability_status') THEN
    CREATE TYPE public.dj_availability_status AS ENUM ('AVAILABLE', 'NOT_AVAILABLE', 'REQUIRES_CONFIRMATION');
  END IF;
END $$;

-- ── La función ───────────────────────────────────────────────────────────
-- Parámetro público: p_dj_slug — "identificador público de DJ" (mismo formato que
-- public_dj_profiles.dj_slug / public_dj_talent.dj_slug), nunca dj_profiles.id/user_id en la
-- superficie pública. Se resuelve a dj_profiles.user_id INTERNAMENTE antes de tocar dj_events, que es
-- la columna con la que dj_events.dj_user_id de verdad tiene FK.
CREATE OR REPLACE FUNCTION public.check_dj_availability(
  p_dj_slug   text,
  p_event_date date,
  p_start_time time,
  p_end_time   time
)
RETURNS public.dj_availability_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_dj_user_id uuid;
  v_available  boolean;
  v_conflict_count integer;
  v_ambiguous_count integer;
BEGIN
  -- Entrada inválida/ausente → falla segura, sin distinguir "no existe" de
  -- "existe pero mal formado" en el mensaje (no se lanza excepción cruda).
  IF p_dj_slug IS NULL OR btrim(p_dj_slug) = '' THEN
    RETURN 'REQUIRES_CONFIRMATION';
  END IF;

  -- Resolución slug → user_id. dj_slug NO es columna física de dj_profiles (corrección al rescatar
  -- esta migración) — se calcula aquí con la MISMA fórmula que public_dj_profiles/public_dj_talent y
  -- tools/dj-profiles/build.mjs: COALESCE(username, stage_name, dj_name), sanitizado. dj_profiles
  -- conserva su propia RLS; esta función corre SECURITY DEFINER así que la lectura interna funciona
  -- igual sin importar el rol del llamador, pero NUNCA se expone ninguna columna de dj_profiles en el
  -- resultado — solo se usa para el WHERE de abajo.
  SELECT dp.user_id, dp.available
    INTO v_dj_user_id, v_available
    FROM public.dj_profiles dp
   WHERE lower(regexp_replace(trim(COALESCE(
           NULLIF(dp.username, ''), NULLIF(dp.stage_name, ''), NULLIF(dp.dj_name, ''), ''
         )), '[^a-zA-Z0-9]+', '-', 'g')) = lower(btrim(p_dj_slug))
   LIMIT 1;

  -- Slug inexistente → mismo resultado neutro que "sin cobertura", nunca un
  -- error distinguible (evita que un caller pueda usar el mensaje de error
  -- para enumerar qué slugs existen).
  IF v_dj_user_id IS NULL THEN
    RETURN 'REQUIRES_CONFIRMATION';
  END IF;

  -- El flag global es definitivo y corta corto, sin tocar dj_events.
  IF v_available IS FALSE THEN
    RETURN 'NOT_AVAILABLE';
  END IF;

  -- Sin fecha/hora completa y válida no hay base para calcular overlap.
  -- Nunca se trata "falta la hora" como "entonces no hay conflicto, entonces disponible".
  IF p_event_date IS NULL OR p_start_time IS NULL OR p_end_time IS NULL OR p_start_time >= p_end_time THEN
    RETURN 'REQUIRES_CONFIRMATION';
  END IF;

  -- Conflicto DEFINITIVO: misma fecha, status no cancelado, horario
  -- completo en la fila candidata, y overlap real de intervalos
  -- [start,end). Esto es lo único que puede producir NOT_AVAILABLE aparte
  -- del flag global.
  SELECT count(*)
    INTO v_conflict_count
    FROM public.dj_events de
   WHERE de.dj_user_id = v_dj_user_id
     AND de.event_date = p_event_date
     AND lower(coalesce(de.status, '')) NOT IN ('cancelled', 'canceled')
     AND de.start_time IS NOT NULL
     AND de.end_time IS NOT NULL
     AND p_start_time < de.end_time
     AND p_end_time > de.start_time;

  IF v_conflict_count > 0 THEN
    RETURN 'NOT_AVAILABLE';
  END IF;

  -- Cobertura ambigua: misma fecha, no cancelado, pero sin horario
  -- utilizable — no se puede ni probar ni descartar el conflicto. Se deja
  -- como señal documentada (v_ambiguous_count) aunque hoy no cambie el
  -- resultado final — cualquier rama que no sea un conflicto definitivo cae
  -- a REQUIRES_CONFIRMATION de todas formas.
  SELECT count(*)
    INTO v_ambiguous_count
    FROM public.dj_events de
   WHERE de.dj_user_id = v_dj_user_id
     AND de.event_date = p_event_date
     AND lower(coalesce(de.status, '')) NOT IN ('cancelled', 'canceled')
     AND (de.start_time IS NULL OR de.end_time IS NULL);

  -- ═══ La rama central del ticket ═══
  -- Ni v_conflict_count>0 (ya habría retornado NOT_AVAILABLE arriba) ni ninguna otra señal en
  -- dj_events (0 filas hoy, sin escritor real) puede honestamente demostrar que el DJ está libre en
  -- esta fecha/hora — solo que no se encontró un conflicto REGISTRADO. Esta rama es intencionalmente
  -- REQUIRES_CONFIRMATION, no AVAILABLE, hasta que exista un escritor real de dj_events con cobertura
  -- genuina que documente por qué el caso "0 conflictos encontrados" pasó a ser confiable.
  RETURN 'REQUIRES_CONFIRMATION';
END;
$$;

COMMENT ON FUNCTION public.check_dj_availability(text, date, time, time) IS
  'Disponibilidad pública tri-state (AVAILABLE/NOT_AVAILABLE/REQUIRES_CONFIRMATION) para un DJ por slug público. '
  'FALLA SEGURA por diseño: con dj_events en 0 filas y sin escritor confirmado hoy, "sin conflicto registrado" '
  'nunca se traduce a AVAILABLE.';

-- ── Privilegios — solo EXECUTE del RPC, nunca acceso de tabla ─────────────
REVOKE ALL ON FUNCTION public.check_dj_availability(text, date, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_dj_availability(text, date, time, time) TO anon;
GRANT EXECUTE ON FUNCTION public.check_dj_availability(text, date, time, time) TO authenticated;

-- ═══ Nota de dependencia para el PO ═══════════════════════════════════════
-- Depende de: public.dj_profiles (user_id, username/stage_name/dj_name, available — existen ya en
-- PROD) y public.dj_events (dj_user_id, event_date, start_time, end_time, status — existe ya en PROD).
-- No depende de bookings/booked_events, leads, signed_contracts, contract_sends ni
-- event_builder_orders. Esta migración crea el RPC; ningún frontend lo llama todavía — cablearlo a una
-- pantalla real (p. ej. el buscador o la ficha pública del DJ) es un trabajo aparte, sin orden de
-- construirse hoy.
