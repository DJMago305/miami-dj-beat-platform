# MDJPRO-PERMISOS-007 — Runtime permissions UX (local / Xcode first)

**Status:** **DONE — Phase 1 closed** (Captain `AUTORIZADO` 2026-06-11 · local/Xcode PASS)  
**Priority:** Medium  
**Prod:** Phase 1 **not in prod DMG** until separate ship (`BUILD APROBADO` + notarize + `APROBADO DEPLOY PRODUCCIÓN`)  
**Phase 2+:** Deferred — new sub-ticket if Captain reopens scope

---

## Captain contract (non-negotiable)

| Rule | Detail |
|------|--------|
| **Same workflow** | Hub method unchanged — LOAD ROOT, wizard, scan, TagMaster as today |
| **No structure change** | No new mandatory screens, no Hub reorder, no ScanStore refactor |
| **LEY** | **Splash → Hub** — **006 off at launch** (`MDJPermissionOnboardingView` not on startup) |
| **Scope** | UX only: copy, NSOpenPanel strings, inline errors — contextual help |
| **Zona roja** | No `LicenseManager`, handoff, entitlements, `WelcomeView` launch flow |
| **One file per sub-ticket** | Each edit needs named file + `DETENERSE` |

---

## Phase 1 (local — approved)

**File:** `MDJ/ContentView.swift` — `selectRootFolder()` only  

**Change:** Reuse existing `PERM_ONBOARD_*` translations for the **LOAD ROOT** folder panel (ES/EN + langs already in `LanguageManager`). Surface `addSource` failure via `statusLine` (same flow, clearer feedback).

**QA (Xcode ⌘R):**

1. Splash → Hub (no 006)
2. LOAD ROOT → panel title/message in active language
3. Pick folder → same behavior as before
4. Cancel panel → no regression

**Captain:** `AUTORIZADO` — Phase 1 accepted for local workshop (Xcode). **Ticket Phase 1 = closed.**

### Phase 1 verification (code)

| Check | Evidence |
|-------|----------|
| Panel localized | `ContentView.swift` `selectRootFolder()` → `PERM_ONBOARD_PANEL_TITLE/MSG/CTA` |
| Error surfaced | `statusLine` ← `scanStore.errorMessage` or `PERM_ONBOARD_ERROR` |
| 006 off at launch | `WelcomeView.swift` — no `MDJPermissionOnboardingView` |
| Hub unchanged | Same LOAD ROOT → `addSource` flow |

---

## Phase 2+ (deferred — not part of 007 closure)

- Localize `authorizeVolumeFromBanner` panel (external drive)
- Optional inline hint on Hub near LOAD ROOT (copy only)
- **Not:** re-wire 006 at launch

---

## Related

- **006:** `MDJPermissionOnboardingView.swift` — exists, **not** startup path  
- **Handoff:** `~/Desktop/MDJ/MDJPRO_PROJECT_STATE.md` §6, §10
