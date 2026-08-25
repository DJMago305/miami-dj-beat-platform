-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo                                          ║
-- ║  NO EJECUTAR EN PRODUCCIÓN                                               ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  SUITE DE AISLAMIENTO RLS — SESIONES SIMULADAS                           ║
-- ║  v2, 2026-08-17. Reescrita tras dos falsos positivos.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- REQUISITOS, EN ESTE ORDEN
--   1) M1, M2, M3, M4 aplicadas
--   2) constitucion_alinear_rls_perfiles_ensayo.sql  (las tablas de perfil
--      responden; sin esto el RLS deniega también al dueño)
--   3) M2 y M3 con las políticas basadas en mdj_perfiles_de_usuario()
--
-- ⚠️  NO SE EJECUTA DE UNA VEZ. Once bloques independientes; CINCO deben
--     terminar en ERROR, y ese error es el resultado correcto. Lanzados
--     juntos, el primero que falle aborta el resto.
--     Uno por uno: pestaña limpia, ⌘A, borrar, pegar UN bloque, Run.
--
--
-- ═══ LAS DOS REGLAS QUE ESTA SUITE APRENDIÓ A GOLPES ═══════════════════════
--
-- REGLA 1 · TODA PRUEBA DE AISLAMIENTO NECESITA SU CONTROL POSITIVO
--   Contar lo ajeno y esperar 0 no distingue «hay una frontera» de «no se ve
--   nada en absoluto». El 2026-08-17 la primera versión de esta suite se dio
--   por superada mientras el RLS denegaba a todo el mundo, incluido el dueño:
--   todos los ceros salían, y ninguno significaba lo que parecía. Cada bloque
--   de lectura pide ahora DOS números: lo ajeno (0) y lo propio (> 0).
--
-- REGLA 2 · LAS IDENTIDADES SE RESUELVEN ANTES DE BAJAR DE ROL
--   `SELECT profile_id FROM dj_profiles ORDER BY profile_id LIMIT 1` dentro de
--   una sesión simulada NO devuelve lo que parece: esa tabla tiene RLS, así que
--   dentro de la sesión de B solo existe la fila de B. La consulta acababa
--   midiéndose a sí misma. Peor: `OFFSET 1` devolvía NULL y el INSERT de
--   prueba fallaba por una razón que no era la que se estaba probando.
--   Ahora los identificadores se capturan como `postgres`, se guardan en
--   variables de sesión (`mdj.a_profile`, `mdj.b_profile`) y se leen con
--   `current_setting()` después del cambio de rol. Cada bloque IMPRIME esos
--   identificadores: si la prueba vuelve a medirse a sí misma, se ve en
--   pantalla en vez de deducirse tres horas después.
--
-- QUIÉN ES QUIÉN
--   A = dj_profiles con el profile_id más bajo   (el perfil observado)
--   B = el siguiente                             (el intruso)


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 0 · Qué privilegios existen DE VERDAD
-- ═══════════════════════════════════════════════════════════════════════════
SELECT table_name, grantee,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('audit_log', 'permission_grants')
   AND grantee IN ('anon', 'authenticated', 'service_role')
 GROUP BY table_name, grantee
 ORDER BY table_name, grantee;

-- ESPERADO tras los REVOKE de M2/M3:
--   audit_log         · authenticated · SELECT            (y nada más)
--   audit_log         · anon          · no aparece
--   permission_grants · authenticated · INSERT, SELECT, UPDATE
--   permission_grants · anon          · no aparece
-- Si `anon` sigue apareciendo, M2/M3 no se reaplicaron después del 2026-08-17.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 1 · Identificar a A y a B
-- ═══════════════════════════════════════════════════════════════════════════
(SELECT 'A · observado' AS papel, profile_id, user_id
   FROM public.dj_profiles ORDER BY profile_id LIMIT 1)
UNION ALL
(SELECT 'B · intruso',   profile_id, user_id
   FROM public.dj_profiles ORDER BY profile_id OFFSET 1 LIMIT 1);

-- ESPERADO: dos filas con profile_id y user_id DISTINTOS.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 2 · CONTROL POSITIVO — A ve lo suyo
-- ═══════════════════════════════════════════════════════════════════════════
--   Va PRIMERO y es la condición para continuar. Ver REGLA 1.
BEGIN;
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id LIMIT 1),
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT auth.uid()                                      AS quien_soy,
         (SELECT count(*) FROM public.dj_profiles
           WHERE user_id = auth.uid())                   AS mi_perfil_visible,
         (SELECT count(*) FROM public.audit_log)         AS audit_visibles_A,
         (SELECT count(*) FROM public.permission_grants) AS grants_visibles_A;
COMMIT;

-- ESPERADO: mi_perfil_visible = 1, y los otros dos > 0.
-- ⚠️  SI SALE 0, LA SUITE SE DETIENE AQUÍ. No se sigue al PASO 3.
--     Resultado real 2026-08-17 tras las correcciones: 1 · 5 · 2.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 3 · AISLAMIENTO EN audit_log — con control simétrico
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
  SELECT set_config('mdj.a_profile',
           (SELECT profile_id FROM public.dj_profiles
             ORDER BY profile_id LIMIT 1), true);
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id OFFSET 1 LIMIT 1),
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT current_setting('mdj.a_profile')                AS perfil_de_A,
         (SELECT count(*) FROM public.audit_log
           WHERE recurso_profile_id = current_setting('mdj.a_profile'))
                                                         AS entradas_de_A_que_ve_B,
         (SELECT count(*) FROM public.audit_log)         AS entradas_totales_que_ve_B;
COMMIT;

-- ESPERADO: perfil_de_A = el FENIX de A (NO el de B), 0, y > 0.
-- Resultado real 2026-08-17: FENIX-2U5CJUJJ · 0 · 1.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 4 · AISLAMIENTO EN permission_grants — con control simétrico
-- ═══════════════════════════════════════════════════════════════════════════
--   B concede primero sobre SU perfil, para que su total no sea ambiguo. De
--   paso ejercita la política de INSERT por la vía legítima; el PASO 5 la
--   atacará por la ilegítima.
BEGIN;
  SELECT set_config('mdj.a_profile',
           (SELECT profile_id FROM public.dj_profiles
             ORDER BY profile_id LIMIT 1), true);
  SELECT set_config('mdj.b_profile',
           (SELECT profile_id FROM public.dj_profiles
             ORDER BY profile_id OFFSET 1 LIMIT 1), true);
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id OFFSET 1 LIMIT 1),
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.permission_grants
    (otorgante_profile_id, beneficiario_tipo, alcance, nivel, concedido_metodo)
  SELECT current_setting('mdj.b_profile'),
         'fenix', 'contactos.analizar', 'consultar', 'ui'
   WHERE NOT EXISTS (
     SELECT 1 FROM public.permission_grants
      WHERE alcance = 'contactos.analizar' AND revocado_en IS NULL);

  SELECT current_setting('mdj.b_profile')                AS perfil_de_B,
         (SELECT count(*) FROM public.permission_grants
           WHERE otorgante_profile_id = current_setting('mdj.a_profile'))
                                                         AS grants_de_A_que_ve_B,
         (SELECT count(*) FROM public.permission_grants) AS grants_totales_que_ve_B;
COMMIT;

-- ESPERADO: perfil_de_B = el FENIX de B, 0, y 1.
-- Resultado real 2026-08-17: FENIX-6PSV6VU8 · 0 · 1.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 5 · B se concede autoridad FIRMANDO COMO A — DEBE FALLAR
-- ═══════════════════════════════════════════════════════════════════════════
--   El ataque: B se otorga a sí mismo ejecución sobre las finanzas de A.
BEGIN;
  SELECT set_config('mdj.a_profile',
           (SELECT profile_id FROM public.dj_profiles
             ORDER BY profile_id LIMIT 1), true);
  SELECT set_config('mdj.b_profile',
           (SELECT profile_id FROM public.dj_profiles
             ORDER BY profile_id OFFSET 1 LIMIT 1), true);
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id OFFSET 1 LIMIT 1),
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.permission_grants
    (otorgante_profile_id, beneficiario_tipo, beneficiario_ref,
     alcance, nivel, concedido_metodo)
  VALUES (current_setting('mdj.a_profile'),   -- otorgante: A (falsificado)
          'perfil',
          current_setting('mdj.b_profile'),   -- beneficiario: B
          'finanzas.retirar', 'ejecutar', 'ui');
COMMIT;

-- ESPERADO: ERROR 42501
--   new row violates row-level security policy for table "permission_grants"
-- Es el fallo más grave posible de esta suite si NO aparece: significaría que
-- cualquiera puede concederse autoridad sobre el perfil de otro.
--
-- OJO AL DIAGNÓSTICO: el PASO 4 insertó con éxito por la vía legítima. Si el 4
-- pasa y el 5 falla, la política distingue las dos situaciones. Si fallaran los
-- dos, podría ser simplemente que nadie puede insertar nada.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 6 · B intenta ALTERAR la concesión de A — DEBE AFECTAR 0 FILAS
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
  SELECT set_config('mdj.a_profile',
           (SELECT profile_id FROM public.dj_profiles
             ORDER BY profile_id LIMIT 1), true);
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id OFFSET 1 LIMIT 1),
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  WITH intento AS (
    UPDATE public.permission_grants
       SET revocado_motivo = 'alterado por B'
     WHERE otorgante_profile_id = current_setting('mdj.a_profile')
    RETURNING 1)
  SELECT count(*) AS filas_alteradas_por_B FROM intento;
COMMIT;

-- ESPERADO: 0
--
-- MATIZ: si en vez de 0 sale el ERROR «La revocación es definitiva», el RLS NO
-- filtró la fila y lo único que frenó a B fue el disparador de inmutabilidad.
-- Eso es un fallo de aislamiento, no un éxito: B alcanzó una fila que no debía
-- ni poder ver.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 7 · B intenta BORRAR el historial — DEBE FALLAR
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id OFFSET 1 LIMIT 1),
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  DELETE FROM public.audit_log;
COMMIT;

-- ESPERADO: ERROR «permission denied for table audit_log»
-- Si sale «audit_log es de solo escritura», el REVOKE no entró pero el
-- disparador sí cumplió. Lo único inaceptable es «Success».


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 8 · B intenta FALSIFICAR una entrada de auditoría — DEBE FALLAR
-- ═══════════════════════════════════════════════════════════════════════════
--   Fabricar un consentimiento que nunca se dio es tan grave como borrarlo.
BEGIN;
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id OFFSET 1 LIMIT 1),
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.audit_log (accion, origen, resultado)
  VALUES ('permiso.concedido', 'falsificado', 'ok');
COMMIT;

-- ESPERADO: ERROR «permission denied for table audit_log»
-- Se escribe SOLO a través de mdj_auditar(), que es SECURITY DEFINER.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 9 · B intenta VACIAR el historial — DEBE FALLAR
-- ═══════════════════════════════════════════════════════════════════════════
--   Antes del 2026-08-17 esto FUNCIONABA: TRUNCATE no pasa por RLS ni dispara
--   triggers de fila, y los privilegios por defecto se lo concedían.
BEGIN;
  SELECT set_config('request.jwt.claims',
           json_build_object(
             'sub',  (SELECT user_id FROM public.dj_profiles
                       ORDER BY profile_id OFFSET 1 LIMIT 1),
             'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  TRUNCATE public.audit_log;
COMMIT;

-- ESPERADO: ERROR «permission denied» o «audit_log es de solo escritura:
--           no se permite TRUNCATE». Cualquiera de los dos vale.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 10 · Un visitante SIN SESIÓN — DEBE FALLAR
-- ═══════════════════════════════════════════════════════════════════════════
--   El caso peor: alguien sin cuenta. Antes del REVOKE, `anon` figuraba con
--   DELETE, INSERT, UPDATE y TRUNCATE sobre las dos tablas.
BEGIN;
  SET LOCAL ROLE anon;
  SELECT count(*) AS lo_que_ve_un_visitante FROM public.audit_log;
COMMIT;

-- ESPERADO: ERROR «permission denied for table audit_log»
-- Un visitante sin sesión no debe poder ni contar cuántos eventos hay.
