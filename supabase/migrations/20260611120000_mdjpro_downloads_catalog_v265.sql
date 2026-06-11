-- MDJPRO downloads catalog → V.2.6.5 (artist-facing release notes; supersedes V.2.6.0 catalog)
-- Apply only after notarized MDJPRO_Installer.pkg 2.6.5 is uploaded to Storage.

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'mdjpro_downloads_catalog',
  $json${
    "version": "V.2.6.5",
    "released": "2026-06-11",
    "platform": "mac",
    "releaseNotes": {
      "title": {
        "es": "NOVEDADES EN MDJPRO V.2.6.5",
        "en": "WHAT'S NEW IN MDJPRO V.2.6.5"
      },
      "items": {
        "es": [
          "Panel de carpeta LOAD ROOT: títulos y mensajes claros en tu idioma.",
          "Mensaje claro en pantalla si la selección de carpeta no se completa.",
          "Splash y Hub muestran la versión V.2.6.5.",
          "Al terminar la instalación, MDJ PRO se abre automáticamente.",
          "Tu licencia y acceso por suscripción funcionan como antes."
        ],
        "en": [
          "LOAD ROOT folder panel: clear titles and messages in your language.",
          "Clear on-screen feedback if folder selection does not complete.",
          "Splash and Hub display version V.2.6.5.",
          "After install, MDJ PRO opens automatically.",
          "Your license and subscription access work as before."
        ]
      }
    }
  }$json$,
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
