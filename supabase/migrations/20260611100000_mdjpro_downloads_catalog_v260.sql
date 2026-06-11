-- MDJPRO downloads catalog → V.2.6.0 (post-incident ship line; supersedes V.2.5.0 catalog)
-- Public read via platform_settings; overrides web/data/downloads.json when present.

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'mdjpro_downloads_catalog',
  $json${
    "version": "V.2.6.0",
    "released": "2026-06-10",
    "platform": "mac",
    "releaseNotes": {
      "title": {
        "es": "NOVEDADES EN MDJPRO V.2.6.0",
        "en": "WHAT'S NEW IN MDJPRO V.2.6.0"
      },
      "items": {
        "es": [
          "Línea V.2.6.0 post-incidente: baseline auditado tras el incidente del taller 2026-06-10 (reemplaza linaje V.2.5.0 comprometido).",
          "Arranque canónico: Splash → Hub — sin pantalla Connect Your Music Library al abrir.",
          "Cableado de licencia completo: handoff Caso A, activate/heartbeat y gate de suspensión por morosidad (Supabase + descargas web).",
          "Commit ancla git en taller Mac antes de aprobación push/ship.",
          "Se conservan fixes técnicos V.2.5.0: Xcode 16 / Swift 6, ciclo TagMasterView, target ManualView."
        ],
        "en": [
          "V.2.6.0 post-incident ship line: audited baseline after the 2026-06-10 workshop incident (replaces compromised V.2.5.0 lineage).",
          "Canonical launch: Splash → Hub — no Connect Your Music Library screen at startup.",
          "License wiring complete: Caso A handoff, activate/heartbeat, and subscription suspend gate (Supabase + web downloads).",
          "Git anchor commit on Mac workshop before push/ship approval.",
          "All V.2.5.0 technical fixes retained: Xcode 16 / Swift 6, TagMasterView lifecycle, ManualView target."
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
