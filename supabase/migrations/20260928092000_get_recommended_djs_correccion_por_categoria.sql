-- 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- 2026-09-28: cierra la pregunta abierta #4 del ticket de experiencia por
-- venue (docs/tickets/2026-09-27-experiencia-real-por-venue-y-calificacion-
-- publica.md). Umbral ya confirmado por el PO junto con las preguntas #1-3:
-- mismo umbral del ticket chico de recomendaciones, 1-2 estrellas.
--
-- Lo que faltaba no era el umbral -- era que la corrección fuera POR
-- CATEGORÍA, no global. Principio #5 del ticket ("si a un DJ se le asigna
-- una boda y el cliente da una calificación baja, eso baja su visibilidad
-- específicamente en búsquedas de bodas -- no en general") y el balance
-- "10 contra 1" (una mala experiencia en una categoría no debe hundir las
-- demás). get_recommended_djs() (PR #519) ya excluía globalmente -- se
-- extiende con un 4º parámetro OPCIONAL p_category: NULL mantiene el
-- comportamiento global exacto de siempre (el único llamador real hoy,
-- web/calendario-operacional-inteligente.html, no pasa categoría, así que
-- no cambia nada para él); con categoría, la exclusión solo aplica si la
-- reseña de 1-2 estrellas está ligada (source_lead_id, la señal de origen
-- construida en el PR #545) a un evento real de ESA categoría.
--
-- Aditivo: DROP + CREATE explícito (mismo patrón ya usado en esta sesión
-- para evitar overloads ambiguos con firma distinta), GRANT re-otorgado.

DROP FUNCTION IF EXISTS public.get_recommended_djs(uuid, date);

CREATE FUNCTION public.get_recommended_djs(p_master_client_id uuid, p_event_date date, p_category text DEFAULT NULL::text)
 RETURNS TABLE(dj_id uuid, dj_name text, is_affiliated boolean, is_pro boolean, rating numeric, is_available boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    dp.id as dj_id,
    coalesce(dp.dj_name, dp.stage_name, dp.full_name) as dj_name,
    (dca.dj_id is not null) as is_affiliated,
    (
      (
        upper(coalesce(dp.plan, '')) in ('PRO', 'PRO_MONTHLY', 'FOUNDER')
        or upper(coalesce(dp.plan_type, '')) like 'PRO%'
      )
      and lower(coalesce(dp.plan_status, '')) = 'active'
    ) as is_pro,
    dp.rating,
    (
      coalesce(dp.available, false)
      and not exists (
        select 1 from public.dj_events de
        where de.dj_user_id = dp.user_id
          and de.event_date = p_event_date
          and lower(coalesce(de.status, '')) not in ('cancelled', 'canceled')
      )
    ) as is_available
  from public.dj_profiles dp
  left join public.dj_client_affiliations dca
    on dca.dj_id = dp.id and dca.master_client_id = p_master_client_id
  where dp.role = 'dj'
    and not exists (
      select 1 from public.dj_public_reviews dpr
      where dpr.dj_user_id = dp.user_id
        and dpr.reviewer_user_id = p_master_client_id
        and dpr.rating <= 2
        and dpr.status = 'published'
        and (
          p_category is null
          or exists (
            select 1 from public.leads l
            join public.financial_venues fv on fv.id = l.venue_id
            where l.id = dpr.source_lead_id
              and fv.category = p_category
          )
        )
    )
  order by
    is_affiliated desc,
    is_pro desc,
    is_available desc,
    dp.rating desc nulls last
  limit 20;
$function$;

GRANT EXECUTE ON FUNCTION public.get_recommended_djs(uuid, date, text) TO anon, authenticated, service_role, postgres;
