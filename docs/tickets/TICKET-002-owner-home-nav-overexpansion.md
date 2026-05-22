# TICKET-002 — Owner Home Nav Overexpansion

**Status:** OPEN — No edits approved  
**Priority:** High — visible CLS on every Owner/Manager/Seller page load  
**Type:** Bug / Navigation Architecture  
**File:** `web/mdj-shared-header.js`  
**Opened:** 2026-05-21  
**Opened by:** Audit — Agent session (transcript c4bb0dd2)

---

## Problem Description

When an Owner, Manager, or Seller loads `index.html` (home page), the top navigation bar
stretches horizontally to 11 visible items instead of the expected ~7–8 items.

The visible items after auth resolves:

```
INICIO · SERVICIOS · EVENTOS · SHOP · DJ TOOLS · CONFIG · TRABAJOS · CONTACTO · MI PERFIL · MI PORTAL · STAFF
```

The user perceives this as the nav bar "stretching and then shrinking" (CLS) during the
first second of page load.

---

## Root Cause #1 — MI PORTAL re-shown after normalize

**File:** `web/mdj-shared-header.js`  
**Lines:** 2665–2668  
**Affected selector:** `#mainNav-mi-portal-link`

```js
/* line 2664 comment: "reforzar staff" */
if (isDjStaff && document.getElementById('mainNav')) {
  mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);   // ← re-shows MI PORTAL
  mdjEnsureMiPortalMobile(miPortalHref, miPortalNavOpts);
}
```

**Sequence that produces the bug:**

| Order | Line | Function | Effect on `#mainNav-mi-portal-link` |
|---|---|---|---|
| 1st | 2618 | `mdjEnsureMiPortalInMainNav()` | Shows MI PORTAL |
| 2nd | 2658 | `mdjNormalizePublicHomeMainNav()` | Hides MI PORTAL (adds `mdj-mainnav-reserved-slot` + `aria-hidden`) |
| **3rd** | **2665–2668** | **`if (isDjStaff) mdjEnsureMiPortalInMainNav()`** | **Re-shows MI PORTAL — overrides normalize** |

**Why the override is destructive:**  
`mdjEnsureMiPortalInMainNav` (line 1262) unconditionally overwrites the element's full
`className`:

```js
link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold';  // strips mdj-mainnav-reserved-slot
link.style.display = '';
link.removeAttribute('aria-hidden');
link.removeAttribute('tabindex');
```

Any `mdj-mainnav-reserved-slot` class that `mdjNormalizePublicHomeMainNav` placed on the
element is wiped out in this single assignment. The element becomes fully visible and
occupies nav space.

---

## Root Cause #2 — Triple setTimeout CLS

**File:** `web/mdj-shared-header.js`  
**Lines:** 2917–2919

```js
setTimeout(mdjInstallMainNavStaticMode, 0);
setTimeout(mdjInstallMainNavStaticMode, 150);
setTimeout(mdjInstallMainNavStaticMode, 600);   // ← visible to human eye
```

`mdjInstallMainNavStaticMode` forces layout recalculation on `#mainNav` after
DOMContentLoaded fires. Three staggered calls mean the nav is re-evaluated at 0ms, 150ms,
and 600ms post-load. The 600ms call is plainly visible as a delayed "shrink" after the nav
has already settled, producing the second half of the perceived CLS.

---

## Secondary Contributors (pre-existing, same root cause chain)

| Issue | Line | Notes |
|---|---|---|
| `mdjEnsureGuestMiPerfilMainNavLink` injects new MI PERFIL element | 220–237 | Adds a 10th item not present in HTML |
| `mdjNormalizePublicHomeMainNav` called 4 times total | 450, 2658, 2860, 2917–2919 (via static mode) | Repeated DOM mutations |

---

## Impact

- **Who:** Every staff user (Owner, Manager, Seller) viewing `index.html` while logged in.
- **What they see:** Nav bar expands from ~7 items to 11 items 300–600ms after page load,
  then partially settles. Visual shift is noticeable and violates the anti-CLS rule in
  `.cursorrules` §1 ("El menú de navegación es un bloque de piedra. PROHIBIDO cualquier Layout Shift.").
- **Cascading:** Any page that loads `mdj-shared-header.js` without `data-mdj-compact-nav="1"`
  may show the same MI PORTAL re-expansion for staff.

---

## Proposed Fix (do NOT implement without Captain approval)

**Fix A — Guard the re-show block against home page (primary fix):**

```js
// lines 2664–2668 — add home page guard
if (isDjStaff && document.getElementById('mainNav') && !mdjIsPublicHomePage()) {
  mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
  mdjEnsureMiPortalMobile(miPortalHref, miPortalNavOpts);
}
```

**Fix B — Remove 600ms timeout (secondary fix, reduces visible CLS):**

```js
// lines 2917–2919 — remove the 600ms call
setTimeout(mdjInstallMainNavStaticMode, 0);
setTimeout(mdjInstallMainNavStaticMode, 150);
// setTimeout(mdjInstallMainNavStaticMode, 600);  ← remove
```

**Scope of fix:** `web/mdj-shared-header.js` only. `index.html` is LOCKED — no edits.  
**Risk level:** Medium — shared header affects all pages. Fix A is a one-word guard
(`&& !mdjIsPublicHomePage()`). Fix B removes one timeout line.  
**Required approval:** Captain explicit `APROBADO` before any edit.  
**Regression test:** Verify staff nav on home, services, events, dj-profile, and
admin-dashboard after applying.

---

## Related Tickets

- `docs/tickets/TICKET-001-shared-header-double-execution-guard.md` — missing IIFE guard
- `docs/tickets/BEHAVIOR-staff-nav-services-events.md` — confirmed staff-only nav behavior
