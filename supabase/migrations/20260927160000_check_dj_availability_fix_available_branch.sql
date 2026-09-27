-- 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- 2026-09-27: check_dj_availability() nunca devolvía 'AVAILABLE' -- el enum
-- dj_availability_status SÍ tiene ese valor, pero la función calculaba
-- v_ambiguous_count y nunca lo usaba en una rama: siempre caía en
-- REQUIRES_CONFIRMATION cuando no había conflicto de horario, incluso con
-- dj_events completamente vacía (0 filas, hoy). Corregido a pedido explícito
-- del PO: "si no hay datos agendados entonces es que hay disponibilidad" --
-- ausencia real de conflicto (sin eventos ambiguos sin horario) SÍ debe
-- devolver AVAILABLE, no quedarse siempre en modo "hay que confirmar".
--
-- Aditivo/idempotente: CREATE OR REPLACE, misma firma exacta, mismo
-- comportamiento en todas las ramas existentes (NOT_AVAILABLE por DJ
-- marcado no disponible, NOT_AVAILABLE por conflicto real de horario,
-- REQUIRES_CONFIRMATION por datos faltantes/ambiguos) -- solo se agrega la
-- rama final que faltaba.

CREATE OR REPLACE FUNCTION public.check_dj_availability(p_dj_slug text, p_event_date date, p_start_time time without time zone, p_end_time time without time zone)
 RETURNS dj_availability_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_dj_user_id uuid;
  v_available  boolean;
  v_conflict_count integer;
  v_ambiguous_count integer;
BEGIN
  IF p_dj_slug IS NULL OR btrim(p_dj_slug) = '' THEN
    RETURN 'REQUIRES_CONFIRMATION';
  END IF;

  SELECT dp.user_id, dp.available
    INTO v_dj_user_id, v_available
    FROM public.dj_profiles dp
   WHERE lower(regexp_replace(trim(COALESCE(
           NULLIF(dp.username, ''), NULLIF(dp.stage_name, ''), NULLIF(dp.dj_name, ''), ''
         )), '[^a-zA-Z0-9]+', '-', 'g')) = lower(btrim(p_dj_slug))
   LIMIT 1;

  IF v_dj_user_id IS NULL THEN
    RETURN 'REQUIRES_CONFIRMATION';
  END IF;

  IF v_available IS FALSE THEN
    RETURN 'NOT_AVAILABLE';
  END IF;

  IF p_event_date IS NULL OR p_start_time IS NULL OR p_end_time IS NULL OR p_start_time >= p_end_time THEN
    RETURN 'REQUIRES_CONFIRMATION';
  END IF;

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

  SELECT count(*)
    INTO v_ambiguous_count
    FROM public.dj_events de
   WHERE de.dj_user_id = v_dj_user_id
     AND de.event_date = p_event_date
     AND lower(coalesce(de.status, '')) NOT IN ('cancelled', 'canceled')
     AND (de.start_time IS NULL OR de.end_time IS NULL);

  -- FIX 2026-09-27: rama que faltaba. Sin conflicto de horario real y sin
  -- eventos ambiguos (agendados ese día pero sin hora completa) para este
  -- DJ en esta fecha -> disponible de verdad, no "hay que confirmar".
  IF v_ambiguous_count > 0 THEN
    RETURN 'REQUIRES_CONFIRMATION';
  END IF;

  RETURN 'AVAILABLE';
END;
$function$;
