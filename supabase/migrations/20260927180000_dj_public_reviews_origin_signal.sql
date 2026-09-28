-- 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- 2026-09-27: pieza real del ticket de experiencia por venue (docs/tickets/
-- 2026-09-27-experiencia-real-por-venue-y-calificacion-publica.md) -- señal
-- de origen de reseña, pedida explícitamente por el PO: "depende de dónde
-- viene la reseña es el valor de la misma... no es igual una reseña que el
-- DJ toma compartiendo el link con amistades que una de un evento que hizo,
-- se supone que la reseña del venue o del cliente vale más."
--
-- Señal real y verificable ya disponible (no inventada): leads tiene
-- client_user_id + event_completed_at + assigned_dj_id -- el mismo patrón
-- exacto que ya usa evaluar_evento_cliente() (RPC privada existente) para
-- confirmar que quien evalúa SÍ fue el cliente real de un evento YA
-- completado con ESE DJ. Reutilizamos el mismo criterio de verificación
-- para el sistema de reseñas PÚBLICAS (dj_public_reviews), que hoy no
-- distingue el origen en absoluto.
--
-- Aditivo/idempotente: nuevas columnas con ADD COLUMN IF NOT EXISTS. La
-- función submit_dj_public_review() cambia de firma (se agrega un 4º
-- parámetro opcional) -- DROP + CREATE explícito para evitar dejar dos
-- versiones ambiguas (CREATE OR REPLACE con firma distinta crea un
-- overload nuevo en vez de reemplazar), con GRANT re-otorgado igual que
-- la función original.

ALTER TABLE public.dj_public_reviews
  ADD COLUMN IF NOT EXISTS source_lead_id uuid REFERENCES public.leads(id),
  ADD COLUMN IF NOT EXISTS review_weight numeric NOT NULL DEFAULT 1.0;

COMMENT ON COLUMN public.dj_public_reviews.source_lead_id IS
  'Lead real y verificado (cliente=reviewer, evento completado, mismo DJ) al que esta reseña quedó ligada, si el enlace de "Pedir Reseña" traía la referencia. NULL = reseña sin evento verificado (ej. el DJ compartió su link con conocidos, o vino del perfil público sin contexto de evento).';
COMMENT ON COLUMN public.dj_public_reviews.review_weight IS
  'Peso de la reseña para ordenar/ponderar (1.0 = sin verificar, 2.0 = ligada a un evento real y verificado). Nunca se usa para ocultar reseñas, solo para ponderar -- ver docs/tickets/2026-09-27-experiencia-real-por-venue-y-calificacion-publica.md.';

DROP FUNCTION IF EXISTS public.submit_dj_public_review(uuid, smallint, text);

CREATE FUNCTION public.submit_dj_public_review(p_dj_user_id uuid, p_rating smallint, p_comment text DEFAULT NULL::text, p_lead_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_row public.dj_public_reviews%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_lead_dj_user_id uuid;
  v_verified_lead_id uuid := NULL;
  v_weight numeric := 1.0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_dj_user_id IS NULL OR p_dj_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot review your own profile';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dj_profiles d WHERE d.user_id = p_dj_user_id) THEN
    RAISE EXCEPTION 'DJ profile not found';
  END IF;

  -- Señal de origen (2026-09-27): mismo criterio de verificación que ya usa
  -- evaluar_evento_cliente() -- si no verifica por cualquier motivo (lead
  -- ajeno, evento sin terminar, DJ distinto, lead inexistente), la reseña
  -- se guarda igual, solo sin el peso extra. Nunca bloquea el flujo
  -- principal por un p_lead_id opcional inválido.
  IF p_lead_id IS NOT NULL THEN
    SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
    IF v_lead.id IS NOT NULL
       AND v_lead.client_user_id = v_uid
       AND v_lead.event_completed_at IS NOT NULL
       AND v_lead.assigned_dj_id IS NOT NULL THEN
      SELECT user_id INTO v_lead_dj_user_id FROM public.dj_profiles WHERE id = v_lead.assigned_dj_id;
      IF v_lead_dj_user_id = p_dj_user_id THEN
        v_verified_lead_id := p_lead_id;
        v_weight := 2.0;
      END IF;
    END IF;
  END IF;

  SELECT NULLIF(btrim(cp.full_name), '')
  INTO v_name
  FROM public.client_profiles cp
  WHERE cp.user_id = v_uid;

  IF v_name IS NULL THEN
    SELECT NULLIF(btrim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), '')
    INTO v_name
    FROM auth.users u
    WHERE u.id = v_uid;
  END IF;

  INSERT INTO public.dj_public_reviews (
    dj_user_id, reviewer_user_id, rating, comment, reviewer_display_name, status, updated_at, source_lead_id, review_weight
  )
  VALUES (
    p_dj_user_id, v_uid, p_rating, NULLIF(btrim(COALESCE(p_comment, '')), ''), COALESCE(v_name, 'Verified client'), 'published', now(), v_verified_lead_id, v_weight
  )
  ON CONFLICT (dj_user_id, reviewer_user_id) DO UPDATE
  SET
    rating = EXCLUDED.rating,
    comment = COALESCE(EXCLUDED.comment, public.dj_public_reviews.comment),
    reviewer_display_name = COALESCE(EXCLUDED.reviewer_display_name, public.dj_public_reviews.reviewer_display_name),
    status = 'published',
    updated_at = now(),
    -- Nunca degradar una reseña ya verificada por una edición posterior sin
    -- lead_ref (ej. el cliente vuelve a entrar por el link genérico del
    -- perfil y edita su reseña ya publicada).
    source_lead_id = COALESCE(public.dj_public_reviews.source_lead_id, EXCLUDED.source_lead_id),
    review_weight = GREATEST(public.dj_public_reviews.review_weight, EXCLUDED.review_weight)
  RETURNING * INTO v_row;

  PERFORM public.refresh_dj_profile_review_rollup(p_dj_user_id);

  RETURN public.get_dj_public_review_bundle(p_dj_user_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_dj_public_review(uuid, smallint, text, uuid) TO anon, authenticated, service_role, postgres;
