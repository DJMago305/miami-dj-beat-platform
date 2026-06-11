-- MDJPRO downloads catalog → V.2.5.0 (Xcode 16 build recovery release)
-- Public read via platform_settings; overrides web/data/downloads.json when present.

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'mdjpro_downloads_catalog',
  $json${
    "version": "V.2.5.0",
    "released": "2026-06-10",
    "platform": "mac",
    "releaseNotes": {
      "title": {
        "es": "NOVEDADES EN MDJPRO V.2.5.0",
        "en": "WHAT'S NEW IN MDJPRO V.2.5.0"
      },
      "items": {
        "es": [
          "Fix compilación Xcode 16 / Swift 6: ManualView.swift vuelve al target MDJ (ManualContainerView).",
          "Refactor ciclo de vida TagMasterView: corrige timeout del compilador y warnings onChange en macOS 14.",
          "Campos del editor: navegación con flechas sin APIs exclusivas de macOS 14.",
          "Arranque fiable desde Xcode Run (activación de ventana en macOS).",
          "Deployment target macOS 14.0 alineado en proyecto y target de la app.",
          "Se conservan todas las funciones V.2.1.0: handoff Caso A, enlaces de marca, gate de suscripción, instalador notarizado."
        ],
        "en": [
          "Xcode 16 / Swift 6 build fix: ManualView.swift restored to the MDJ compile target (ManualContainerView).",
          "TagMasterView lifecycle refactor: resolves Swift type-check timeout and macOS 14 onChange deprecation warnings.",
          "Editor text fields: arrow-key navigation without macOS 14-only APIs.",
          "Reliable app launch from Xcode Run (window activation on macOS).",
          "macOS deployment target aligned to 14.0 across project and app target.",
          "All V.2.1.0 features retained: Caso A handoff, brand links, subscription gate, notarized installer."
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
