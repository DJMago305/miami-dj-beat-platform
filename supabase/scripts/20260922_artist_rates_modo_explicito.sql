-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- artist_rates: agrega tarifa_modo ('show'|'hora'|'ambas'), el modo de cobro que el
-- artista elige en account-settings.html. Antes se ADIVINABA al recargar según qué
-- campo tenía número; si el artista elegía "Ambas" pero dejaba un campo vacío, al
-- volver a entrar el selector mostraba "Por show" o "Por hora" en vez de "Ambas"
-- (el precio guardado era correcto, solo el botón visual no coincidía con lo elegido).
-- Verificado antes de este script: 0 filas en PROD (tabla creada 2026-09-21, sin uso
-- real todavía) -> no hace falta backfill.

alter table public.artist_rates
  add column if not exists tarifa_modo text check (tarifa_modo in ('show', 'hora', 'ambas'));
