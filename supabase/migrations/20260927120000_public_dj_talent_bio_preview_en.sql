-- ═════════════════════════════════════════════════════════════════
-- Entorno: FUENTE ÚNICA — se aplica PRIMERO a PRUEBA (rtbsovavmtnjpbbpwsin) y DESPUÉS a PRODUCCIÓN (hkuvuqupbxwkiykxvqdr),
--          en ese orden, por quien corre migraciones. Mismo script, una vez por proyecto.
--
-- ESTADO (2026-09-27): APLICADA EN PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) por orden expresa del PO, con `apply_migration` (nombre: public_dj_talent_bio_preview_en).
--   PRUEBA (rtbsovavmtnjpbbpwsin) NO la recibió: ese proyecto está muy atrasado (sin public_dj_talent ni las columnas bio_en/bio_short/seo_publish_status);
--   se validó el SELECT con datos de mentira en solo lectura y la vista real de producción coincidía en las 10 columnas previas.
--
-- Qué hace: agrega UNA columna al final de public.public_dj_talent — `bio_preview_en` (recorte de 160 caracteres de
-- dj_profiles.bio_en) — para que find-dj.html pueda mostrar la vista previa de la biografía en inglés cuando el sitio está en EN
-- (sistema bilingüe, ticket 2026-09-27). Hoy la vista solo trae `bio_preview` (español) y las tarjetas salen en español en modo EN.
--
-- Por qué es segura:
--   · CREATE OR REPLACE VIEW: solo AÑADE una columna AL FINAL; las existentes no cambian de nombre, tipo ni orden (Postgres lo
--     exige y falla ruidosamente si no se cumple). No hay DROP ... CASCADE, así que ninguna dependencia ni GRANT se pierde.
--   · Mismo filtro de fila (falla cerrada: seo_publish_status='approved' + slug + nombre + foto + bio + rol DJ, sin Staff).
--   · La bio en inglés YA es pública (se muestra completa en /dj/<slug>.html y en el perfil); el recorte de 160 caracteres es
--     el mismo criterio que bio_preview. Sin datos privados nuevos.
--   · Los GRANT SELECT / REVOKE de escritura se repiten por si el entorno los hubiera perdido (idempotente).
--   · Sin esta migración el frontend sigue funcionando: si la columna no llega, la tarjeta muestra la vista previa en español.
--
-- Reversa: volver a aplicar la definición de 20260913110000_public_dj_talent_view.sql sin la columna (requiere DROP VIEW, ese
-- script ya lo hace) — solo si hiciera falta; dejar la columna no rompe nada.
-- ═════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.public_dj_talent') IS NULL THEN
    RAISE EXCEPTION 'public.public_dj_talent no existe: aplicar primero 20260913110000_public_dj_talent_view.sql';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = 'bio_en'
  ) THEN
    RAISE EXCEPTION 'dj_profiles.bio_en no existe: aplicar primero 20260412140000_dj_profiles_bio_columns_and_update_rls.sql';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.public_dj_talent
WITH (security_invoker = false)
AS
SELECT
  t.user_id,
  t.dj_slug,
  t.stage_name,
  t.photo_url,
  t.city,
  t.roles,
  t.artist_specialty,
  t.plan,
  t.is_premium,
  t.bio_preview,
  t.bio_preview_en          -- NUEVA (al final)
FROM (
  SELECT
    p.user_id,
    lower(regexp_replace(trim(COALESCE(
      NULLIF(p.username, ''), NULLIF(p.stage_name, ''), NULLIF(p.dj_name, ''), ''
    )), '[^a-zA-Z0-9]+', '-', 'g')) AS dj_slug,
    p.stage_name,
    p.photo_url,
    p.city,
    p.roles,
    p.artist_specialty,
    p.plan,
    p.is_premium,
    p.bio,
    p.bio_short,
    p.seo_publish_status,
    left(coalesce(nullif(p.bio_short, ''), nullif(p.bio, '')), 160) AS bio_preview,
    left(nullif(p.bio_en, ''), 160) AS bio_preview_en
  FROM public.dj_profiles p
) t
WHERE t.seo_publish_status = 'approved'
  AND t.dj_slug IS NOT NULL AND t.dj_slug <> '' AND t.dj_slug <> 'owner'
  AND t.stage_name IS NOT NULL AND t.stage_name <> ''
  AND t.photo_url IS NOT NULL AND t.photo_url <> ''
  AND coalesce(nullif(t.bio, ''), nullif(t.bio_short, '')) IS NOT NULL
  AND (coalesce(t.artist_specialty, '') || ' ' || coalesce(t.roles, '')) ~* '\mdj\M'
  AND coalesce(t.artist_specialty, '') !~* '\mstaff\M';

GRANT SELECT ON public.public_dj_talent TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.public_dj_talent FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
