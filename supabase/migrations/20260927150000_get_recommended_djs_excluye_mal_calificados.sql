-- ═══════════════════════════════════════════════════════════════════════════
-- 2026-09-27 (orden del PO): "el registro nunca más le dará ese DJ a ese
-- cliente... nunca a un cliente que da bajas calificaciones de un DJ se le
-- recomendará el mismo DJ". El PO asumía que esto ya funcionaba -- verificado
-- que NO: get_recommended_djs() existía (solo se llama desde
-- web/calendario-operacional-inteligente.html, herramienta interna de staff)
-- pero nunca consultaba dj_public_reviews. Ver
-- docs/tickets/2026-09-27-recomendacion-excluye-dj-mal-calificado.md.
--
-- ═══ Alcance de esta migración — QUÉ SÍ y QUÉ NO ═══
-- SÍ: excluye para UN cliente específico (p_master_client_id) cualquier DJ
--     que ese mismo cliente ya calificó con 1-2 estrellas (de 5) en
--     dj_public_reviews. El resto de clientes lo siguen viendo normal --
--     confirmado por el PO: "es 10 contra 1, no se puede juzgar por un
--     cliente" -- esto NUNCA toca dp.rating (el promedio general del DJ).
-- NO incluye (a propósito, decisión explícita del PO 2026-09-27): exigir que
--     la reseña esté atada a una contratación real confirmada. Se investigó
--     `leads` (única tabla con client_user_id + assigned_dj_id juntos) --
--     de 7 filas totales, las 7 están CANCELLED, solo 1 tiene cliente+DJ
--     juntos, 0 tienen pago liberado. Exigir eso hoy bloquearía
--     prácticamente todas las reseñas reales, incluidas las 3 que ya
--     existen. El PO decidió: construir la exclusión ahora sin esa
--     verificación, y agregarla después cuando haya contrataciones
--     confirmadas reales que usar -- protege menos hoy que lo pedido, pero
--     ya funciona, en vez de esperar sin nada.
-- NO conecta esta función al buscador público (find-dj.html) todavía --
--     sigue viviendo solo en la herramienta interna de staff. Esa conexión
--     es el punto 3 del diseño del ticket, pendiente de decisión aparte.
--
-- Entorno: FUENTE ÚNICA — PROD (hkuvuqupbxwkiykxvqdr). Solo modifica la
-- función; no toca dj_public_reviews ni sus RLS/grants existentes.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_recommended_djs(p_master_client_id uuid, p_event_date date)
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
    -- Exclusión nueva 2026-09-27: este cliente específico ya calificó a este
    -- DJ con 1-2 estrellas en una reseña publicada -- no se le vuelve a
    -- recomendar A ÉL, aunque el DJ siga apareciendo normal para todos los
    -- demás clientes (dp.rating, el promedio general, no se toca).
    and not exists (
      select 1 from public.dj_public_reviews dpr
      where dpr.dj_user_id = dp.user_id
        and dpr.reviewer_user_id = p_master_client_id
        and dpr.rating <= 2
        and dpr.status = 'published'
    )
  order by
    is_affiliated desc,
    is_pro desc,
    is_available desc,
    dp.rating desc nulls last
  limit 20;
$function$;

COMMENT ON FUNCTION public.get_recommended_djs(uuid, date) IS
  'Recomienda DJs a un cliente (staff, calendario operacional). Excluye por cliente específico cualquier DJ que ese mismo cliente calificó 1-2 estrellas en dj_public_reviews (status=published) -- no afecta el rating general visible a otros clientes. No exige contratación confirmada detrás de la reseña todavía (leads sin datos reales suficientes hoy, 2026-09-27) -- agregar esa verificación cuando exista.';
