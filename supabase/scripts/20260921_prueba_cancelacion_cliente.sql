-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Órdenes de PRUEBA para probar «Cancelar mi evento» en la cuenta de Wendy (wendyeayala@hotmail.com). CREADAS 2026-09-21.
--   b1: CONFIRMED con $50 pagados  → el portal debe mostrar «Cancelar» (pide solicitud con motivo; línea de pago dentro de 24 h)
--   b2: NEW sin pago               → el portal debe mostrar «Delete» (borrado directo permitido)
-- Al insertarlas saltó el aviso normal de «lead nuevo». NO hubo cobro real: el balance_paid es un dato de prueba.

-- ═════════ LIMPIAR (aplicar al terminar la prueba) ═════════
-- delete from public.cancelaciones_solicitadas where evento_titulo like 'PRUEBA CANCELAR%' or evento_titulo like 'PRUEBA BORRAR%';
-- delete from public.leads where source = 'prueba_cancelacion_cliente';
-- (las alertas 🚨 y acuses de prueba quedan en dj_notifications / avisos_pendientes como registro; pueden borrarse por título si molestan)

-- ═════════ SOLICITUDES DE PRUEBA para revisar el panel del staff (creadas 2026-09-21 como Wendy y como DJSolitario) ═════════
-- Ambas tienen el motivo «PRUEBA: …». La de DJSolitario es del turno del 25/09: NO aprobarla si no quieres tocar ese turno real (aprobar un turno solo registra).
-- LIMPIAR: delete from public.cancelaciones_solicitadas where motivo_detalle like 'PRUEBA:%';
--          (y borrar de dj_notifications / avisos_pendientes las alertas 🚨 y acuses de prueba si molestan)
