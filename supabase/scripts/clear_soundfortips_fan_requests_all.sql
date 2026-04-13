-- =============================================================================
-- SOUNDFORTIPS — limpieza total de peticiones (prueba real desde cero)
-- =============================================================================
-- Ejecutar SOLO en el SQL Editor del proyecto Supabase (rol postgres).
-- Borra TODAS las filas de soundfortips_fan_requests (pendientes, aceptadas,
-- denegadas). No modifica dj_profiles ni cuentas.
--
-- Antes de truncar en producción:
-- - Si hubo pagos Stripe pendientes o disputas, revisa Stripe Dashboard.
-- - Los fans/DJs deben limpiar localStorage en el navegador (claves mdj_sft_*)
--   o usar ventana privada para no mezclar cola local con el servidor vacío.
-- =============================================================================

TRUNCATE TABLE public.soundfortips_fan_requests;

-- Alternativa (mismo efecto si TRUNCATE no es viable por políticas):
-- DELETE FROM public.soundfortips_fan_requests;
