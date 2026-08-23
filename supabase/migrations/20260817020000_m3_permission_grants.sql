-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENTORNO: PRUEBA  (mdjb-ensayo / Supabase local)                          ║
-- ║  NO APLICAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- M3 · permission_grants — Constitución Maestra, Fase 4 (§15, §16, §17, §23)
--     Base de la Authority Matrix.
--
-- LA DECISIÓN DE DISEÑO QUE MANDA AQUÍ
--   El §16 dice, literal: «No asumir que permitir lectura equivale a permiso de
--   ejecución». Eso prohíbe inferir HACIA ARRIBA. Por tanto los tres niveles NO
--   son un interruptor con grados: son concesiones explícitas.
--     · consultar — leer y producir inteligencia. Nada más.
--     · preparar  — crear borradores que ESPERAN aprobación humana.
--     · ejecutar  — actuar solo dentro de límites definidos.
--   Se implementa un rango donde una concesión satisface peticiones de nivel
--   IGUAL O INFERIOR (quien puede ejecutar, evidentemente puede leer), pero jamás
--   al revés. Conceder lectura no habilita nada más, que es exactamente lo que el
--   PO exige.
--
-- REVOCAR NO ES BORRAR
--   El §23 pide historial de permisos: concedido, fecha, método, alcance,
--   revocado, fecha de revocación. Si revocar borrara la fila, ese historial no
--   existiría. Aquí revocar es sellar la concesión con fecha; la fila permanece.
--
-- POR QUÉ DESPUÉS DE M1 Y M2
--   Cada concesión se ata al FENIX-ID (M1) — sin él, cambiar un correo dejaría
--   permisos huérfanos. Y cada concesión y cada revocación se registran en
--   audit_log (M2) automáticamente: un permiso sin rastro es un permiso que nadie
--   puede auditar después.
--
-- QUÉ NO HACE
--   · No sustituye a RLS. Esto es el REGISTRO de lo concedido; la función can()
--     y su aplicación en las políticas son M7 y M8.
--   · No toca ninguna tabla existente. Additiva y reversible.

BEGIN;

-- ── 1 · Vocabulario cerrado ────────────────────────────────────────────────
--   Enum y no texto libre: el rol como texto libre es uno de los riesgos que el
--   informe forense señaló, y no se repite aquí.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mdj_nivel_autoridad') THEN
    CREATE TYPE public.mdj_nivel_autoridad AS ENUM ('consultar','preparar','ejecutar');
  END IF;
END $$;

-- Rango numérico para comparar. Aparte del enum para poder cambiarlo sin migrar
-- el tipo. IMMUTABLE: la misma entrada da siempre lo mismo.
CREATE OR REPLACE FUNCTION public.mdj_rango_nivel(n public.mdj_nivel_autoridad)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE n WHEN 'consultar' THEN 1 WHEN 'preparar' THEN 2 WHEN 'ejecutar' THEN 3 END;
$$;

-- ── 2 · La tabla de concesiones ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permission_grants (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- QUIÉN CONCEDE — siempre el dueño de los datos (§1: «los datos pertenecen al
  -- dueño del perfil»). Es FENIX-ID, no user_id: los permisos sobreviven a
  -- cambios de correo y de sesión.
  otorgante_profile_id text NOT NULL,

  -- A QUIÉN — un agente del sistema o un perfil humano (delegación, §24)
  beneficiario_tipo   text NOT NULL
                      CHECK (beneficiario_tipo IN ('fenix','elixis','perfil','app')),
  beneficiario_ref    text,      -- FENIX-ID del manager, o id de la app externa

  -- QUÉ — alcance específico, nunca un permiso global (§31: «todo permiso debe
  -- ser específico, trazable y revocable»)
  alcance             text NOT NULL,   -- 'calendario.disponibilidad', 'contactos.analizar'…

  -- HASTA DÓNDE
  nivel               public.mdj_nivel_autoridad NOT NULL,

  -- LÍMITES del §16 nivel 3: «dentro de límites definidos»
  limites             jsonb,           -- {"max_diario":5,"horario":"09:00-18:00"}

  -- CÓMO SE CONCEDIÓ — §23 pide el método
  concedido_en        timestamptz NOT NULL DEFAULT now(),
  concedido_metodo    text,            -- 'ui' | '2fa_sms' | 'email_code'
  concedido_por_uid   uuid,
  expira_en           timestamptz,     -- NULL = sin caducidad

  -- REVOCACIÓN — sella, no borra
  revocado_en         timestamptz,
  revocado_por_uid    uuid,
  revocado_motivo     text,

  CONSTRAINT ck_beneficiario_coherente CHECK (
    (beneficiario_tipo IN ('perfil','app') AND beneficiario_ref IS NOT NULL)
    OR beneficiario_tipo IN ('fenix','elixis')
  )
);

COMMENT ON TABLE  public.permission_grants IS
  'M3 · Registro de permisos concedidos. Revocar sella con fecha, nunca borra (§23).';
COMMENT ON COLUMN public.permission_grants.nivel IS
  'consultar | preparar | ejecutar. Conceder lectura NO habilita ejecución (§16).';
COMMENT ON COLUMN public.permission_grants.limites IS
  'Límites del nivel ejecutar: cupos, horarios, destinatarios permitidos (§16 nivel 3).';

CREATE INDEX IF NOT EXISTS ix_grants_otorgante
  ON public.permission_grants (otorgante_profile_id, alcance);
CREATE INDEX IF NOT EXISTS ix_grants_vigentes
  ON public.permission_grants (otorgante_profile_id, alcance, nivel)
  WHERE revocado_en IS NULL;

-- Una sola concesión VIGENTE por combinación. Evita el permiso duplicado que
-- luego nadie sabe cuál manda. El histórico revocado sí puede repetirse.
CREATE UNIQUE INDEX IF NOT EXISTS ux_grants_vigente_unico
  ON public.permission_grants (otorgante_profile_id, beneficiario_tipo,
                               COALESCE(beneficiario_ref,''), alcance)
  WHERE revocado_en IS NULL;

-- ── 3 · Inmutabilidad parcial ───────────────────────────────────────────────
--   Lo concedido no se reescribe: si cambia el alcance o el nivel, es OTRA
--   concesión. Solo pueden escribirse los campos de revocación, y una sola vez.
--   Sin esto, alguien podría convertir un permiso de lectura en uno de ejecución
--   editando una fila, sin dejar rastro de que hubo un cambio de autoridad.
CREATE OR REPLACE FUNCTION public.mdj_grant_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.otorgante_profile_id IS DISTINCT FROM OLD.otorgante_profile_id
     OR NEW.beneficiario_tipo IS DISTINCT FROM OLD.beneficiario_tipo
     OR NEW.beneficiario_ref  IS DISTINCT FROM OLD.beneficiario_ref
     OR NEW.alcance           IS DISTINCT FROM OLD.alcance
     OR NEW.nivel             IS DISTINCT FROM OLD.nivel
     OR NEW.concedido_en      IS DISTINCT FROM OLD.concedido_en THEN
    RAISE EXCEPTION 'Una concesión no se reescribe: revoca y concede otra'
      USING ERRCODE = 'restrict_violation',
            HINT = 'Cambiar alcance o nivel editando la fila borraría el rastro del cambio de autoridad (§23).';
  END IF;

  IF OLD.revocado_en IS NOT NULL AND NEW.revocado_en IS DISTINCT FROM OLD.revocado_en THEN
    RAISE EXCEPTION 'La revocación es definitiva: no puede alterarse ni deshacerse'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grants_inmutable ON public.permission_grants;
CREATE TRIGGER trg_grants_inmutable
  BEFORE UPDATE ON public.permission_grants
  FOR EACH ROW EXECUTE FUNCTION public.mdj_grant_inmutable();

-- Borrar tampoco: destruiría el historial que pide el §23.
CREATE OR REPLACE FUNCTION public.mdj_grant_no_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los permisos no se borran: se revocan (§23)'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_grants_no_delete ON public.permission_grants;
CREATE TRIGGER trg_grants_no_delete
  BEFORE DELETE ON public.permission_grants
  FOR EACH ROW EXECUTE FUNCTION public.mdj_grant_no_delete();

-- Vaciar la tabla entera equivale a borrarla fila a fila, y TRUNCATE no pasa
-- ni por RLS ni por los disparadores de fila. Mismo agujero que se encontró
-- en audit_log el 2026-08-17; se tapa igual, en las dos capas.
CREATE OR REPLACE FUNCTION public.mdj_grant_no_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los permisos no se vacían: se revocan (§23)'
    USING ERRCODE = 'restrict_violation',
          HINT    = 'Un TRUNCATE aquí borraría la prueba de quién concedió qué.';
END;
$$;

DROP TRIGGER IF EXISTS trg_grants_no_truncate ON public.permission_grants;
CREATE TRIGGER trg_grants_no_truncate
  BEFORE TRUNCATE ON public.permission_grants
  FOR EACH STATEMENT EXECUTE FUNCTION public.mdj_grant_no_truncate();

-- ── 3b · Privilegios explícitos ────────────────────────────────────────────
--   `anon` no tiene sesión: no puede ni ver quién concedió qué a quién.
REVOKE ALL ON public.permission_grants FROM anon;

--   `authenticated` concede (INSERT), revoca (UPDATE) y consulta (SELECT).
--   El RLS decide sobre QUÉ filas. Nunca borra ni vacía.
REVOKE ALL ON public.permission_grants FROM authenticated;
GRANT  SELECT, INSERT, UPDATE ON public.permission_grants TO authenticated;

--   `service_role` salta el RLS; que no pueda destruir el rastro.
REVOKE DELETE, TRUNCATE ON public.permission_grants FROM service_role;

-- ── 4 · Rastro automático en audit_log (M2) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.mdj_grant_auditar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_accion text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_accion := 'permiso.concedido';
  ELSIF NEW.revocado_en IS NOT NULL AND OLD.revocado_en IS NULL THEN
    v_accion := 'permiso.revocado';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.mdj_auditar(
    p_accion             => v_accion,
    p_recurso_tabla      => 'permission_grants',
    p_recurso_id         => NEW.id::text,
    p_recurso_profile_id => NEW.otorgante_profile_id,
    -- Claves con prefijo `permiso_` y no palabras sueltas como `ref` o `motivo`:
    -- la censura de M2 filtra por nombre exacto, y meter términos genéricos en
    -- su lista de permitidos abriría por accidente cualquier columna futura que
    -- se llamara igual. Estos seis nombres existen solo aquí.
    p_despues            => jsonb_build_object(
                              'permiso_beneficiario', NEW.beneficiario_tipo,
                              'permiso_ref',          NEW.beneficiario_ref,
                              'permiso_alcance',      NEW.alcance,
                              'permiso_nivel',        NEW.nivel::text,
                              'permiso_limites',      NEW.limites,
                              'permiso_motivo',       NEW.revocado_motivo),
    p_metodo_verificacion => NEW.concedido_metodo,
    p_origen              => 'sistema'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grants_auditar_ins ON public.permission_grants;
CREATE TRIGGER trg_grants_auditar_ins
  AFTER INSERT ON public.permission_grants
  FOR EACH ROW EXECUTE FUNCTION public.mdj_grant_auditar();

DROP TRIGGER IF EXISTS trg_grants_auditar_upd ON public.permission_grants;
CREATE TRIGGER trg_grants_auditar_upd
  AFTER UPDATE ON public.permission_grants
  FOR EACH ROW EXECUTE FUNCTION public.mdj_grant_auditar();

-- ── 5 · La consulta que usará can() en M7 ──────────────────────────────────
--   Devuelve TRUE solo si existe una concesión vigente, no caducada, de nivel
--   igual o superior al pedido. Nunca infiere hacia arriba.
CREATE OR REPLACE FUNCTION public.mdj_permiso_vigente(
  p_otorgante  text,
  p_tipo       text,
  p_ref        text,
  p_alcance    text,
  p_nivel      public.mdj_nivel_autoridad
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permission_grants g
     WHERE g.otorgante_profile_id = p_otorgante
       AND g.beneficiario_tipo    = p_tipo
       AND COALESCE(g.beneficiario_ref,'') = COALESCE(p_ref,'')
       AND g.alcance              = p_alcance
       AND g.revocado_en IS NULL
       AND (g.expira_en IS NULL OR g.expira_en > now())
       AND public.mdj_rango_nivel(g.nivel) >= public.mdj_rango_nivel(p_nivel)
  );
$$;

-- ── 6 · RLS: los permisos son del dueño de los datos ───────────────────────
ALTER TABLE public.permission_grants ENABLE ROW LEVEL SECURITY;

--   Las tres políticas preguntan «¿qué perfiles son míos?» a
--   public.mdj_perfiles_de_usuario() (definida en M2), que es SECURITY DEFINER.
--   NO se consulta `dj_profiles` en línea: esa subconsulta se ejecutaría con el
--   rol del llamante y quedaría sujeta al RLS de la tabla de perfiles. El
--   2026-08-17, con `dj_profiles` en RLS y cero políticas, eso convirtió estas
--   tres políticas en denegar-a-todos sin que ninguna prueba lo delatara: el
--   beneficiario veía 0 filas, que era lo esperado, y el dueño también.
DROP POLICY IF EXISTS "grants: el dueño ve los suyos" ON public.permission_grants;
CREATE POLICY "grants: el dueño ve los suyos"
  ON public.permission_grants FOR SELECT
  USING (otorgante_profile_id IN (SELECT public.mdj_perfiles_de_usuario(auth.uid())));

DROP POLICY IF EXISTS "grants: solo el dueño concede" ON public.permission_grants;
CREATE POLICY "grants: solo el dueño concede"
  ON public.permission_grants FOR INSERT
  WITH CHECK (otorgante_profile_id IN (SELECT public.mdj_perfiles_de_usuario(auth.uid())));

DROP POLICY IF EXISTS "grants: solo el dueño revoca" ON public.permission_grants;
CREATE POLICY "grants: solo el dueño revoca"
  ON public.permission_grants FOR UPDATE
  USING (otorgante_profile_id IN (SELECT public.mdj_perfiles_de_usuario(auth.uid())));

-- Sin política de DELETE: denegado para todos, además del trigger.

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN — ejecutar DESPUÉS, como consultas independientes          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Ninguna consulta pide sustituir nada a mano: el FENIX-ID se toma con una
-- subconsulta. Un placeholder mal pegado es una fuente de errores que no
-- aporta nada a la prueba.
--
-- V1 · Conceder lectura de calendario a FÉNIX
--   INSERT INTO public.permission_grants
--     (otorgante_profile_id, beneficiario_tipo, alcance, nivel, concedido_metodo)
--   SELECT profile_id, 'fenix', 'calendario.disponibilidad', 'consultar', 'ui'
--     FROM public.dj_profiles ORDER BY profile_id LIMIT 1;
--   -- ESPERADO: 1 fila.
--
-- V2 · LA PRUEBA QUE DEFINE EL §16 — leer NO habilita ejecutar
--   SELECT public.mdj_permiso_vigente(p,'fenix',NULL,'calendario.disponibilidad','consultar') AS puede_leer,
--          public.mdj_permiso_vigente(p,'fenix',NULL,'calendario.disponibilidad','preparar')  AS puede_preparar,
--          public.mdj_permiso_vigente(p,'fenix',NULL,'calendario.disponibilidad','ejecutar')  AS puede_ejecutar
--     FROM (SELECT profile_id AS p FROM public.dj_profiles
--            ORDER BY profile_id LIMIT 1) t;
--   -- ESPERADO: true, false, false.
--   -- Si puede_preparar o puede_ejecutar salen true, la Authority Matrix está
--   -- rota y M3 NO puede darse por válida.
--
-- V3 · El rastro llegó a audit_log (M2) y es LEGIBLE
--   SELECT accion, recurso_profile_id,
--          despues->>'permiso_alcance' AS alcance,
--          despues->>'permiso_nivel'   AS nivel
--     FROM public.audit_log WHERE accion = 'permiso.concedido'
--    ORDER BY id DESC LIMIT 1;
--   -- ESPERADO: alcance 'calendario.disponibilidad', nivel 'consultar'.
--   -- Si sale '[no registrado]', las claves permiso_* no están en la lista de
--   -- permitidos de M2 y hay que reaplicar M2 antes de seguir.
--
-- V4 · No se puede escalar editando (debe FALLAR)
--   UPDATE public.permission_grants SET nivel = 'ejecutar'
--    WHERE alcance = 'calendario.disponibilidad' AND revocado_en IS NULL;
--   -- ESPERADO: ERROR 'Una concesión no se reescribe'.
--
-- V5 · No se puede borrar el historial (debe FALLAR)
--   DELETE FROM public.permission_grants WHERE alcance = 'calendario.disponibilidad';
--   -- ESPERADO: ERROR 'Los permisos no se borran: se revocan'.
--
-- V6 · Revocar funciona y deja rastro
--   UPDATE public.permission_grants
--      SET revocado_en = now(), revocado_motivo = 'prueba M3'
--    WHERE alcance = 'calendario.disponibilidad' AND revocado_en IS NULL;
--   SELECT public.mdj_permiso_vigente(p,'fenix',NULL,'calendario.disponibilidad','consultar')
--     FROM (SELECT profile_id AS p FROM public.dj_profiles
--            ORDER BY profile_id LIMIT 1) t;
--   -- ESPERADO: false — revocado deja de conceder de inmediato.
--   SELECT count(*) FROM public.audit_log WHERE accion = 'permiso.revocado';
--   -- ESPERADO: >= 1.
--
-- V7 · La revocación es definitiva (debe FALLAR)
--   UPDATE public.permission_grants SET revocado_en = NULL
--    WHERE alcance = 'calendario.disponibilidad';
--   -- ESPERADO: ERROR 'La revocación es definitiva'.
--
-- V8 · Aislamiento entre perfiles (§1)
--   -- Con sesión de OTRO usuario:
--   SELECT count(*) FROM public.permission_grants WHERE otorgante_profile_id = ':PID';
--   -- ESPERADO: 0. Los permisos de un perfil son invisibles para otro.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  REVERSIÓN COMPLETA                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
--   BEGIN;
--   DROP TRIGGER IF EXISTS trg_grants_auditar_upd ON public.permission_grants;
--   DROP TRIGGER IF EXISTS trg_grants_auditar_ins ON public.permission_grants;
--   DROP TRIGGER IF EXISTS trg_grants_no_delete   ON public.permission_grants;
--   DROP TRIGGER IF EXISTS trg_grants_inmutable   ON public.permission_grants;
--   DROP FUNCTION IF EXISTS public.mdj_permiso_vigente(text,text,text,text,public.mdj_nivel_autoridad);
--   DROP FUNCTION IF EXISTS public.mdj_grant_auditar();
--   DROP FUNCTION IF EXISTS public.mdj_grant_no_delete();
--   DROP FUNCTION IF EXISTS public.mdj_grant_inmutable();
--   DROP TABLE IF EXISTS public.permission_grants;
--   DROP FUNCTION IF EXISTS public.mdj_rango_nivel(public.mdj_nivel_autoridad);
--   DROP TYPE IF EXISTS public.mdj_nivel_autoridad;
--   COMMIT;
--
--   ADVERTENCIA: como en M2, revertir DESTRUYE el historial de permisos. No toca
--   ninguna tabla preexistente. Las entradas ya escritas en audit_log sobreviven:
--   quedará constancia de permisos concedidos sobre una tabla que ya no existe.
