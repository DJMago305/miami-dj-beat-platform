-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo                                          ║
-- ║  NO EJECUTAR EN PRODUCCIÓN                                               ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  ACCIONES DELEGADAS · beneficiario_tipo = 'perfil'                       ║
-- ║  Requisitos: M1, M2, M3 aplicadas. 2026-08-17.                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- QUÉ PRUEBA
--   El caso humano: un ARTISTA (A) le presta autoridad a un MÁNAGER (B) sobre
--   una parcela concreta de su agenda, y se la retira. Hasta ahora solo se
--   había ejercitado la delegación a un agente del sistema ('fenix').
--
-- ADVERTENCIA SOBRE fenix_can()
--   `public.fenix_can()` (cimentación 2A) NO participa en esto: decide por rol
--   y plan del propio usuario, con una lista fija de acciones, y no lee
--   `permission_grants`. Son dos sistemas de autoridad independientes que hoy
--   no se conocen. Reconciliarlos es una decisión pendiente, no un ajuste.
--
-- A y B se resuelven solos. Nada que sustituir a mano.
--   A = perfil con el profile_id más bajo   (el artista)
--   B = el siguiente                        (el mánager)
--   C = el tercero                          (otro mánager, control negativo)
--
-- CADA BLOQUE POR SEPARADO. Pestaña limpia, pegar, Run.


-- ═══════════════════════════════════════════════════════════════════════════
-- D0 · Quién es quién
-- ═══════════════════════════════════════════════════════════════════════════
(SELECT 'A · artista'      AS papel, profile_id FROM public.dj_profiles
  ORDER BY profile_id LIMIT 1)
UNION ALL
(SELECT 'B · mánager',     profile_id FROM public.dj_profiles
  ORDER BY profile_id OFFSET 1 LIMIT 1)
UNION ALL
(SELECT 'C · otro mánager', profile_id FROM public.dj_profiles
  ORDER BY profile_id OFFSET 2 LIMIT 1);

-- ESPERADO: tres FENIX-ID distintos.


-- ═══════════════════════════════════════════════════════════════════════════
-- D1 · El artista delega en el mánager
-- ═══════════════════════════════════════════════════════════════════════════
--   Nivel `preparar`: el mánager puede dejar una fecha lista, NO cerrarla.
--   Es la diferencia entre «prepárame el contrato» y «firma por mí».
INSERT INTO public.permission_grants
  (otorgante_profile_id, beneficiario_tipo, beneficiario_ref,
   alcance, nivel, concedido_metodo)
SELECT (SELECT profile_id FROM public.dj_profiles
         ORDER BY profile_id LIMIT 1),            -- A concede
       'perfil',
       (SELECT profile_id FROM public.dj_profiles
         ORDER BY profile_id OFFSET 1 LIMIT 1),   -- a B
       'agenda.confirmar', 'preparar', 'ui';

-- ESPERADO: Success.


-- ═══════════════════════════════════════════════════════════════════════════
-- D2 · LA ESCALERA — la autoridad baja, no sube
-- ═══════════════════════════════════════════════════════════════════════════
SELECT public.mdj_permiso_vigente(a,'perfil',b,'agenda.confirmar','consultar') AS puede_consultar,
       public.mdj_permiso_vigente(a,'perfil',b,'agenda.confirmar','preparar')  AS puede_preparar,
       public.mdj_permiso_vigente(a,'perfil',b,'agenda.confirmar','ejecutar')  AS puede_ejecutar
  FROM (SELECT (SELECT profile_id FROM public.dj_profiles
                 ORDER BY profile_id LIMIT 1) AS a,
               (SELECT profile_id FROM public.dj_profiles
                 ORDER BY profile_id OFFSET 1 LIMIT 1) AS b) t;

-- ESPERADO: true · true · false
--   consultar = true  → un nivel superior incluye los inferiores
--   ejecutar  = false → NUNCA se infiere hacia arriba (§16)
-- Si puede_ejecutar sale true, el mánager podría cerrar fechas en nombre del
-- artista sin que este se lo concediera. Parada inmediata.


-- ═══════════════════════════════════════════════════════════════════════════
-- D3 · CONTROL NEGATIVO — el permiso es de B, no de «los mánagers»
-- ═══════════════════════════════════════════════════════════════════════════
SELECT public.mdj_permiso_vigente(a,'perfil',c,'agenda.confirmar','consultar') AS puede_el_otro
  FROM (SELECT (SELECT profile_id FROM public.dj_profiles
                 ORDER BY profile_id LIMIT 1) AS a,
               (SELECT profile_id FROM public.dj_profiles
                 ORDER BY profile_id OFFSET 2 LIMIT 1) AS c) t;

-- ESPERADO: false — §31: todo permiso es específico. No hay permisos de gremio.


-- ═══════════════════════════════════════════════════════════════════════════
-- D4 · El rastro dice a quién, para qué y hasta dónde
-- ═══════════════════════════════════════════════════════════════════════════
SELECT accion,
       recurso_profile_id                    AS otorgante,
       despues->>'permiso_beneficiario'      AS tipo,
       despues->>'permiso_ref'               AS beneficiario,
       despues->>'permiso_alcance'           AS alcance,
       despues->>'permiso_nivel'             AS nivel
  FROM public.audit_log
 WHERE accion = 'permiso.concedido'
 ORDER BY id DESC LIMIT 1;

-- ESPERADO: permiso.concedido · FENIX de A · perfil · FENIX de B ·
--           agenda.confirmar · preparar
-- Un registro de delegación que no diga a QUIÉN se delegó no vale de nada.


-- ═══════════════════════════════════════════════════════════════════════════
-- D5 · RLS — el beneficiario NO ve la concesión, y es correcto
-- ═══════════════════════════════════════════════════════════════════════════
--   §1: los datos pertenecen al dueño del perfil. La lista de permisos es del
--   ARTISTA, no del mánager. El mánager no necesita leerla: el sistema le
--   responde sí o no a través de mdj_permiso_vigente(), que es SECURITY
--   DEFINER. Se delega autoridad, no acceso al registro de autoridad.
BEGIN;
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id OFFSET 1 LIMIT 1),   -- sesión de B
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) AS lo_que_ve_el_manager
    FROM public.permission_grants
   WHERE alcance = 'agenda.confirmar';
COMMIT;

-- ESPERADO: 0


-- ═══════════════════════════════════════════════════════════════════════════
-- D6 · CONTROL POSITIVO — el artista sí ve lo que concedió
-- ═══════════════════════════════════════════════════════════════════════════
--   Sin este bloque, el 0 de D5 no probaría nada: podría significar que nadie
--   ve nada, ni siquiera el dueño.
BEGIN;
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id LIMIT 1),            -- sesión de A
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) AS lo_que_ve_el_artista
    FROM public.permission_grants
   WHERE alcance = 'agenda.confirmar';
COMMIT;

-- ESPERADO: 1


-- ═══════════════════════════════════════════════════════════════════════════
-- D7 · Retirar la confianza — y que se corte en el acto
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE public.permission_grants
   SET revocado_en = now(),
       revocado_motivo = 'fin de la relación con el mánager'
 WHERE alcance = 'agenda.confirmar' AND revocado_en IS NULL;

SELECT public.mdj_permiso_vigente(a,'perfil',b,'agenda.confirmar','consultar') AS sigue_pudiendo
  FROM (SELECT (SELECT profile_id FROM public.dj_profiles
                 ORDER BY profile_id LIMIT 1) AS a,
               (SELECT profile_id FROM public.dj_profiles
                 ORDER BY profile_id OFFSET 1 LIMIT 1) AS b) t;

-- ESPERADO: false — sin periodo de gracia, sin caché, sin «hasta mañana».


-- ═══════════════════════════════════════════════════════════════════════════
-- D8 · Y la revocación queda registrada con su motivo
-- ═══════════════════════════════════════════════════════════════════════════
SELECT accion,
       despues->>'permiso_ref'    AS beneficiario,
       despues->>'permiso_motivo' AS motivo
  FROM public.audit_log
 WHERE accion = 'permiso.revocado'
 ORDER BY id DESC LIMIT 1;

-- ESPERADO: permiso.revocado · FENIX de B · 'fin de la relación con el mánager'
