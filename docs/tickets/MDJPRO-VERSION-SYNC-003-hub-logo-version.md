# MDJPRO-VERSION-SYNC-003 — Hub logo version `V.2.0.0` (three-digit official)

**Status:** IMPLEMENTED — Pending Captain QA (2026-06-09)  
**Priority:** High (cosmetic integrity / version contract)  
**Type:** Cosmetic alignment — hub branding  
**Parent:** MDJPRO-VERSION-SYNC-002 (closed audit with known gap)  
**Opened:** 2026-06-09  
**Opened by:** Captain + audit session (hub shows `V.2.00`, not `V.2.0.0`)

---

## Problem

After SYNC-002, `AppConfig.version`, web `downloads.json`, and the Release `.pkg` all say **`V.2.0.0`**, but the **Command Hub** (main screen with green `M` logo) still shows **`V.2.00`**.

**Root cause (confirmed):** The version string is **rasterized inside** the asset:

`~/Desktop/MDJ/MDJ/Assets.xcassets/mdj_logo 2.imageset/mdj_logo 2.png`

— white box under **MDJPRO** with pixels reading `V.2.00`.  
The hub uses `Image("mdj_logo 2")` only; it does **not** read `AppConfig.version`.

**Secondary issue (install):** `/Applications/MDJ PRO.app` may still run an **older binary** if MDJ PRO was open during `installer` (payload in `MDJPRO V.2.0.0.pkg` is correct; Applications copy must be verified by SHA256 after reinstall).

---

## Why three digits matter (product policy — Captain)

Official MDJPRO releases use **three numeric segments**: `MAJOR.MINOR.PATCH` displayed as **`V.MAJOR.MINOR.PATCH`**.

| Segment | Meaning | Example |
|---------|---------|---------|
| **MAJOR** (`2`) | Product line / milestone | `2.x.x` |
| **MINOR** (`0`, then `1`, …) | Functional change or fix **in progress** — new behavior, workflow, or correction that matters | `2.1.0` = work started on next functional slice |
| **PATCH** (last `0`, then `1`, …) | **Cosmetic-only** change **within the same functional slice** — icon, drawing, label, copy that does not change behavior | `2.0.1` = same `2.0.0` features, only visual/asset tweak |

**Rules:**

- **`2.0.0`** = official baseline release label (all surfaces must show **three** digits, not `2.00` or `2.0`).
- Bump **minor** (`2.0.0` → `2.1.0`) when functional work begins.
- Bump **patch** (`2.0.0` → `2.0.1`) only for cosmetic deltas under the same minor (e.g. logo art refresh with no logic change).
- **`AppConfig.version`** is the single source of truth for visible release strings going forward.

This ticket is **`2.0.0` patch-level cosmetic work**: fix hub label to match the official three-digit string.

---

## Scope

### MODO: PATCH CONTROLADO

### AUTORIZADO (when Captain says OK)

| Area | Files / artifacts |
|------|-------------------|
| Hub logo asset | `MDJ/MDJ/Assets.xcassets/mdj_logo 2.imageset/mdj_logo 2.png` — remove or correct raster `V.2.00` |
| Hub display (preferred) | `MDJ/MDJ/ContentView.swift` — **cosmetic only**: `ZStack` on hub logo with `Text(AppConfig.version)` positioned where the white box is today (no logic changes) |
| Version source | `MDJ/MDJ/AppConfig.swift` — confirm stays `V.2.0.0` |
| Release | Rebuild Release → `pkgbuild` → `MDJPRO V.2.0.0.pkg` (same version string; **new bytes** because asset changed) |
| Storage | Replace Supabase `installers/MDJPRO_Installer.pkg` (or canonical name per SYNC-003 decision) |
| Docs | This ticket + optional one-line in `web/installers/README.txt` |

### PROHIBIDO

- ScanEngine, ScanStore, SeratoCrateEngine
- LicenseManager logic, WelcomeView logic, TagMaster editor logic
- Stripe, SQL, Edge functions, web nav
- Commit / push / deploy without literal `APROBADO PUSH` / `APROBADO DEPLOY PRODUCCIÓN`

---

## Recommended fix (Architect)

**Option A — Preferred (maintainable):**

1. Edit `mdj_logo 2.png`: **remove** the white version box (`V.2.00`) from the PNG; keep **MDJPRO** brand mark only.
2. In `ContentView.swift` hub block (~line 1006), wrap logo in `ZStack` and overlay:

   ```swift
   Text(AppConfig.version)
       .font(.system(size: 11, weight: .semibold, design: .monospaced))
       .foregroundStyle(.white.opacity(0.85))
       .offset(x: 98, y: 118) // tune to match prior white-box position; Pach lock after QA
   ```

3. Future patch bumps = change **`AppConfig.version` only** (e.g. `V.2.0.1`), not re-export PNG.

**Option B — Minimal diff:**

- Photoshop/export: change raster text `V.2.00` → **`V.2.0.0`** in PNG only.  
- **Downside:** every patch release requires PNG re-export (violates maintainability).

**Decision:** Default **Option A** unless Captain requires PNG-only.

---

## QA checklist

1. Quit MDJ PRO completely (`Cmd+Q`).
2. Install: `sudo installer -pkg "…/MDJPRO V.2.0.0.pkg" -target /`
3. Binary SHA256 `/Applications/MDJ PRO.app/Contents/MacOS/MDJ PRO` = SHA256 inside pkg payload.
4. Open app → hub logo shows **`V.2.0.0`** (three digits, not `V.2.00`).
5. Welcome splash, About / manual footer, TagMaster version line still **`V.2.0.0`** via `AppConfig`.
6. `strings` on installed binary includes `V.2.0.0 Enterprise`, not `Rev. 1.9.0 Enterprise`.
7. Web downloads page still `V.2.0.0`; remote pkg SIZE_MATCH + SHA256 after upload.

---

## Deliverables (ENTREGAR)

| # | Item |
|---|------|
| A | Exact file list modified |
| B | Before/after screenshot of hub logo version |
| C | Path + size + SHA256 of new `MDJPRO V.2.0.0.pkg` |
| D | Supabase URL, HTTP 200, remote size, SHA256 match |
| E | Confirm `/Applications` binary replaced (not stale 11 MB build) |
| F | No commit / push / deploy unless separately approved |

---

## Audit reference (SYNC-002)

| Check | SYNC-002 result |
|-------|-----------------|
| `AppConfig.version` | `V.2.0.0` ✓ |
| `downloads.json` | `V.2.0.0` ✓ |
| Remote pkg bytes | Match local ✓ |
| Hub logo PNG | **`V.2.00` ✗** ← this ticket |
| `/Applications` after install | Stale binary possible if app was running ✗ |

---

## Approval

| Role | Sign-off |
|------|----------|
| Captain | ☑ `APROBADO — MDJPRO-VERSION-SYNC-003` (2026-06-09) |
| Architect | ☑ Option A (AppConfig overlay + PNG badge zone cleared) |

**Do not implement until Captain replies with approval on this ticket.**
