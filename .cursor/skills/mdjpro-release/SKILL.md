---
name: mdjpro-release
description: >-
  MDJPRO Mac release pipeline after Xcode changes. Use when MDJPRO content,
  version, links, About, licensing, or installer .pkg must ship; when user asks
  to empaquetar, build pkg, update downloads, or sync localhost/web installer.
---

# MDJPRO Release Pipeline (agent-owned)

**Confirmed 2026-06-09** by Captain. Agent executes this end-to-end on every MDJPRO change.

## Two repos / paths

| What | Path |
|------|------|
| Xcode app (source of truth for app content) | `~/Desktop/MDJ/` |
| Web descargador + `downloads.json` | `~/Desktop/miami-dj-beat-platform/web/` |

## Mandatory order (never skip)

```
1. Xcode ~/Desktop/MDJ     → edit Swift/UI/config (links, About, credits, license)
2. Xcode ⌘B                → Build Succeeded (fix errors before packaging)
3. Package                 → .pkg to Desktop + web/installers/
4. localhost:8080          → downloads.html serves local .pkg
5. Supabase installers/    → MDJPRO_Installer.pkg (prod; only with APROBADO DEPLOY)
```

**Rule:** Web/catalog changes alone do NOT update the Mac app. The `.pkg` always comes from Xcode build.

## Version single source

1. `MDJ/VERSION` = `x.y.z`
2. `MDJ.xcodeproj` → `MARKETING_VERSION = x.y.z`
3. Runtime: `AppConfig.version` reads bundle → `V.x.y.z`
4. Release credits: `ReleaseNotes` enum inside `AppConfig.swift` (do NOT add orphan `.swift` files outside target)

Bump policy (`~/Desktop/MDJ/scripts/mdj-bump-version.sh`):

| Kind | When |
|------|------|
| `functional` | New behavior (e.g. 2.1.0 → 2.2.0) |
| `cosmetic` | UI-only (e.g. 2.1.0 → 2.1.1) |
| `official` | Major line (e.g. 2.x → 3.0.0) |

## Scripts (run from `~/Desktop/MDJ`)

### Full release (bump optional + compile + sync web + pkg)

```bash
cd ~/Desktop/MDJ
./scripts/mdj-release.sh              # current VERSION
./scripts/mdj-release.sh functional   # bump + build + sync
```

### Fast path — app already built in Xcode (⌘B succeeded)

```bash
cd ~/Desktop/MDJ
./scripts/mdj-pkg-only.sh
```

Or double-click Desktop: **`MDJ-SOLO-EMPACOTAR.command`**

## Outputs (verify after every release)

| File | Location |
|------|----------|
| `MDJPRO V.x.y.z.pkg` | `~/Desktop/` |
| `MDJPRO V.x.y.z.pkg` | `web/installers/` |
| `MDJPRO_Installer.pkg` | `web/installers/` (Supabase canonical name) |
| `downloads.json` | `web/data/` (version + releaseNotes synced by script) |

Delete old `MDJPRO V.*.pkg` on Desktop when new version appears.

## Pre-flight checklist

- [ ] `VERSION` == `MARKETING_VERSION` in pbxproj
- [ ] Brand links in `AppConfig.swift`: `miamidjbeat.com`, `miamidjbeat@gmail.com`, `(305) 607-1780`
- [ ] Xcode **Build Succeeded** (no `Cannot find … in scope`)
- [ ] MDJ PRO quit (Cmd+Q) before installing .pkg

## Post-release QA (Mac)

Settings → About:

- Version `V.x.y.z` matches pkg name
- Release credits visible (ReleaseNotes block)
- Website / support links open Miami DJ Beat URLs

## Post-release QA (web local)

```bash
cd ~/Desktop/miami-dj-beat-platform/web && python3 -m http.server 8080
```

Open `http://localhost:8080/downloads.html` — version label + downloadable .pkg (HEAD on `web/installers/`).

## Common failures (do not repeat)

| Mistake | Fix |
|---------|-----|
| New `.swift` file not in Xcode target | Add to pbxproj Sources or merge into `AppConfig.swift` |
| Old `V.2.0.0.pkg` on Desktop | Run release; script removes stale pkgs |
| Terminal wall of `ModuleCache` text | Normal compile noise, not an error |
| Installed app still old | Install new .pkg over `/Applications/MDJ PRO.app` |
| `web/installers/` empty | Run `mdj-release.sh` or `mdj-pkg-only.sh` |

## Governance

- No `git push` / prod Supabase upload without literal **`APROBADO PUSH`** / **`APROBADO DEPLOY PRODUCCIÓN`**
- Do not edit locked web HTML/nav unless ticket scopes it
- Agent owns running this pipeline after every MDJPRO ticket
