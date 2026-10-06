-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Perfil publico: cada resena sale con is_verified = (source_lead_id IS NOT NULL), es decir, hay un contrato detras.
-- Cambia SOLO get_dj_public_review_bundle: agrega UN campo (is_verified) a cada resena. Mismos parametros, mismo retorno (jsonb),
-- mismo filtro (status = 'published'), mismo orden y limite (24). No cambia promedio ni conteo. Volver a correrlo es seguro.
-- El front (dj-profile.html) pinta la insignia «Verificada» solo si is_verified es true; sin este SQL no pinta nada.
CREATE OR REPLACE FUNCTION public.get_dj_public_review_bundle(p_dj_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_avg numeric;
  v_rows jsonb;
BEGIN
  IF p_dj_user_id IS NULL THEN
    RETURN jsonb_build_object('avg_rating', null, 'review_count', 0, 'reviews', '[]'::jsonb);
  END IF;

  SELECT count(*)::integer, round(avg(rating)::numeric, 2)
  INTO v_count, v_avg
  FROM public.dj_public_reviews
  WHERE dj_user_id = p_dj_user_id
    AND status = 'published';

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.id,
      r.rating,
      NULLIF(btrim(COALESCE(r.comment, '')), '') AS comment,
      COALESCE(
        NULLIF(btrim(r.reviewer_display_name), ''),
        NULLIF(btrim(cp.full_name), ''),
        'Verified client'
      ) AS reviewer_display_name,
      r.created_at,
      (r.source_lead_id IS NOT NULL) AS is_verified
    FROM public.dj_public_reviews r
    LEFT JOIN public.client_profiles cp ON cp.user_id = r.reviewer_user_id
    WHERE r.dj_user_id = p_dj_user_id
      AND r.status = 'published'
    ORDER BY r.created_at DESC
    LIMIT 24
  ) t;

  RETURN jsonb_build_object(
    'avg_rating', CASE WHEN COALESCE(v_count, 0) > 0 THEN v_avg ELSE null END,
    'review_count', COALESCE(v_count, 0),
    'reviews', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$function$;

-- Comprobacion: cuantas resenas publicadas hay y cuantas serian «Verificada» (solo lectura)
select count(*) as publicadas, count(*) filter (where source_lead_id is not null) as verificadas
  from public.dj_public_reviews where status = 'published';
