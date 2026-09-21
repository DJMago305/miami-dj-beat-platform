-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- YA APLICADO el 2026-09-21 (a pedido del PO, "soluciona esa" = opción A).
-- Vulnerabilidad #3 de la auditoría de funciones SECURITY DEFINER abiertas a anon:
-- mdj_redeem_discount_code(text, uuid) hacía `uses = uses + 1` en discount_codes para cualquiera, sin sesión.
-- NADIE la llama (ni web/ ni edge functions): el portal del cliente solo usa mdj_validate_discount_code, que valida
-- y calcula el descuento pero no cuenta el uso -> hoy los cupones nunca se "gastan" (uses = 0 en los 3).
-- Severidad real: BAJA hoy (ningún cupón tiene max_uses); sería real el día que se usen topes.
-- mdj_validate_discount_code queda ABIERTA a propósito (la usa client-portal.js).
-- Si algún día se quiere que los cupones se gasten de verdad (opción B), construir la llamada al pagar, con sesión.

revoke execute on function public.mdj_redeem_discount_code(text, uuid) from public;
revoke execute on function public.mdj_redeem_discount_code(text, uuid) from anon, authenticated;
