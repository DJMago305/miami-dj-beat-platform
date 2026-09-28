-- 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- 2026-09-28: cierra las preguntas abiertas #2 y #3 del ticket de
-- experiencia por venue (docs/tickets/2026-09-27-experiencia-real-por-
-- venue-y-calificacion-publica.md), confirmadas por el PO:
--
-- #2 (vocabulario de insignias, 2 niveles, sin números crudos):
--   - "Con experiencia verificada en <categoría>" -- 1+ evento real
--     completado ahí.
--   - "Experiencia comprobada en <categoría>" -- score >= 3 (repetición
--     real o un evento de alto impacto marcado a mano).
--   - Sin ningún evento real -> ninguna insignia (nunca fabricar una vacía,
--     regla ya aplicada toda la sesión).
--
-- #3 (peso de un evento único de alto impacto, ej. Haunted House): el
-- staff lo marca a mano (leads.high_impact) -- NUNCA lo infiere el sistema
-- solo, mismo patrón HITL que ya usa ELIXIS (redacta/sugiere, humano
-- decide). Un evento de alto impacto cuenta como 3 eventos normales de esa
-- categoría para el score.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS high_impact boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.high_impact IS
  'Marcado a mano por staff cuando el evento es de alto impacto/escala real (ej. Haunted House vía Baila Con Micho) aunque sea único, no repetido -- cuenta como 3 eventos normales de su categoría para las insignias de experiencia. Nunca lo infiere el sistema solo. Ver docs/tickets/2026-09-27-experiencia-real-por-venue-y-calificacion-publica.md.';

-- Agrega, por categoría de venue, el score real de un DJ y el nivel de
-- insignia que le corresponde -- solo devuelve filas con score real > 0,
-- nunca una fila vacía/fabricada. SECURITY DEFINER porque cruza leads
-- (privado) para dar un resultado público sin exponer las filas crudas.
CREATE OR REPLACE FUNCTION public.get_dj_venue_category_badges(p_dj_user_id uuid)
 RETURNS TABLE(category text, score integer, badge_level text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    fv.category,
    (count(*) FILTER (WHERE NOT l.high_impact) + count(*) FILTER (WHERE l.high_impact) * 3)::int AS score,
    CASE
      WHEN (count(*) FILTER (WHERE NOT l.high_impact) + count(*) FILTER (WHERE l.high_impact) * 3) >= 3 THEN 'comprobada'
      ELSE 'verificada'
    END AS badge_level
  FROM public.leads l
  JOIN public.dj_profiles dp ON dp.id = l.assigned_dj_id
  JOIN public.financial_venues fv ON fv.id = l.venue_id
  WHERE dp.user_id = p_dj_user_id
    AND l.event_completed_at IS NOT NULL
    AND fv.category IS NOT NULL
  GROUP BY fv.category;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dj_venue_category_badges(uuid) TO anon, authenticated, service_role, postgres;
