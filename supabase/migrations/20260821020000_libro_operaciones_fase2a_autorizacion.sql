-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo (rtbsovavmtnjpbbpwsin)                    ║
-- ║  NO EJECUTAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  Libro de Operaciones IA · Fase 2A — Concesión Puntual de Lectura        ║
-- ║  Requiere: Fase 1, M3 (permission_grants), M5 (fenix_puede), cimentación ║
-- ║            2A (fenix_can) con la acción libro.leer_propio ya añadida al  ║
-- ║            catálogo (20260821000000_libro_operaciones_accion_canonica). ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- COMPROBAR ANTES DE CORRER — no asumir por notas de otra sesión
--   SELECT to_regprocedure('public.libro_operaciones_autorizar_lectura(text,uuid[],date,date,timestamptz,text)');
--   -- Si NO da null → esta migración YA CORRIÓ. No repetir.
--   SELECT to_regclass('public.libro_operaciones');
--   -- Si da null → falta la Fase 1 antes de esta.
--
-- QUÉ RESUELVE
--   El artista no lee el libro por defecto (Fase 1). Cuando hace falta —
--   probar un incidente, por ejemplo— el gerente o el propietario autorizan
--   caso por caso: un reporte puntual o un rango de fechas, nunca un
--   interruptor general (Constitución, capítulo 2.2).
--
--   Se reutiliza permission_grants (M3) para el rastro de auditoría, quién
--   concede, a quién, y el vencimiento. Pero se verificó leyendo su función
--   mdj_permiso_vigente(): nunca examina la columna `limites`, a pesar de que
--   su propio comentario dice que ahí vive "qué exactamente". Por eso esta
--   migración no repite esa función — la usa a través de fenix_puede(), que
--   es el punto de entrada único (M5), y añade la comprobación de `limites`
--   aparte, en las dos funciones de abajo.
--
-- POR QUÉ TAMBIÉN SE TOCA fenix_can()
--   La Regla 3b de fenix_puede() (el techo) exige que quien concede pueda,
--   por su propio rol, la misma acción que está delegando — si no, cualquiera
--   se concedería a sí mismo algo que nunca tuvo. fenix_can() hoy no sabe
--   evaluar libro.leer_propio en absoluto (ninguna rama del CASE la nombra),
--   así que el techo siempre devolvería false y la concesión nunca
--   funcionaría, aunque el catálogo y la fila en permission_grants estén
--   perfectos. Se redefine fenix_can() (mismo patrón que ya usa: CREATE OR
--   REPLACE, sin tocar el resto del CASE) sumando una rama, igual que
--   staff.read_all: por ROL, no por plan — gerente, administrador o
--   propietario, nunca vendedor.
--
-- QUÉ NO HACE
--   · No construye la interfaz donde el gerente elige el reporte o el rango
--     — eso vive en el módulo de la Fase 2A del lado del cliente.
--   · No decide el vencimiento por defecto más allá de un valor prudente
--     (72 horas): si el Capitán quiere otro, es un parámetro, no una
--     reescritura.
--
-- TAMBIÉN AQUÍ: el aviso legal deja de ser solo una pantalla
--   La Constitución (capítulo 4.1) exige que el aviso se muestre antes del
--   primer reporte de cada artista, y que no se pueda reportar sin haberlo
--   visto. Una pantalla que el cliente podría saltarse no cumple eso — el
--   servidor tiene que exigirlo. Se añade una tabla mínima de aceptación y se
--   redefine libro_operaciones_reportar() (Fase 1) para exigirla la primera
--   vez, sin tocar la migración de la Fase 1 ya comiteada.

BEGIN;

-- ── 0 · Registro de que el aviso legal ya se mostró y se aceptó ────────────
CREATE TABLE IF NOT EXISTS public.libro_operaciones_aviso_aceptado (
  profile_id   text PRIMARY KEY REFERENCES public.dj_profiles (profile_id),
  aceptado_en  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.libro_operaciones_aviso_aceptado IS
  'Libro de Operaciones IA · Fase 2A. Constancia de que el artista ya vio y aceptó la cláusula legal antes de su primer reporte. Una sola fila por artista; no se borra.';

ALTER TABLE public.libro_operaciones_aviso_aceptado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.libro_operaciones_aviso_aceptado FROM anon;
REVOKE ALL ON public.libro_operaciones_aviso_aceptado FROM authenticated;
-- Mismo candado que la tabla principal: sin políticas, sin lectura ni
-- escritura directa. Solo libro_operaciones_reportar() la toca.

-- ── 0b · libro_operaciones_reportar() ahora exige el aviso la primera vez ──
CREATE OR REPLACE FUNCTION public.libro_operaciones_reportar(
  p_tipo_incidente          text,
  p_lugar                   text DEFAULT NULL,
  p_con_quien_se_trabajo    text DEFAULT NULL,
  p_monto_facturado_usd     numeric(10,2) DEFAULT NULL,
  p_clima                   text DEFAULT NULL,
  p_sucesos_extraordinarios text DEFAULT NULL,
  p_relato_libre            text DEFAULT NULL,
  p_acepta_aviso_legal      boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id text;
  v_nombre     text;
  v_nuevo_id   uuid;
BEGIN
  IF p_tipo_incidente IS NULL OR btrim(p_tipo_incidente) = '' THEN
    RAISE EXCEPTION 'libro_operaciones_reportar: tipo_incidente es obligatorio';
  END IF;

  v_profile_id := public.mdj_profile_de_usuario(auth.uid());
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'libro_operaciones_reportar: no se encontró un perfil para esta sesión';
  END IF;

  -- Primera vez: sin aceptación registrada, no hay reporte posible.
  IF NOT EXISTS (
    SELECT 1 FROM public.libro_operaciones_aviso_aceptado WHERE profile_id = v_profile_id
  ) THEN
    IF NOT p_acepta_aviso_legal THEN
      RAISE EXCEPTION 'aviso_legal_pendiente'
        USING HINT = 'Debe mostrarse y aceptarse la cláusula legal antes del primer reporte.';
    END IF;
    INSERT INTO public.libro_operaciones_aviso_aceptado (profile_id) VALUES (v_profile_id);
  END IF;

  SELECT coalesce(nullif(btrim(stage_name), ''), nullif(btrim(dj_name), ''), '(sin nombre)')
    INTO v_nombre
    FROM public.dj_profiles
   WHERE profile_id = v_profile_id;

  INSERT INTO public.libro_operaciones (
    reportado_por_profile_id, nombre_artistico, tipo_incidente, lugar,
    con_quien_se_trabajo, monto_facturado_usd, clima,
    sucesos_extraordinarios, relato_libre
  ) VALUES (
    v_profile_id, v_nombre, btrim(p_tipo_incidente), p_lugar,
    p_con_quien_se_trabajo, p_monto_facturado_usd, p_clima,
    p_sucesos_extraordinarios, p_relato_libre
  )
  RETURNING id INTO v_nuevo_id;

  RETURN v_nuevo_id;
END;
$$;

COMMENT ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text,boolean) IS
  'Libro de Operaciones IA · Fase 1 + 2A. Única puerta de escritura. Exige aceptación registrada de la cláusula legal antes del primer reporte de cada artista — el servidor lo exige, no solo la pantalla.';

REVOKE ALL ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text,boolean)
  TO authenticated;

-- La firma vieja (sin el octavo parámetro, de la Fase 1) queda huérfana:
-- ningún llamador nuevo debe usarla. Se retira para no dejar dos puertas.
DROP FUNCTION IF EXISTS public.libro_operaciones_reportar(text,text,text,numeric,text,text,text);

-- ── 1 · fenix_can() aprende a evaluar libro.leer_propio, por rol ───────────
CREATE OR REPLACE FUNCTION public.fenix_can(
  p_user     uuid,
  p_action   text,
  p_resource text  DEFAULT NULL,
  p_context  jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_plan text;
  v_ent  public.plan_entitlements%rowtype;
BEGIN
  IF p_user IS NULL OR p_action IS NULL THEN RETURN false; END IF;
  SELECT role, lower(coalesce(plan, 'free'))
    INTO v_role, v_plan
    FROM public.dj_profiles WHERE user_id = p_user;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v_ent FROM public.plan_entitlements WHERE plan = v_plan;
  IF NOT FOUND THEN SELECT * INTO v_ent FROM public.plan_entitlements WHERE plan = 'free'; END IF;

  RETURN CASE p_action
    WHEN 'gmail.read'         THEN coalesce(v_ent.gmail_read, false)
    WHEN 'gmail.compose'      THEN coalesce(v_ent.gmail_compose, false)
    WHEN 'gmail.send'         THEN coalesce(v_ent.gmail_send, false)
    WHEN 'calendar.read'      THEN coalesce(v_ent.calendar_read, false)
    WHEN 'calendar.write'     THEN coalesce(v_ent.calendar_write, false)
    WHEN 'campaign.prepare'   THEN coalesce(v_ent.campaign_prepare, false)
    WHEN 'staff.read_all'     THEN v_role IN ('owner','admin','manager','seller')
    WHEN 'financial.read'     THEN v_role IN ('owner','admin','manager')
    WHEN 'financial.execute'  THEN v_role = 'owner'
    WHEN 'profile.bio.update' THEN
      coalesce((p_context->>'target_user')::uuid, p_user) = p_user OR v_role IN ('owner','admin')
    -- Libro de Operaciones IA · Fase 2A: quién puede AUTORIZAR una lectura
    -- puntual del libro. Por rol, igual que staff.read_all — nunca vendedor.
    WHEN 'libro.leer_propio'  THEN v_role IN ('owner','admin','manager')
    ELSE false
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.fenix_can(uuid,text,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.fenix_can(uuid,text,text,jsonb) TO authenticated, service_role;

-- ── 2 · El gerente/propietario concede la ventana puntual ──────────────────
CREATE OR REPLACE FUNCTION public.libro_operaciones_autorizar_lectura(
  p_artista_profile_id text,
  p_reporte_ids        uuid[]        DEFAULT NULL,
  p_desde              date          DEFAULT NULL,
  p_hasta              date          DEFAULT NULL,
  p_vence_en           timestamptz   DEFAULT NULL,   -- default: ahora + 72 horas
  p_motivo             text          DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otorgante text;
  v_vence     timestamptz;
  v_id        bigint;
BEGIN
  IF NOT public.fenix_can(auth.uid(), 'libro.leer_propio') THEN
    RAISE EXCEPTION 'libro_operaciones_autorizar_lectura: solo gerente o propietario pueden autorizar esta lectura';
  END IF;

  IF p_reporte_ids IS NULL AND p_desde IS NULL AND p_hasta IS NULL THEN
    RAISE EXCEPTION 'libro_operaciones_autorizar_lectura: hay que acotar un reporte puntual o un rango de fechas — nunca una autorización sin límite';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dj_profiles WHERE profile_id = p_artista_profile_id) THEN
    RAISE EXCEPTION 'libro_operaciones_autorizar_lectura: no existe ese perfil de artista';
  END IF;

  v_otorgante := public.mdj_profile_de_usuario(auth.uid());
  IF v_otorgante IS NULL THEN
    RAISE EXCEPTION 'libro_operaciones_autorizar_lectura: no se encontró un perfil para esta sesión';
  END IF;

  -- Una ventana puntual siempre vence. Sin vencimiento explícito, 72 horas.
  v_vence := coalesce(p_vence_en, now() + interval '72 hours');

  INSERT INTO public.permission_grants (
    otorgante_profile_id, beneficiario_tipo, beneficiario_ref,
    alcance, nivel, limites, concedido_metodo, concedido_por_uid, expira_en
  ) VALUES (
    v_otorgante, 'perfil', p_artista_profile_id,
    'libro.leer_propio', 'consultar',
    jsonb_strip_nulls(jsonb_build_object(
      'reporte_ids', to_jsonb(p_reporte_ids),
      'desde', p_desde,
      'hasta', p_hasta,
      'motivo', p_motivo
    )),
    'ui', auth.uid(), v_vence
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.libro_operaciones_autorizar_lectura(text,uuid[],date,date,timestamptz,text) IS
  'Libro de Operaciones IA · Fase 2A. Concesión puntual: gerente/propietario autorizan a un artista leer un reporte o rango específico, siempre con vencimiento. Nunca un interruptor general.';

REVOKE ALL ON FUNCTION public.libro_operaciones_autorizar_lectura(text,uuid[],date,date,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.libro_operaciones_autorizar_lectura(text,uuid[],date,date,timestamptz,text)
  TO authenticated;

-- ── 3 · El artista lee, solo lo que la concesión vigente cubre ─────────────
CREATE OR REPLACE FUNCTION public.libro_operaciones_leer_autorizado()
RETURNS SETOF public.libro_operaciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mi_perfil text;
  v_grant     record;
BEGIN
  v_mi_perfil := public.mdj_profile_de_usuario(auth.uid());
  IF v_mi_perfil IS NULL THEN
    RETURN;   -- sin perfil, sin filas — nunca un error que revele algo
  END IF;

  FOR v_grant IN
    SELECT * FROM public.permission_grants
     WHERE beneficiario_tipo = 'perfil'
       AND beneficiario_ref  = v_mi_perfil
       AND alcance           = 'libro.leer_propio'
       AND revocado_en IS NULL
       AND (expira_en IS NULL OR expira_en > now())
  LOOP
    -- El techo real: fenix_puede() vuelve a comprobar que quien otorgó
    -- también puede, por su propio rol, lo que está delegando. Una fila en
    -- permission_grants nunca basta por sí sola.
    IF NOT public.fenix_puede(
             auth.uid(), 'libro.leer_propio', v_grant.otorgante_profile_id, v_grant.nivel
           ) THEN
      CONTINUE;
    END IF;

    RETURN QUERY
    SELECT lo.* FROM public.libro_operaciones lo
     WHERE lo.reportado_por_profile_id = v_mi_perfil
       AND (
             -- Cubierto por una lista explícita de reportes…
             (v_grant.limites ? 'reporte_ids'
              AND lo.id = ANY (
                    SELECT jsonb_array_elements_text(v_grant.limites->'reporte_ids')::uuid
                  ))
             -- …o por un rango de fechas.
          OR (v_grant.limites ? 'desde'
              AND lo.created_at::date >= (v_grant.limites->>'desde')::date
              AND lo.created_at::date <= coalesce((v_grant.limites->>'hasta')::date, current_date))
           );
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.libro_operaciones_leer_autorizado() IS
  'Libro de Operaciones IA · Fase 2A. El artista lee solo lo que una concesión vigente cubre — nunca su historial completo. Sin concesión activa, devuelve cero filas.';

REVOKE ALL ON FUNCTION public.libro_operaciones_leer_autorizado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.libro_operaciones_leer_autorizado() TO authenticated;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V0 · Sin aceptar el aviso, el primer reporte falla; con el segundo intento (aceptando), pasa
--   SELECT public.libro_operaciones_reportar('tipo_de_prueba', 'Venue de prueba');
--   -- ESPERADO: excepción 'aviso_legal_pendiente'.
--   SELECT public.libro_operaciones_reportar('tipo_de_prueba', 'Venue de prueba', p_acepta_aviso_legal => true);
--   -- ESPERADO: devuelve un uuid. Un tercer reporte, sin repetir el parámetro, también pasa
--   -- (la aceptación ya quedó registrada).
--
-- V1 · Sin concesión, el artista no ve nada
--   SELECT * FROM public.libro_operaciones_leer_autorizado();
--   -- ESPERADO: 0 filas (antes de que exista cualquier concesión).
--
-- V2 · Un vendedor no puede autorizar (el techo lo bloquea aunque lo intente)
--   -- sesión con rol 'seller':
--   SELECT public.libro_operaciones_autorizar_lectura('FENIX-XXXXXXXX', ARRAY[]::uuid[], '2026-01-01', '2026-01-31');
--   -- ESPERADO: excepción — 'solo gerente o propietario...'
--
-- V3 · Un gerente autoriza un rango, el artista ve SOLO ese rango
--   -- sesión de gerente:
--   SELECT public.libro_operaciones_autorizar_lectura(
--     (SELECT profile_id FROM public.dj_profiles WHERE profile_id = 'FENIX-XXXXXXXX'),
--     NULL, '2026-08-01', '2026-08-15', NULL, 'prueba de incidente'
--   );
--   -- sesión del artista:
--   SELECT * FROM public.libro_operaciones_leer_autorizado();
--   -- ESPERADO: solo sus reportes con created_at entre el 1 y el 15 de agosto.
--
-- V4 · Pasado el vencimiento, deja de verse
--   -- (esperar a que expira_en quede en el pasado, o forzarlo en prueba)
--   SELECT * FROM public.libro_operaciones_leer_autorizado();
--   -- ESPERADO: 0 filas otra vez.
--
-- ── REVERSIÓN ──
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.libro_operaciones_leer_autorizado();
--   DROP FUNCTION IF EXISTS public.libro_operaciones_autorizar_lectura(text,uuid[],date,date,timestamptz,text);
--   -- fenix_can() vuelve a su versión de Prerrequisito A (sin libro.leer_propio):
--   -- pegar aquí el CREATE OR REPLACE de fenix_authority_2A.sql tal cual estaba.
-- COMMIT;
-- Nota: revertir esto NO borra las filas de permission_grants ya creadas con
-- alcance 'libro.leer_propio' — quedan como historial, simplemente dejan de
-- poder concederse nuevas ni leerse (la función que las consume ya no existe).
