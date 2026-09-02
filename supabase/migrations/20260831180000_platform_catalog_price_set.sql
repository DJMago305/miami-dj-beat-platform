-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Ticket "SPRINT CRÍTICO" (parte
-- de la ampliación de alcance del 2026-08-31: el PO confirmó que ELIXIS debe
-- poder cambiar precios del catálogo, gateado a owner/admin).
--
-- Escribe UN sku a la vez en el overlay JSON platform_settings.
-- rentals_catalog_prices (texto que contiene JSON -- mismo formato que ya lee
-- parseCatalogOverlay() en _shared/event-quote-catalog.ts). NO toca
-- CATALOG_FALLBACK (eso es código, no dato): esto solo agrega/actualiza una
-- entrada de override sobre el default. La validación de que el sku sea uno
-- real del catálogo vive en elixis-chat (donde ya está importado
-- CATALOG_FALLBACK), no aquí -- este RPC no duplica esa lista.
--
-- El check de rol (owner/admin) vive en elixis-chat, ANTES de llamar este
-- RPC. Aquí, como en el resto de los RPCs de escritura de esta plataforma,
-- el único candado de la base es que solo service_role puede ejecutarlo.

CREATE OR REPLACE FUNCTION public.platform_catalog_price_set(
  p_sku           text,
  p_unit_usd      numeric,
  p_staff_user_id uuid,
  p_agent_id      text DEFAULT 'elixis'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku     text := btrim(coalesce(p_sku, ''));
  v_current text;
  v_json    jsonb;
BEGIN
  IF v_sku = '' OR char_length(v_sku) > 64 THEN
    RAISE EXCEPTION 'sku_invalido';
  END IF;
  IF p_unit_usd IS NULL OR p_unit_usd < 0 OR p_unit_usd > 100000 THEN
    RAISE EXCEPTION 'precio_invalido';
  END IF;
  IF p_staff_user_id IS NULL THEN
    RAISE EXCEPTION 'staff_user_id_requerido';
  END IF;

  SELECT value INTO v_current FROM public.platform_settings WHERE key = 'rentals_catalog_prices';

  BEGIN
    v_json := COALESCE(v_current::jsonb, '{}'::jsonb);
  EXCEPTION WHEN others THEN
    v_json := '{}'::jsonb;
  END;

  v_json := jsonb_set(v_json, ARRAY[v_sku], to_jsonb(round(p_unit_usd::numeric, 2)), true);

  INSERT INTO public.platform_settings (key, value, description, updated_at)
  VALUES (
    'rentals_catalog_prices',
    v_json::text,
    'Overlay de precios de catálogo (por SKU). Última edición vía ELIXIS/staff.',
    now()
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'sku', v_sku, 'unit_usd', round(p_unit_usd::numeric, 2));
END;
$$;

REVOKE ALL ON FUNCTION public.platform_catalog_price_set(text, numeric, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_catalog_price_set(text, numeric, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.platform_catalog_price_set(text, numeric, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.platform_catalog_price_set(text, numeric, uuid, text) TO service_role;

COMMENT ON FUNCTION public.platform_catalog_price_set(text, numeric, uuid, text) IS
  'Escribe un override de precio por SKU en platform_settings.rentals_catalog_prices. EXECUTE solo service_role. El gate de owner/admin vive en elixis-chat.';

NOTIFY pgrst, 'reload schema';
