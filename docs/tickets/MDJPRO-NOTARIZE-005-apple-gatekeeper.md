# MDJPRO-NOTARIZE-005 — Apple Gatekeeper (scary install dialog)

**Status:** **DONE** — notarized prod ship **V.2.6.0** (2026-06-11)  
**Priority:** High (production trust) — **closed**

## Closure (2026-06-11)

| Check | Result |
|-------|--------|
| `mdj-notarize-release.sh` | ✓ Developer ID + notarytool + stapler |
| Prod Storage | ✓ `installers/MDJPRO_Installer.pkg` |
| `spctl -a -vv -t install` | ✓ `accepted` · `Notarized Developer ID` |
| Backup Desktop | ✓ `~/Desktop/MDJPRO_V260_NOTARIZED_BACKUP.pkg` |
| SHA256 prod | `5c8d37d364fee67960f46a5110cf21f32385dfe8c608ec9d8efa5bed149e3958` |

**Historical context below** — symptom applied to unsigned builds pre-ship; no longer applies to prod.

## Symptom

User downloads `MDJPRO V.2.1.0.pkg` from miamidjbeat.com → macOS dialog:

> Apple could not verify that MDJPRO V.2.1.0.pkg does not contain malicious software.

**Not malware.** The `.pkg` is built with `CODE_SIGNING_ALLOWED=NO` (unsigned, not notarized).

## Immediate user workaround (until notarized)

1. **Right-click** the `.pkg` → **Open** → **Open** again  
2. Or **System Settings → Privacy & Security → Open Anyway**  
3. Do **not** use "Move to Trash"

Install steps are on `downloads.html` → `#dl-mac-install-help`.

## Permanent fix (required for Serato-like trust)

### Qué cambia para el DJ

| Antes (sin notarizar) | Después (firmado + notarizado) |
|----------------------|--------------------------------|
| Cartel “no se puede verificar” | Doble clic → instalador normal |
| Terminal / clic derecho | Como Serato, sin miedo |

### Requisitos (una vez)

1. **Apple Developer Program** — $99/año — cuenta **Miami DJ Beat LLC**  
   https://developer.apple.com/programs/

2. **Certificados** (Xcode → Settings → Accounts → Manage Certificates):
   - **Developer ID Application** (firma la app)
   - **Developer ID Installer** (firma el `.pkg`)

3. **App-Specific Password** — https://appleid.apple.com → Contraseñas de app  
   Para `notarytool` (enviar a Apple a revisar el `.pkg`)

### Setup en Mac (una vez)

```bash
cd ~/Desktop/MDJ
cp scripts/apple-signing.env.example scripts/apple-signing.env
# Editar apple-signing.env con Team ID y nombres de certificados

./scripts/mdj-apple-setup-notary.sh mdjpro-notary
./scripts/mdj-apple-setup-check.sh
```

En **Xcode** → target MDJ → **Signing & Capabilities**:
- Team: Miami DJ Beat LLC
- Signing Certificate: Developer ID Application

### Cada release V.x.y.z

```bash
cd ~/Desktop/MDJ
./scripts/mdj-notarize-release.sh
```

Eso hace: compilar → firmar app → empaquetar → `productsign` → **notarytool** → **stapler** → copia a `web/installers/`.

Luego **tú**: subir `MDJPRO_Installer.pkg` a Supabase `installers/`.

### Archivos (`~/Desktop/MDJ/scripts/`)

| Script | Uso |
|--------|-----|
| `apple-signing.env` | Team ID + nombres cert (local, no git) |
| `mdj-apple-setup-notary.sh` | Guardar credenciales notarytool |
| `mdj-apple-setup-check.sh` | Verificar que todo está listo |
| `mdj-notarize-release.sh` | Release firmado + notarizado |

~~Until notarized, every public release will show Gatekeeper for first-time installers.~~ **Resolved in prod.**

## QA after notarization — PASS (2026-06-11)

- Fresh Mac / new user account: double-click `.pkg` → installs without scary block ✓  
- `spctl -a -vv -t install MDJPRO_Installer.pkg` → `accepted` + `Notarized Developer ID` ✓  
- Captain confirmed download/install from miamidjbeat.com ✓
