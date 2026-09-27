-- ═══════════════════════════════════════════════════════════════════════════
-- FORMALIZADA 2026-09-27 (orden del PO: "formaliza las otras dos migraciones") — RESCATADA del worktree
-- abandonado `dj-profile-engine-hardening` (rama fix/dj-profile-engine-hardening, sin comitear desde el
-- 13 de septiembre). Verificado el 2026-09-27 contra PRODUCCIÓN: la columna `beatport_url` YA EXISTE en
-- `dj_profiles` — alguien la aplicó a mano en algún momento, sin que este archivo llegara nunca a git.
-- Este archivo solo cierra la brecha entre lo que dice el repositorio y lo que ya hizo la base: es
-- un no-op seguro (`ADD COLUMN IF NOT EXISTS`) que documenta lo que ya es verdad en PROD.
--
-- Texto original del worktree, sin cambios de fondo:
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ticket: enlazar el perfil de Beatport de DJMago305 (junto a SoundCloud,
-- Apple Music y Spotify, que ya tenían columna) en su ficha pública
-- (web/dj/djmago305.html, generada por tools/dj-profiles/build.mjs) y en su
-- Perfil de Negocio de Google.
--
-- Columna: 'beatport_url' text, nullable, sin default — mismo patrón exacto
-- que 'soundcloud_url' / 'spotify_url' / 'apple_music_url' ya existentes.
--
-- NO incluye: backfill de datos, ningún cambio de RLS, ninguna otra tabla,
-- ningún RPC.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.dj_profiles') IS NULL THEN
    RAISE EXCEPTION 'public.dj_profiles does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = 'beatport_url'
  ) THEN
    ALTER TABLE public.dj_profiles ADD COLUMN beatport_url text;
  END IF;
END $$;

COMMENT ON COLUMN public.dj_profiles.beatport_url IS
  'URL del perfil de artista en Beatport (https://www.beatport.com/artist/<slug>/<id>). Mismo patrón que soundcloud_url/spotify_url/apple_music_url: nullable, sin CHECK, gestionada por el propio DJ.';

NOTIFY pgrst, 'reload schema';
