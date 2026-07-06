# Miami DJ Beat — Portal Architecture V2 Lab
## 01 — Vision

**Ticket:** TICKET-V2-LAB-FOUNDATION-001  
**Status:** Planning — awaiting Product Owner approval  
**Date:** 2026-07-05

---

## Purpose

Define a **fully isolated laboratory** where Miami DJ Beat Portal Architecture V2 is designed, built, and validated **without touching V1**.

The lab is not a fork of `web/`. It is an independent product surface that will eventually replace V1 **only through explicit, module-by-module migration** authorized by the Product Owner and Architect.

---

## Problem V2 Solves

V1 (`web/`) grew as a monolithic static site with:

- Shared scripts (`mdj-shared-header.js`, `auth.js`) coupling unrelated surfaces
- Lifecycle contracts inferred by polls, timers, and DOM observers (e.g. owner strip C6 drift)
- Role boundaries blurred across buyer, artist, and staff flows in one HTML tree
- Locked files and regression risk blocking safe iteration

V2 separates **three independent portals** plus a **Shared Core**, each with explicit initialization contracts, permission resolution at the backend, and no cross-portal UI leakage.

---

## North Star

| Principle | Meaning |
|-----------|---------|
| **Isolation** | Lab never modifies V1. Zero shared filesystem paths during development. |
| **Explicit contracts** | Events and gates replace polling (e.g. `OWNER_STRIP_READY` pattern generalized). |
| **Role truth in Postgres** | `is_staff()`, `is_staff_management()`, profile rows — not client-only JWT. |
| **Module migration** | Future cutover moves **complete modules**, never loose files. |
| **Bilingual by design** | English canonical; Spanish secondary (`en` first in all keys). |

---

## Three Portals (Product Surfaces)

### 1. Client Portal (`client/`)

End customers and buyers. Account, bookings, shop checkout, loyalty (VIP), event history.

**Must NOT contain:** artist owner tools, staff admin, internal production modules.

### 2. Artist Portal (`artist/`)

DJs and performers. Public profile management, agenda, Cash Flow, SoundForTips™ (PRO-gated), DJ Tools, Academia artist flows.

**Must NOT contain:** staff admin surfaces, client-only buyer journeys as primary nav.

### 3. Staff Portal (`staff/`)

Owner, Admin, Manager, Seller — one codebase, **role-based permissions**.

**Must NOT contain:** artist creative tools or client shopping as primary surfaces.

---

## Shared Core (`shared/`)

Cross-cutting capabilities only — no page-specific routes:

- Authentication
- Permissions / access snapshot
- Design System + Theme
- Reusable components
- API service layer
- Internationalization

---

## What the Lab Is NOT

- Not a staging copy of `web/`
- Not a place to patch V1 bugs
- Not authorized to copy-paste from `web/` without PO + Architect approval
- Not production until explicit `APROBADO DEPLOY PRODUCCIÓN`

---

## Success Criteria (Lab Phase)

1. Three portal shells boot independently with Shared Core wired.
2. Permission matrix matches `.cursorrules` staff/buyer/artist model.
3. Owner strip / navigation lifecycle uses explicit contracts — no poll-based reorder.
4. Quality gates (see `07-QUALITY-GATES.md`) pass before any module is migration-candidate.
5. PO signs off on lab foundation before first code scaffold.

---

## Stakeholders

| Role | Responsibility |
|------|----------------|
| **Product Owner (Capitán)** | Scope, approval phrases, migration authorization |
| **Architect** | Structure, contracts, quality gates |
| **Engineering** | Lab implementation inside `portal-v2-lab/` only |

---

## Relationship to V1

```
┌─────────────────────────────────────────────────────────┐
│  V1 (web/) — FROZEN for lab purposes                    │
│  Production until module migration approved             │
└─────────────────────────────────────────────────────────┘
                          │
                          │  Future: module-by-module
                          ▼
┌─────────────────────────────────────────────────────────┐
│  V2 Lab (portal-v2-lab/) — Independent                  │
│  No shared code path with V1 during development         │
└─────────────────────────────────────────────────────────┘
```

V1 and V2 may share **the same Supabase project** in production eventually, but lab development must not require editing V1 files.

---

## Awaiting Approval

This vision document is **planning only**. No code, folders, or localhost have been created. Proceed to scaffold only after PO approval of TICKET-V2-LAB-FOUNDATION-001.
