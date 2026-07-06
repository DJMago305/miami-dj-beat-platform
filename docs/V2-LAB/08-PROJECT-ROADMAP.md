# Miami DJ Beat — Portal Architecture V2 Lab
## 08 — Project Roadmap

**Ticket:** TICKET-V2-LAB-FOUNDATION-001  
**Horizon:** 12–18 months to broad V1 replacement (estimate)  
**Status:** Planning — awaiting PO approval

---

## Roadmap Overview

```
2026 Q3          2026 Q4          2027 Q1          2027 Q2+
────────         ────────         ────────         ────────
Foundation  →    Scaffold    →    Core +        →  Module waves
(docs)           + shells         Artist Nav       + cutover
```

Dates are **indicative**; PO adjusts per capacity.

---

## Milestone 0 — Foundation Documentation ✅ (This Ticket)

**Deliverable:** `docs/V2-LAB/` (8 documents)

| Task | Output |
|------|--------|
| Vision & three portals | `01-VISION.md` |
| Technical architecture | `02-ARCHITECTURE.md` |
| Dev rules | `03-DEVELOPMENT-RULES.md` |
| Migration strategy | `04-MIGRATION-PLAN.md` |
| Folder structure | `05-FOLDER-STRUCTURE.md` |
| Prohibited actions | `06-PROHIBITED-ACTIONS.md` |
| Quality gates | `07-QUALITY-GATES.md` |
| Roadmap | `08-PROJECT-ROADMAP.md` |

**Duration:** 1 week (review cycle)  
**Gate:** G0 — PO approval  
**No code**

---

## Milestone 1 — Lab Scaffold

**Ticket (future):** TICKET-V2-LAB-SCAFFOLD-001

| Deliverable | Notes |
|-------------|-------|
| `portal-v2-lab/` tree | Per `05-FOLDER-STRUCTURE.md` |
| Build tool + TS | ADR for stack |
| Three empty portal entries | Placeholder routes |
| Shared Core package stub | Export map only |
| Lab preview deploy | Not V1 URL |
| CI lint + smoke | G1 |

**Duration:** 2–3 weeks  
**Dependencies:** M0 approved  
**Risk:** Tooling debate delays — mitigate with ADR timebox (3 days)

---

## Milestone 2 — Shared Core v1

**Ticket (future):** TICKET-V2-CORE-AUTH-PERM-001

| Workstream | Deliverable |
|------------|-------------|
| Authentication | Session hydrate, sign-in/out |
| Permissions | Snapshot client, route guards |
| i18n | EN/ES loader, fallback |
| Design system | Tokens, nav primitives (12ch, underline) |
| Services | Supabase + Edge wrapper |
| Events | Contract bus (`SURFACE_READY` pattern) |

**Duration:** 3–4 weeks  
**Gate:** G2  
**Demo:** Login as buyer / artist / owner — each routed to correct portal shell

---

## Milestone 3 — Artist Navigation Module

**Ticket (future):** TICKET-V2-ARTIST-NAV-001

First **product** module — highest V1 pain (C6 lifecycle).

| Deliverable | Parity target |
|-------------|---------------|
| 10-pillar artist nav | Production order + STAFF |
| Surface ready contract | No poll reorder |
| Satellite routing | `mdj_nav=profile` equivalent |
| Visual blocker | Clears on ready |
| E2E | Owner + non-owner |

**Duration:** 3–5 weeks  
**Gate:** G3 (artist nav)  
**Migration:** First cutover candidate after PO UAT

**Note:** V1 CONTRATO V2 on `dj-profile.html` informs spec; lab reimplements clean.

---

## Milestone 4 — Artist Feature Modules

**Parallel after M3**

| Module | Priority (suggested) | Est. |
|--------|----------------------|------|
| Artist public profile | P1 | 4–6 w |
| Artist dashboard / agenda | P1 | 4–6 w |
| Cash Flow tab | P2 | 2–3 w |
| SoundForTips™ (PRO gate) | P2 | 3–4 w |
| DJ Tools entry | P3 | 2 w |
| Academia artist context | P3 | 2–3 w |

**Duration:** 8–12 weeks cumulative (parallelizable)  
**Gate:** G3 per module

---

## Milestone 5 — Client Portal Modules

| Module | Priority | Est. |
|--------|----------|------|
| Client account / profile | P1 | 3–4 w |
| Bookings / events history | P2 | 4 w |
| Shop buyer checkout | P2 | 4–6 w |
| VIP loyalty UI | P3 | 2 w |

**Duration:** 6–10 weeks  
**Constraint:** Zero staff/artist tools in client shell

---

## Milestone 6 — Staff Portal Modules

| Module | Priority | Est. | Red zone |
|--------|----------|------|----------|
| Staff auth gate + dashboard shell | P0 | 3 w | Yes |
| Leads | P1 | 4 w | Yes |
| Seller-limited views | P1 | 2 w | Yes |
| Billing / invoices | P2 | 6+ w | Yes |
| Contracts | P2 | 4 w | Yes |

**Duration:** 10–16 weeks  
**Constraint:** Separate tickets per red-zone surface; PO + security review each

---

## Milestone 7 — Cutover Waves

| Wave | Modules | Strategy |
|------|---------|----------|
| W1 | Artist nav + profile | Subdomain or route prefix |
| W2 | Artist dashboard | Flip after W1 stable 30d |
| W3 | Client account | Independent of artist |
| W4 | Staff dashboard (non-billing) | Auth gate QA critical |
| W5 | Billing / invoice | Last or isolated subdomain |

Each wave: G4 checklist, 72h monitor, V1 deprecation flag.

---

## Milestone 8 — V1 Decommission (Optional End State)

- Remove retired V1 routes from deploy
- Archive `web/` modules with tag
- Single Supabase schema; no dual-write

**Duration:** Incremental over 6+ months after first cutover  
**PO may retain V1** for marketing (`index.html`, rentals hub) indefinitely

---

## Resource Assumptions

| Scenario | Calendar to W1 cutover |
|----------|----------------------|
| 1 full-time engineer | ~14–18 weeks from scaffold |
| 2 engineers (parallel portals) | ~10–14 weeks from scaffold |
| Part-time / shared with V1 firefighting | 6+ months |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep into V1 fixes | Lab blocked, V1 regressions | `06-PROHIBITED-ACTIONS.md` enforcement |
| Unauthorized copy from `web/` | Security + debt | Reuse ADR process |
| Dual nav during parallel run | User confusion | Separate URLs until cutover |
| Red zone in staff portal | Data breach | RLS-first; separate tickets |
| PO capacity for UAT | Delayed cutover | Module-sized UAT slots |
| Supabase schema drift | Lab/prod mismatch | Staging project for lab |
| Engineer temptation to “quick fix V1” | C6 repeats | Architect review on every PR |

---

## Advantages

| Advantage | Benefit |
|-----------|---------|
| Full isolation | V1 production stable during lab |
| Three portals | Clear buyer / artist / staff UX |
| Shared Core | One auth, one permission truth |
| Event contracts | Eliminates poll-based nav drift |
| Module migration | Rollback per module, lower blast radius |
| TypeScript + lint boundaries | Catches cross-portal imports early |
| Documented gates | PO-visible readiness, no silent ship |

---

## Success Metrics (12-Month View)

| Metric | Target |
|--------|--------|
| V1 files touched by lab | 0 |
| Production modules on V2 | ≥ 2 (nav + one feature) |
| Nav layout-shift incidents | 0 P0 |
| Staff gate black-screen incidents | 0 |
| Unauthorized V1 copy events | 0 |
| PO-approved cutovers | Documented per wave |

---

## Immediate Next Step

**Await Product Owner approval** of TICKET-V2-LAB-FOUNDATION-001.

Upon approval, open **TICKET-V2-LAB-SCAFFOLD-001** (Milestone 1) — still no V1 edits.

---

## Document Index

| # | File |
|---|------|
| 01 | [01-VISION.md](./01-VISION.md) |
| 02 | [02-ARCHITECTURE.md](./02-ARCHITECTURE.md) |
| 03 | [03-DEVELOPMENT-RULES.md](./03-DEVELOPMENT-RULES.md) |
| 04 | [04-MIGRATION-PLAN.md](./04-MIGRATION-PLAN.md) |
| 05 | [05-FOLDER-STRUCTURE.md](./05-FOLDER-STRUCTURE.md) |
| 06 | [06-PROHIBITED-ACTIONS.md](./06-PROHIBITED-ACTIONS.md) |
| 07 | [07-QUALITY-GATES.md](./07-QUALITY-GATES.md) |
| 08 | [08-PROJECT-ROADMAP.md](./08-PROJECT-ROADMAP.md) |

---

**No commit. No push. No deploy.**
