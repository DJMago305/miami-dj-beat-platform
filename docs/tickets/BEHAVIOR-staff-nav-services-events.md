# BEHAVIOR DOC — Staff Nav / Carousel on services.html & events.html

**Confirmed by:** Captain (2026-05-21)  
**Status:** ACTIVE — implemented, behavior is intentional

---

## Confirmed Behavior: Option A — Staff-Only

The menu shortening and carousel hiding on `services.html` and `events.html` apply **exclusively** when the logged-in user is **Owner, Manager, or Seller**.

This is **not** a universal public-page change. Visitors and logged-out users see the full page (long nav + carousel) as normal.

---

## How It Works

1. `mdj-shared-header.js` runs an async Supabase `onAuthStateChange` callback after page load.
2. If the authenticated user has role `owner | admin | manager | seller`, the callback adds `body.mdj-staff-nav` to the DOM.
3. CSS rules in `header-unified.css` (block `v20260521-staff-services-events-1`) target `body.mdj-staff-nav.page-mdj-rentals` and `body.mdj-staff-nav.page-mdj-events` to:
   - Hide `[data-mdj-nav="contact"]` from the desktop and mobile nav.
   - Hide `#rentals-gallery` (gallery carousel) on services.html.
   - Hide `.mdj-experience-cards-zone` and `.mdj-experience-residencies-zone` on events.html.

---

## Known Limitation (documented, accepted)

| Condition | Result |
|---|---|
| User is logged out | `body.mdj-staff-nav` is never added — no visual change |
| User is staff but auth is slow | Brief flash of full page before class is applied |
| User is not staff (client / artist) | Class is explicitly removed — no visual change |
| Hard refresh required after version bump | Browser must reload new JS (`?v=20260521-staff-nav-class-1`) |

**The visual change will NOT appear for:**
- Anonymous / logged-out visitors
- Logged-in clients or artists
- Any user before Supabase auth resolves

This is intentional per Captain confirmation. Do not convert to a universal (auth-independent) implementation without a new explicit ticket.

---

## Files Involved

| File | Change |
|---|---|
| `web/mdj-shared-header.js` | Lines 2631–2636: adds/removes `body.mdj-staff-nav` |
| `web/header-unified.css` | Lines 1758–1789: CSS rules scoped to staff + page class |
| `web/services.html` | Line 22: CSS buster `20260521-staff-services-events-1` / Line 3540: JS buster `20260521-staff-nav-class-1` |
| `web/events.html` | Line 11: CSS buster `20260521-staff-services-events-1` / Line 355: JS buster `20260521-staff-nav-class-1` |

---

## Related Ticket

- `docs/tickets/TICKET-001-shared-header-double-execution-guard.md` — guard faltante en IIFE (pendiente aprobación)
