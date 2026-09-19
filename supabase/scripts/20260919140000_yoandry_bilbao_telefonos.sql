-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido del PO al comentar que
--   Yoandry Bilbao tiene un celular adicional en Brasil (número
--   pendiente, se comunican por WhatsApp).
-- ============================================================
--
-- Al revisar su ficha se encontró que ya tenía 2 teléfonos
-- adicionales (Venezuela, +58) guardados como texto suelto en notas
-- desde el import original -- se migran a phones_extra (la sección
-- estructurada nueva) y se deja una nota clara sobre el celular de
-- Brasil pendiente.
UPDATE public.network_referencia_contactos
   SET phones_extra = '[{"tipo":"personal","numero":"+584165358229"},{"tipo":"personal","numero":"+58 4145333778"}]'::jsonb,
       notas = 'También tiene un celular en Brasil (número pendiente -- el PO no lo tiene a mano todavía). Se comunican por WhatsApp.'
 WHERE id = 'c0646931-bedd-4418-8a3a-b2100e15c175';

NOTIFY pgrst, 'reload schema';
