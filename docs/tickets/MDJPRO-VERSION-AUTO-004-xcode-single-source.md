# MDJPRO-VERSION-AUTO-004 — Xcode single source + release scripts

**Status:** CONFIRMED IN PROD LOCAL (2026-06-09) — V.2.1.0 pkg + active links  
**Priority:** Critical  
**Approved by:** Captain (`APROBADO`)  
**Agent runbook:** `.cursor/skills/mdjpro-release/SKILL.md`

---

## Product policy (version bumps)

| Command | When | Example |
|---------|------|---------|
| `official` | New official line (always `.0.0`) | `2.0.0` → `3.0.0` |
| `functional` | New feature / behavior (days of work) | `2.0.0` → `2.1.0`, `2.1.0` → `2.2.0` |
| `cosmetic` | Icon, drawing, label only — same function | `2.2.0` → `2.2.1` |

---

## Single source of truth

1. **`MARKETING_VERSION`** in `MDJ.xcodeproj/project.pbxproj` (Xcode → Target → General → Version)
2. Mirror file **`MDJ/VERSION`** (same `x.y.z`, validated on build)
3. **`AppConfig.version`** reads `CFBundleShortVersionString` at runtime → `V.x.y.z`

All UI (Welcome, Settings, About, hub) uses `AppConfig.version` — one bump updates everything after rebuild.

---

## Scripts (`~/Desktop/MDJ/scripts/`)

```bash
# Show current
./scripts/mdj-bump-version.sh   # usage if no arg

# Bump only
./scripts/mdj-bump-version.sh functional
./scripts/mdj-bump-version.sh cosmetic
./scripts/mdj-bump-version.sh official

# Bump + Release build + .pkg + downloads.json sync
./scripts/mdj-release.sh cosmetic
./scripts/mdj-release.sh functional
./scripts/mdj-release.sh          # no bump, build current version + sync web

# Fast path — Xcode ⌘B already succeeded
./scripts/mdj-pkg-only.sh
# or double-click ~/Desktop/MDJ-SOLO-EMPACOTAR.command
```

Output: `web/installers/MDJPRO V.x.y.z.pkg` + `MDJPRO_Installer.pkg` + `~/Desktop/MDJPRO V.x.y.z.pkg`

Install (app quit first): double-click Desktop `.pkg` or:

```bash
sudo installer -pkg "$HOME/Desktop/MDJPRO V.2.1.0.pkg" -target /
```

## Confirmed release chain (Captain 2026-06-09)

1. Edit in **Xcode** `~/Desktop/MDJ` (not web-only).
2. **⌘B** → Build Succeeded.
3. **`MDJ-SOLO-EMPACOTAR.command`** or `mdj-pkg-only.sh` / `mdj-release.sh`.
4. Verify About links + version in installed app.
5. `localhost:8080/downloads.html` reads `web/installers/`.
6. Supabase `installers/MDJPRO_Installer.pkg` when deploy approved.

---

## Xcode integration

Run Script phase **Verify MDJPRO Version** calls `scripts/xcode/verify-marketing-version.sh` on every build.

---

## Never do again

- Hardcode `AppConfig.version = "V.…"`
- Add release data in a new `.swift` file without Xcode target membership (use `AppConfig.swift` / `ReleaseNotes` enum there)
- Rename `.pkg` manually without `mdj-release.sh` / `mdj-pkg-only.sh`
- Install while MDJ PRO is running (Cmd+Q first)
- Ship web `downloads.json` changes without rebuilding `.pkg` from Xcode
