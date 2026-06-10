-- MDJPRO downloads catalog — owner/staff_management editable via platform_settings.
-- Public read (existing policy). Writes limited to mdjpro_* keys.

DROP POLICY IF EXISTS "Staff management can write mdjpro settings" ON platform_settings;

CREATE POLICY "Staff management can write mdjpro settings"
  ON platform_settings
  FOR ALL
  TO authenticated
  USING (
    key LIKE 'mdjpro_%'
    AND public.is_staff_management(auth.uid())
  )
  WITH CHECK (
    key LIKE 'mdjpro_%'
    AND public.is_staff_management(auth.uid())
  );

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'mdjpro_downloads_catalog',
  $json${
    "version": "V.2.1.0",
    "released": "2026-06-09",
    "platform": "mac",
    "releaseNotes": {
      "title": {
        "es": "NOVEDADES EN MDJPRO V.2.1.0",
        "en": "WHAT'S NEW IN MDJPRO V.2.1.0"
      },
      "items": {
        "es": [
          "Caso A: descarga Pro con handoff activa MDJPRO al abrir la app (sin pegar clave de licencia).",
          "Enlaces de marca Miami DJ Beat: web, soporte y checkout en miamidjbeat.com.",
          "Settings About: pie institucional Miami DJ Beat LLC, teléfono y correo oficiales.",
          "Créditos de versión V.2.1.0 visibles en Settings → About de la app.",
          "Moroso/cancelación Artist PRO: heartbeat y Stripe bloquean licencia suspendida.",
          "Arranque silencioso sin ventanas Keychain y reintento de handoff en el splash."
        ],
        "en": [
          "Caso A: Pro download handoff auto-activates MDJPRO on first launch (no license key paste).",
          "Miami DJ Beat brand links: website, support email, and checkout wired to miamidjbeat.com.",
          "Settings About footer: Miami DJ Beat LLC, official phone and support email.",
          "V.2.1.0 release credits shown in the app under Settings → About.",
          "Subscription lapse: heartbeat and Stripe gate block suspended Artist PRO licenses.",
          "Silent Keychain launch and install handoff retry on splash."
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
