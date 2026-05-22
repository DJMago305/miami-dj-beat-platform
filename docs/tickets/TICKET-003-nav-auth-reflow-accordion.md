# TICKET-003 — Nav Auth Reflow / Accordion Effect

**Status:** OPEN — No fix approved  
**Priority:** High — visible CLS on every staff page load while auth resolves  
**Type:** Bug / Navigation Architecture / CLS  
**File:** `web/mdj-shared-header.js`, `web/header-unified.css`  
**Opened:** 2026-05-22  
**Opened by:** Audit — Agent session (transcript c4bb0dd2)

---

## Problem Description

When Owner, Manager, Seller, or Admin loads any of the affected pages while already
logged in, the navigation bar visually "accordions" — it collapses, expands, and
re-settles — during a 300–1500ms window after page paint, while Supabase auth resolves.

The effect is caused by **8 sequential DOM mutations** to `#mainNav` that fire after two
async network calls inside `checkSessionForNav()`. Each mutation forces a full flexbox
layout recalculation on a `justify-content: center` / `flex-wrap: nowrap` container,
which re-positions every remaining visible item horizontally.

The user perceives this as a visible "shake" or "jump" in the nav bar immediately after
the page appears to have loaded.

---

## Affected Pages

| Page | Body class | Notes |
|---|---|---|
| `account-settings.html` | `mdj-account-settings` | Full-access staff nav |
| `account-profile.html` | `mdj-account-profile` | Full-access staff nav |
| `admin-dashboard.html` | `page-admin-dashboard` | Compact staff nav |
| `jobs.html` | `page-jobs` | Compact staff nav |
| `shop.html` | `page-shop` | Compact staff nav |
| `dj-tools.html` | `page-dj-tools` | Compact staff nav |

All of the above share the same root cause. Pages with `data-mdj-compact-nav="1"`
reduce the reflow count from ~8 to ~5 but do not eliminate it.

---

## Root Cause — Late Auth-Time Nav Mutations

### Why the accordion exists at all

CSS rule `body.mdj-staff-nav.page-xxx` cannot activate until `body` receives the
`mdj-staff-nav` class. That class is added inside `checkSessionForNav()` (line 2633),
which runs **after** two network round-trips:

```
sb.auth.getSession()            // network call 1 — ~100–400ms
sb.from('dj_profiles').select() // network call 2 — ~100–400ms
```

During this window (typically 300–1500ms), all nav items are visible at full width
because `body.mdj-staff-nav` is absent and the zero-space CSS rules are inactive.
When auth resolves, the class is added and 5–8 DOM mutations fire in rapid succession.

---

### Primary cause — `document.body.classList.add('mdj-staff-nav')`

**File:** `web/mdj-shared-header.js`  
**Line:** ~2633

```js
document.body.classList.add('mdj-staff-nav');
```

This single line instantly activates **all** zero-space CSS rules for the page. Six to
seven items collapse from `min-width: max-content` (60–120px each) to `width: 0`
simultaneously. The largest single visual event in the accordion sequence.

---

### Secondary causes — rapid sequential DOM mutations after auth

All of the following fire within the same `checkSessionForNav()` async function,
within milliseconds of each other:

| # | Line | Function | DOM mutation | Visual effect |
|---|---|---|---|---|
| 1 | ~2631 | `mdjApplyStaffMainNavLink(true)` | Removes `mdj-mainnav-reserved-slot` + `aria-hidden` from STAFF | **EXPAND** — STAFF takes full visible width |
| 2 | ~2633 | `body.classList.add('mdj-staff-nav')` | Activates all zero-space CSS rules | **SUDDEN COLLAPSE** — TOOLS/JOBS/CONTACT/SHOP vanish |
| 3 | ~2647 | `mdjApplyConfigMainNavLink(true, settingsUrl)` | Removes reserved-slot from CONFIG — briefly visible | **EXPAND then re-collapse** (CSS re-hides) |
| 4 | ~2659 | `mdjApplyArtistDashboardNavChrome(true)` | Removes reserved-slot from MI PERFIL | **EXPAND** — MI PERFIL appears |
| 5 | ~2668 | `mdjEnsureMiPortalInMainNav()` | Injects MI PORTAL node into `#mainNav` DOM | **EXPAND then collapse** — CSS hides it |

Additional mutations on **non-compact-nav pages only:**

| # | Function | Visual effect |
|---|---|---|
| +6 | `mdjApplyAgendaMainNavLink` (at DCL, line 2862 path) | Strips EVENTOS → shrink at DCL |
| +7 | `mdjApplyFlowMainNavLink` at auth | Injects FLUJO → expand then collapse |
| +8 | `mdjEnsureGuestMiPerfilMainNavLink` (DCL, line 2860) | Inserts new `<a>` node at DCL → REFLOW |

---

### DCL-time mutation that starts the chain

**File:** `web/mdj-shared-header.js`  
**Line:** 2860  
**Function:** `mdjEnsureGuestMiPerfilMainNavLink()`

Called on every DOMContentLoaded (before auth). Inserts a new `<a>` node into
`#mainNav` unconditionally. Even though it starts hidden, the DOM insertion forces
a layout pass. This is REFLOW #1 before auth has even started.

---

## CSS Amplifiers

These three properties ensure that any item appearing or disappearing shifts
ALL other items horizontally:

| Property | Selector | Effect |
|---|---|---|
| `justify-content: center` | `#mainNav` | All items re-center after every width change |
| `flex-wrap: nowrap` | `#mainNav` | Horizontal space is zero-sum — no fallback row |
| `min-width: max-content` | `#mainNav > a` (compact-nav anti-CLS rule) | Items hold full text width until CSS override fires |

These are architecturally correct for a desktop single-row nav. They are not bugs
on their own — they amplify the existing mutation problem.

---

## Compact-nav vs Full-access Pages

| Reflow trigger | compact-nav pages | full-access pages |
|---|---|---|
| EVENTOS stripped at DCL | ❌ blocked | ✅ yes |
| AGENDA injected at auth | ❌ blocked | ✅ yes |
| FLUJO DE CAJA injected at auth | ❌ blocked | ✅ yes |
| `body.classList.add('mdj-staff-nav')` collapse | ✅ happens | ✅ happens (worse) |
| MI PERFIL injection at auth | ✅ happens | ✅ happens |
| MI PORTAL DOM injection | ✅ happens | ✅ happens |
| **Estimated total reflows** | **~5** | **~8** |

`data-mdj-compact-nav="1"` reduces severity but does not fix the root cause.

---

## `mdjInstallMainNavStaticMode` — Not a Factor Here

Lines 2920–2921:

```js
setTimeout(mdjInstallMainNavStaticMode, 0);
setTimeout(mdjInstallMainNavStaticMode, 150);
```

Both fire before auth resolves (~300–1500ms later). By the time they run, the
carousel is not yet mounted. These are teardown no-ops in this window.
They do NOT cause the accordion. They are a separate concern.

---

## Risk Assessment

| Approach | Risk | Notes |
|---|---|---|
| Batch all `mdjApply…()` calls before adding `mdj-staff-nav` to body | Medium | Requires restructuring `checkSessionForNav()` call order |
| Add `mdj-staff-nav` to `<body>` via CSS class pre-seeded from server | Low (concept) | Requires SSR or cookie-based body class — not feasible in static deploy |
| Suppress zero-space CSS until a `mdj-nav-settled` class is added | Low | Requires a new CSS class + JS sentinel at end of all mutations |
| Add `body.mdj-staff-nav-pending` as visual-opacity mask during auth | Low | Hides nav briefly while auth resolves — avoids shift but adds blank flash |

Any fix touches `web/mdj-shared-header.js` (shared across all pages) and/or
`web/header-unified.css`. Both require explicit Captain approval before edits.

---

## Proposed Fix Direction (do NOT implement without Captain approval)

**Option A — Batch all mutations before class add (cleanest fix):**

Move `document.body.classList.add('mdj-staff-nav')` to run **last** — after all
`mdjApply…()` calls have completed their DOM work. The CSS activates once on the
final DOM state instead of after each mutation.

Requires reordering lines ~2631–2668 inside `checkSessionForNav()`.

**Option B — Add `mdj-nav-settled` sentinel class:**

At the end of all `mdjApply…()` calls, add `body.classList.add('mdj-nav-settled')`.
Zero-space CSS rules use `body.mdj-staff-nav.mdj-nav-settled.page-xxx` selectors,
preventing premature activation. Slightly wider CSS selector change.

**Scope:** `web/mdj-shared-header.js` only (Option A) or `web/mdj-shared-header.js` +
`web/header-unified.css` (Option B).  
**Regression risk:** Medium — `checkSessionForNav()` is called on all pages.  
**Required approval:** Captain `APROBADO` before any edit.  
**Regression test pages:** `index.html`, `account-settings.html`, `account-profile.html`,
`admin-dashboard.html`, `jobs.html`, `shop.html`, `dj-tools.html`, `dj-profile.html`.

---

## Related Tickets

- `docs/tickets/TICKET-001-shared-header-double-execution-guard.md` — missing IIFE guard
- `docs/tickets/TICKET-002-owner-home-nav-overexpansion.md` — MI PORTAL re-expansion on home
- `docs/tickets/BEHAVIOR-staff-nav-services-events.md` — confirmed staff-only nav behavior
