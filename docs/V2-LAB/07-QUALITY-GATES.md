# Miami DJ Beat — Portal Architecture V2 Lab
## 07 — Quality Gates

**Ticket:** TICKET-V2-LAB-FOUNDATION-001  
**Purpose:** Define pass/fail criteria before any lab module is merge-ready or migration-eligible

---

## Gate Levels

| Level | When | Owner |
|-------|------|-------|
| **G0** | Foundation docs approved | PO |
| **G1** | Lab scaffold PR | Architect |
| **G2** | Shared Core milestone | Architect + PO |
| **G3** | Portal module PR | Engineer + PO UAT |
| **G4** | Production cutover | PO + `APROBADO DEPLOY PRODUCCIÓN` |

---

## G0 — Foundation (This Ticket)

- [ ] All 8 docs in `docs/V2-LAB/` complete
- [ ] Three portals and Shared Core boundaries documented
- [ ] Migration module strategy documented
- [ ] Prohibited actions acknowledged by PO
- [ ] No code or folders created
- [ ] No V1 files modified

**Status:** Pending PO approval

---

## G1 — Lab Scaffold

### Structure

- [ ] All code under `portal-v2-lab/` only
- [ ] Zero diff in `web/`, `supabase/`, locked paths
- [ ] Import boundaries configured (lint or package rules)
- [ ] Separate lab preview URL documented

### Boot

- [ ] `client/`, `artist/`, `staff/` shells load without console errors
- [ ] Shared Core importable from each portal
- [ ] No V1 script tags in lab HTML entries

### CI

- [ ] Lint passes
- [ ] Typecheck passes (if TS)
- [ ] Empty E2E smoke: three portals return 200

---

## G2 — Shared Core

### Authentication

- [ ] Session hydrate completes before route guard
- [ ] `INITIAL_SESSION` does not redirect logged-in user incorrectly
- [ ] `SIGNED_IN` triggers correct portal home
- [ ] Sign-out clears state and redirects to public entry
- [ ] Staff impersonation / wrong portal → sign out + redirect (V1 parity)

### Permissions

- [ ] `mdj_access_snapshot()` (or equivalent) drives UI guards
- [ ] Buyer cannot see staff routes in nav or direct URL
- [ ] Seller cannot write management-only modules
- [ ] Owner/admin/manager can write where `is_staff_management` applies
- [ ] JWT-only role never grants staff UI

### Navigation (Core)

- [ ] Desktop nav items ≥ 12ch min width
- [ ] Active underline slot always reserved (no layout shift)
- [ ] Hardcoded EN/ES fallback labels in shell before i18n
- [ ] Mobile hamburger does not hide logout/login incorrectly

### i18n

- [ ] English keys canonical; Spanish present or fallback documented
- [ ] Missing key falls back to alternate locale

### Design System

- [ ] Tokens documented (color, spacing, typography)
- [ ] No import from V1 CSS files
- [ ] Brand gold accent and dark surfaces verified on sample page

---

## G3 — Portal Module (Per Module)

### Artist Navigation Module (Reference — First Product Gate)

- [ ] 10-pillar order matches production spec:  
  `INICIO · ACADEMIA · SHOP · AGENDA · CONFIG · DJ TOOLS · CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™`
- [ ] STAFF visible for staff roles; hidden or absent for non-staff
- [ ] Surface emits ready event; nav listener runs **once** (no poll)
- [ ] Catch-up path if emit precedes listener
- [ ] Visual blocker clears on ready (no orphan `display:none` on `<html>`)
- [ ] Satellite context routing preserves artist nav without duplicate public `#mainNav`
- [ ] `mdjApplyStaffNavHref` behavior replicated in lab staff link builder
- [ ] CASH FLOW text locked against i18n overwrite where specified

### Client Module

- [ ] No owner strip, no staff tab, no admin links in primary nav
- [ ] VIP crown + label only for eligible `client_profiles`
- [ ] Checkout errors show Edge response body on HTTP ≠ 200

### Staff Module

- [ ] Auth gate clears before heavy module loads (no black screen)
- [ ] Non-staff user → signOut + index redirect
- [ ] Owner STAFF entry → staff dashboard `#staff`, not account profile
- [ ] Red-zone modules flagged in PR template

### Cross-Cutting (Every Module PR)

- [ ] Module ID referenced (see `04-MIGRATION-PLAN.md`)
- [ ] Portal boundary import check passed
- [ ] No unauthorized V1 copy
- [ ] EN i18n keys added first
- [ ] Desktop + mobile manual QA screenshots attached
- [ ] Playwright or equivalent E2E for happy path + guard path
- [ ] Accessibility: focus order on nav, aria-labels on icon-only controls

---

## G4 — Production Cutover

- [ ] G3 passed on preview with production-like data
- [ ] PO UAT sign-off recorded in ticket
- [ ] Rollback procedure tested (route revert ≤ 15 min)
- [ ] Error monitoring baseline captured
- [ ] `APROBADO DEPLOY PRODUCCIÓN` recorded
- [ ] V1 module marked deprecated, not deleted
- [ ] 72h post-deploy review scheduled

---

## Automated Checks (Recommended — Scaffold Ticket)

| Check | Tool |
|-------|------|
| Import boundaries | ESLint `import/no-restricted-paths` |
| No V1 path in lab bundle | Custom grep in CI |
| Type safety | TypeScript strict |
| E2E role matrix | Playwright projects: buyer, artist, owner, seller |
| Nav layout shift | Visual regression or pixel diff on nav bar |
| i18n key parity | Script: EN keys ⊆ ES keys (warn) |

---

## Regression Catalog (Must Not Reappear)

Derived from V1 incidents:

| ID | Regression | Gate test |
|----|------------|-----------|
| R-01 | Owner strip STAFF missing / wrong order | Artist nav E2E |
| R-02 | Poll window expires before `loadProfile` | Event contract unit test |
| R-03 | `#header-login-btn` hidden — no Logout | Auth header E2E |
| R-04 | Admin black screen — gate blocked | Staff load order test |
| R-05 | `successUrl` with `/web/` prefix | URL builder unit test |
| R-06 | Owner STAFF → wrong destination | Link href assertion |
| R-07 | Double nav bar on satellite pages | Satellite route E2E |
| R-08 | SFT granted without PRO plan | Permission mock test |

---

## Definition of Done (Lab Module)

A module is **DONE** when:

1. All applicable G3 checks pass
2. PO UAT approved
3. Rollback documented
4. V1 mapping table updated in migration plan
5. No open P0/P1 bugs

---

## Waivers

Only PO may waive a gate item in writing with:

- Waiver ID
- Risk accepted
- Expiry date
- Compensating control

Waivers do not apply to red-zone security gates (P-24–P-30).

---

## Awaiting Approval

Quality gates take effect upon PO approval of foundation and subsequent scaffold ticket.
