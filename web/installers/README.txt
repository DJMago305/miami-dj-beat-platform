MDJPRO — instalador local (descargador web)
=============================================

Cadena obligatoria (no saltar pasos):

  1. Xcode ~/Desktop/MDJ — corregir app (versión, links, About, créditos).
  2. ./scripts/mdj-release.sh — compila + empaqueta + copia aquí.
  3. localhost:8080/downloads.html — probar descarga.
  4. Supabase Storage bucket «installers» — subir MDJPRO_Installer.pkg (prod).

Versión actual: V.2.6.5

Archivos que debe dejar mdj-release.sh en esta carpeta:

  MDJPRO V.2.6.5.pkg          (nombre con versión)
  MDJPRO_Installer.pkg        (alias canónico para Supabase + fallback web)

Catálogo web: web/data/downloads.json (sincronizado por mdj-release.sh)

Gitignored: *.pkg (no van en git push; deben existir en disco para localhost)

Producción:
  https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/installers/MDJPRO_Installer.pkg
