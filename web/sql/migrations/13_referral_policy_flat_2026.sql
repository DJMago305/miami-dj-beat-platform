-- Policy update (Apr 2026): documentación — la lógica de negocio vive en web/monetization.js
-- y debe replicarse en Edge/Stripe al liquidar.
--
-- Cliente con ?ref=: hasta USD 30 de descuento en la primera compra (salvo otra campaña MDJ).
-- DJ referidor: USD 20 fijos en la primera compra del referido si el total elegible > USD 500
-- (no porcentaje; reemplaza el modelo 10% descrito en comentarios antiguos).

COMMENT ON TABLE referral_sale_commissions IS
  'Atribución primera compra con ref. Comisión al DJ: USD 20 flat si gross elegible > 500 USD; descuento cliente hasta USD 30 solo 1ª compra (ver monetization.js).';
