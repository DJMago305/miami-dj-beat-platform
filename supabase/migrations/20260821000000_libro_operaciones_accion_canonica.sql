-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo (rtbsovavmtnjpbbpwsin)                    ║
-- ║  NO EJECUTAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  Libro de Operaciones IA · nueva acción canónica                         ║
-- ║  Requiere: M1, M2, M3, M5 ya aplicadas (fenix_puede() debe existir).      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- COMPROBAR ANTES DE CORRER — no asumir por notas de otra sesión
--   SELECT array_length(public.fenix_acciones_canonicas(), 1);
--   -- Si da 11 → esta migración YA CORRIÓ. No repetir.
--   -- Si da 10 → falta correrla. Si la función ni existe → falta M5 primero.
--
-- QUÉ RESUELVE
--   El catálogo cerrado de fenix_acciones_canonicas() (M5) tiene hoy diez
--   acciones — ninguna sirve para el Libro de Operaciones IA. La Fase 2A de su
--   constitución (artifact 55cf2cd5) necesita conceder, caso por caso, que un
--   artista lea un reporte suyo ya guardado cuando el gerente o el propietario
--   lo autoricen — eso pasa por fenix_puede(), y fenix_puede() deniega
--   cualquier acción que no esté en este catálogo.
--
--   Esta migración no toca M5: redefine la misma función (CREATE OR REPLACE,
--   IDÉNTICO patrón que ya usa M5 para permitir crecer el catálogo sin volver
--   a escribir la restricción que lo consume) y le añade una sola acción.
--
-- QUÉ NO HACE
--   · No crea la tabla del libro ni su candado — eso es la Fase 1, aparte.
--   · No decide el nivel ni el alcance exacto de la concesión en cada caso —
--     esa comprobación fina (qué reporte, qué rango de fechas) vive en la
--     función que sirva la lectura del artista, no aquí.
--   · No modifica ninguna concesión ya existente: la restricción de
--     permission_grants sobre el catálogo es NOT VALID desde M5, así que
--     ampliar el catálogo no reescribe historial.
--
-- POR QUÉ UNA MIGRACIÓN APARTE Y NO EDITAR M5
--   M5 ya quedó aprobado y corrido como una pieza cerrada (comentario propio:
--   "Opción A, aprobada por el PO el 2026-08-17"). Tocarla directamente
--   mezclaría dos aprobaciones distintas en un solo archivo. Tal como M5
--   permite reemplazar fenix_acciones_canonicas() sin tocar nada más, esta
--   migración solo hace eso.

BEGIN;

CREATE OR REPLACE FUNCTION public.fenix_acciones_canonicas()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'gmail.read', 'gmail.compose', 'gmail.send',
    'calendar.read', 'calendar.write',
    'campaign.prepare',
    'staff.read_all',
    'financial.read', 'financial.execute',
    'profile.bio.update',
    'libro.leer_propio'
  ];
$$;

COMMENT ON FUNCTION public.fenix_acciones_canonicas() IS
  'M5 + Libro de Operaciones IA · Vocabulario único de acciones. Once acciones: las diez de M5 (2026-08-17) más libro.leer_propio, añadida para la concesión puntual de lectura de la Fase 2A del Libro (artifact 55cf2cd5).';

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · El catálogo ahora responde once acciones, no diez
--   SELECT public.fenix_acciones_canonicas();
--   -- ESPERADO: array de 11 acciones, incluyendo 'libro.leer_propio'.
--
-- V2 · Las diez acciones de M5 siguen intactas (nada se perdió al redefinir)
--   SELECT 'gmail.read' = ANY (public.fenix_acciones_canonicas())
--      AND 'financial.execute' = ANY (public.fenix_acciones_canonicas())
--      AND 'profile.bio.update' = ANY (public.fenix_acciones_canonicas()) AS intactas;
--   -- ESPERADO: true
--
-- V3 · Una concesión con este alcance ya no es rechazada por el catálogo
--   (requiere una fila de permission_grants con alcance = 'libro.leer_propio'
--   creada aparte, como parte de la Fase 2A — este bloque solo confirma que
--   el catálogo ya no la bloquearía por sí mismo)
--   SELECT 'libro.leer_propio' = ANY (public.fenix_acciones_canonicas()) AS aceptada;
--   -- ESPERADO: true
--
-- ── REVERSIÓN ──
-- CREATE OR REPLACE FUNCTION public.fenix_acciones_canonicas()
-- RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
--   SELECT ARRAY[
--     'gmail.read', 'gmail.compose', 'gmail.send',
--     'calendar.read', 'calendar.write',
--     'campaign.prepare', 'staff.read_all',
--     'financial.read', 'financial.execute',
--     'profile.bio.update'
--   ];
-- $$;
