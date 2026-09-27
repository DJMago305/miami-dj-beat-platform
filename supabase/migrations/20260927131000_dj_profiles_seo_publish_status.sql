-- ═══════════════════════════════════════════════════════════════════════════
-- FORMALIZADA 2026-09-27 (orden del PO: "formaliza las otras dos migraciones") — RESCATADA del worktree
-- abandonado `dj-profile-engine-hardening` (rama fix/dj-profile-engine-hardening, sin comitear desde el
-- 13 de septiembre). Verificado el 2026-09-27 contra PRODUCCIÓN:
--   · La columna `seo_publish_status` YA EXISTE en `dj_profiles`, con el CHECK ('pending','approved').
--   · El backfill YA ESTÁ HECHO: exactamente 3 filas en 'approved' (djmago305, djsolitario, djyuyo — las
--     mismas 3 páginas ya en vivo), 8 en 'pending'. `tools/dj-profiles/build.mjs` (isSeoApproved()) ya
--     exige 'approved' en producción hoy — esta compuerta YA es la fuente real de qué DJ tiene página.
-- Ninguna de las dos partes de arriba necesita ejecutarse: este archivo solo cierra la brecha entre el
-- repositorio y lo que la base ya hace, con sentencias `IF NOT EXISTS`/idempotentes, sin efecto real.
--
-- ⚠️ LA RECONSTRUCCIÓN DE LA VISTA `public_dj_profiles` DEL ORIGINAL **NO SE INCLUYE AQUÍ, A PROPÓSITO.**
-- La versión del worktree hace `DROP VIEW ... CASCADE` + `CREATE VIEW` con una lista fija de columnas
-- (`base_cols`) tomada el 13 de septiembre. La vista real de PRODUCCIÓN ya avanzó desde entonces — hoy
-- incluye un JOIN con `mdjb_account_ids` (columna `public_account_id`), y las columnas
-- `soundfortips_live_started_at` y `twitter_url`, ninguna de las cuales conoce la versión de este
-- archivo. Ejecutar esa reconstrucción tal cual BORRARÍA esas tres cosas de la vista pública en vivo.
-- `seo_publish_status` sigue sin aparecer en `public_dj_profiles` (confirmado en producción, 2026-09-27)
-- — hoy eso no rompe nada porque ningún consumidor lee esa columna a través de la vista pública (el
-- generador la lee directo de `dj_profiles` con rol de servicio). Agregarla a la vista es un trabajo
-- aparte: escribir una migración nueva contra la definición REAL y actual de la vista, no contra esta
-- foto vieja. Sin orden de construirla todavía.
--
-- Texto original del worktree (columna, constraint, backfill), sin cambios de fondo:
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) columna ─────────────────────────────────────────────────────────────

ALTER TABLE public.dj_profiles
ADD COLUMN IF NOT EXISTS seo_publish_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dj_profiles'::regclass
      AND conname = 'dj_profiles_seo_publish_status_check'
  ) THEN
    ALTER TABLE public.dj_profiles
    ADD CONSTRAINT dj_profiles_seo_publish_status_check
    CHECK (seo_publish_status IN ('pending', 'approved'));
  END IF;
END $$;

COMMENT ON COLUMN public.dj_profiles.seo_publish_status IS
  'Compuerta editorial de publicación SEO. Solo ''approved'' habilita la generación de web/dj/<slug>.html. Falla cerrada: default ''pending''.';

-- ── 2) backfill — SOLO PRODUCCIÓN, idempotente ─────────────────────────────
--
-- Las 3 páginas ya aprobadas, revisadas y en vivo (web/dj/djmago305.html,
-- djsolitario.html, djyuyo.html) se marcan 'approved' para que la compuerta
-- nueva no las despublique al primer arranque.
--
-- Identificador: dj_profiles.id — la LLAVE PRIMARIA de la tabla —, NO
-- dj_profiles.user_id. Son columnas distintas. Los tres UUID de abajo son
-- valores de `id` de PRODUCCIÓN.
--
-- Idempotente por el `AND seo_publish_status <> 'approved'`.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = 'id'
  ) THEN
    RAISE NOTICE 'dj_profiles.id no existe en este entorno — se omite el backfill.';
    RETURN;
  END IF;

  UPDATE public.dj_profiles
  SET seo_publish_status = 'approved'
  WHERE id IN (
    '6725b05d-2418-4403-9758-2f8d3af0af46',  -- djmago305
    '85b3f2a3-ad73-43f9-9d6f-4c1e3a38857d',  -- djsolitario
    '7067f607-1c8b-4013-8916-6d591e24e935'   -- djyuyo
  )
  AND seo_publish_status <> 'approved';

  RAISE NOTICE 'Backfill seo_publish_status: % fila(s) marcada(s) approved.', (
    SELECT count(*) FROM public.dj_profiles
    WHERE id IN (
      '6725b05d-2418-4403-9758-2f8d3af0af46',
      '85b3f2a3-ad73-43f9-9d6f-4c1e3a38857d',
      '7067f607-1c8b-4013-8916-6d591e24e935'
    ) AND seo_publish_status = 'approved'
  );
END $$;

NOTIFY pgrst, 'reload schema';
