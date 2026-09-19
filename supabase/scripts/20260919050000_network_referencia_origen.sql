-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: "lo más
--   importante en esta lista debe quedar claro de dónde vino el dato,
--   si una persona entró por DJMago305 o entró por DJ Ary o por el
--   que haya entrado a esta lista".
-- ============================================================
--
-- Por qué un campo nuevo y no reusar referred_by/referral_id/source_ref
-- (ya existen en dj_profiles/client_profiles): esas columnas son del
-- PROGRAMA DE REFERIDOS público (?ref=, marketing) -- hoy están vacías
-- para las 12 cuentas reales de DJ, confirmado por consulta directa.
-- Es un concepto distinto: "quién de nuestro staff/DJ trajo este
-- contacto a su red personal", no "qué link de referido usó para
-- registrarse". Mezclar los dos ensuciaría el programa de referidos
-- real. Se agrega solo a network_referencia_contactos por ahora --
-- esta tabla es 100% nueva de esta noche, sin riesgo de chocar con
-- nada existente. Extenderlo a client_profiles/dj_profiles queda
-- pendiente de diseño (el PO todavía no confirmó si ahí también debe
-- vivir separado del programa de referidos o si se debe unificar).

ALTER TABLE public.network_referencia_contactos
  ADD COLUMN IF NOT EXISTS origen_persona_id   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS origen_persona_nombre text;

COMMENT ON COLUMN public.network_referencia_contactos.origen_persona_id IS 'De qué persona/DJ del staff viene este contacto (su red personal) -- distinto del programa de referidos público (referred_by/referral_id en dj_profiles/client_profiles).';
COMMENT ON COLUMN public.network_referencia_contactos.origen_persona_nombre IS 'Nombre desnormalizado de origen_persona_id, para no depender de un JOIN a auth.users desde el cliente.';

-- Backfill: los 599 contactos importados esta noche vienen todos del
-- propio export personal de Outlook/iPhone del PO (Gerardo A Valle /
-- DJMago305) -- confirmado por el propio origen_csv (FORM1-5).
UPDATE public.network_referencia_contactos
   SET origen_persona_id = '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4',
       origen_persona_nombre = 'Gerardo A Valle (DJMago305)'
 WHERE origen_persona_id IS NULL;

NOTIFY pgrst, 'reload schema';
