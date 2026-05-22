# TICKET-001 — Missing Internal Guard in `mdj-shared-header.js`

**Status:** OPEN — Pending Captain approval before any edit  
**Priority:** Medium  
**Type:** Architecture / Defensive Code  
**File:** `web/mdj-shared-header.js`  
**Line of concern:** Line 11 (IIFE start) and Line 2932 (`window.__MDJ_HEADER_SESSION_OWNER = true`)  
**Opened:** 2026-05-21  
**Opened by:** Audit — Agent session (transcript c4bb0dd2)

---

## Problem Description

`mdj-shared-header.js` is wrapped in an IIFE that executes immediately on load:

```js
// line 11 — IIFE starts, no guard
(function () {
  'use strict';
  // ... ~2920 lines of logic: auth listeners, nav rendering, DOM manipulation ...
  window.__MDJ_HEADER_SESSION_OWNER = true; // line 2932 — set at the END
})();
```

`window.__MDJ_HEADER_SESSION_OWNER` is set at the **bottom** of the IIFE but is **never read at the top** to abort re-execution if the script has already run. There is no early-exit guard.

---

## Risk

If `mdj-shared-header.js` is loaded twice in the same page session (causes include: browser cache serving old version string while new version string also loads during a soft refresh, a `<script>` tag accidentally duplicated in a future edit, or dynamic injection by another module), both IIFEs execute completely:

- **Two `onAuthStateChange` listeners** are registered with Supabase.
- **Double nav rendering** — DOM is mutated twice per auth event.
- **Race condition** — second execution may run against a partially-modified DOM from the first.
- **`body.mdj-staff-nav`** could be toggled by two competing handlers out of order.

Currently no page has a duplicate `<script>` tag confirmed. The risk is transitional (browser memory + new version string coexisting during soft refresh) and future-proofing.

---

## Observed During

Session audit for `services.html` / `events.html` staff-nav changes (2026-05-21). The flag `__MDJ_HEADER_SESSION_OWNER` was found only written, never checked internally.

---

## Proposed Fix (do NOT implement without Captain + Architect sign-off)

Add a guard at the very top of the IIFE, before any side effects:

```js
(function () {
  'use strict';
  // Guard: abort if already initialized (prevents double-execution from cache overlap)
  if (window.__MDJ_HEADER_SESSION_OWNER) return;

  // ... rest of script unchanged ...

  window.__MDJ_HEADER_SESSION_OWNER = true;
})();
```

**Scope:** one line added at line 12. Zero behavior change under normal single-load conditions.  
**Risk of fix:** Low — guard only blocks re-execution if flag is already true, which only happens if the script ran before.  
**Requires:** Captain approval (`APROBADO`) before edit. Architect review of any page that dynamically injects this script.

---

## Related

- `web/mdj-shared-header.js` — auth + nav logic owner
- `web/services.html` line 3540 — loads `?v=20260521-staff-nav-class-1`
- `web/events.html` line 355 — loads `?v=20260521-staff-nav-class-1`
- Audit: `docs/tickets/TICKET-001-shared-header-double-execution-guard.md` (this file)
