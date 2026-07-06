# Miami DJ Beat — Portal Architecture V2 Lab
## 04 — Migration Plan

**Ticket:** TICKET-V2-LAB-FOUNDATION-001  
**Principle:** Module-by-module cutover — **never loose files**

---

## Migration Philosophy

V1 (`web/`) remains production until each **module** is:

1. Built and QA-passed in the lab
2. Approved by Product Owner for cutover
3. Deployed as a **complete replaceable unit**
4. Monitored with rollback plan
5. V1 module marked deprecated (not deleted until stable window ends)

```
Lab module READY → PO cutover approval → Deploy V2 module → Monitor → Retire V1 module
```

**Forbidden:** copying single JS files, patching V1 from lab, hybrid pages serving half V1 / half V2 nav.

---

## Module Definition

A **module** is a bounded product unit with:

- Entry route(s)
- Own nav slice or portal shell
- Own test suite
- Own rollback switch (feature flag or route prefix)
- Documented dependency on Shared Core version

### Example modules (illustrative — priority set by PO)

| ID | Module | Source V1 anchor | Target portal |
|----|--------|------------------|---------------|
| M-CORE | Shared Core v1 | auth, i18n, tokens | `shared/` |
| M-CLIENT-ACCT | Client account | `account-profile.html`, client flows | `client/` |
| M-ARTIST-NAV | Artist navigation | owner strip, `mdj-shared-header` strip block | `artist/` + `shared/navigation/` |
| M-ARTIST-PROFILE | Artist public profile | `dj-profile.html` (scoped blocks) | `artist/` |
| M-ARTIST-DASH | Artist dashboard | `dj-dashboard.html` | `artist/` |
| M-STAFF-ADMIN | Staff dashboard | `admin-dashboard.html` | `staff/` |
| M-STAFF-INV | Staff invoicing | invoice bundle (separate track) | `staff/` |

Priorities are **not fixed** in this document; PO assigns per quarter.

---

## Phases

### Phase 0 — Foundation (current ticket)

- Documentation only in `docs/V2-LAB/`
- PO approval of vision, architecture, rules
- **No** `portal-v2-lab/` folder yet

**Exit criteria:** PO signs TICKET-V2-LAB-FOUNDATION-001

**Estimated duration:** 1 week (review + approval)

---

### Phase 1 — Lab Scaffold

- Create `portal-v2-lab/` tree (separate ticket)
- Empty portal shells + Shared Core bootstrap
- CI lint/test skeleton
- Lab preview URL (not production)

**Exit criteria:** Three portals boot blank pages with auth stub

**Estimated duration:** 2–3 weeks

---

### Phase 2 — Shared Core Parity

- Authentication + `mdj_access_snapshot` client
- Permissions guards
- Design system tokens (nav anti-shift rules)
- i18n EN/ES pipeline
- API service layer

**Exit criteria:** Login/logout works in lab; role snapshot drives guard demo page

**Estimated duration:** 3–4 weeks

---

### Phase 3 — Artist Navigation Module (first product module)

- Implement V2 lifecycle contracts (generalized from `OWNER_STRIP_READY`)
- 10-pillar order parity with production spec
- Satellite nav context (`mdj_nav=profile` equivalent as lab routing)
- E2E: owner sees STAFF; non-owner does not

**Exit criteria:** Quality gates pass; side-by-side QA vs production order

**Estimated duration:** 3–5 weeks

**Note:** V1 CONTRATO V2 on `dj-profile.html` is a **prototype pattern**, not migration. Lab rebuilds clean.

---

### Phase 4 — Portal Feature Modules

Parallel tracks after Core + Artist Nav stable:

| Track | Modules |
|-------|---------|
| Client | account, bookings, shop buyer |
| Artist | profile, dashboard, SFT, Cash Flow |
| Staff | admin dashboard, seller-limited views |

Each module: own ticket, own QA, own cutover approval.

**Estimated duration:** 4–6 months total (team-size dependent)

---

### Phase 5 — Production Cutover

Per module:

1. **Preview** on lab URL with production Supabase read-only or staging project
2. **PO UAT** sign-off
3. **Route flip** or subdomain (`artist.miamidjbeat.com`, etc.)
4. **72h monitor** — error budget, auth regressions
5. **V1 module** frozen read-only
6. After stability window → remove V1 routes

**Rollback:** DNS/route revert to V1 module; no DB destructive rollback without DBA ticket

---

## Cutover Checklist (per module)

- [ ] Module ID and scope documented
- [ ] No dependency on V1 globals
- [ ] RLS verified for all write paths
- [ ] Staff red-zone reviewed if applicable
- [ ] i18n EN + ES for new strings
- [ ] Mobile + desktop nav geometry QA
- [ ] Auth: INITIAL_SESSION vs SIGNED_IN tested
- [ ] PO written approval for cutover
- [ ] Deploy authorization phrase if production
- [ ] Rollback owner assigned

---

## What Stays on V1 Longest

Likely last to migrate (high coupling / red zone):

- `admin-dashboard.html` production flows
- Invoice / billing print surfaces
- Legacy checkout Edge integrations tied to V1 URLs
- Locked marketing pages (`index.html`, `rentals.html` talent hub)

PO may keep V1 indefinitely for specific surfaces even after lab is primary.

---

## Data Migration

- **No big-bang user data migration** expected — same Supabase tables
- Schema changes: separate `supabase/` tickets, applied to prod only with PO approval
- MDJB IDs and profile rows remain source of truth

---

## Reuse Authorization Process

When lab needs V1 logic reference:

1. Engineer documents behavior spec (not copy-paste)
2. Architect reviews for security (especially permissions)
3. PO approves reimplementation or authorized port
4. ADR filed in lab with source reference and expiry

Unauthorized copy is a **process violation** and blocks merge.

---

## Timeline Summary

| Phase | Duration (estimate) |
|-------|---------------------|
| 0 Foundation docs | 1 week |
| 1 Scaffold | 2–3 weeks |
| 2 Shared Core | 3–4 weeks |
| 3 Artist Nav module | 3–5 weeks |
| 4 Feature modules | 4–6 months |
| 5 Cutover waves | Ongoing per module |

**Total to first production module:** ~10–14 weeks after scaffold approval  
**Full V1 replacement:** 12–18+ months (organization-dependent)

---

## Awaiting Approval

No migration execution until PO approves foundation and subsequent scaffold ticket.
