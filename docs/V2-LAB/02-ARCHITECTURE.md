# Miami DJ Beat — Portal Architecture V2 Lab
## 02 — Architecture

**Ticket:** TICKET-V2-LAB-FOUNDATION-001  
**Status:** Planning — no implementation

---

## System Overview

```
                    ┌──────────────────────────────────────┐
                    │         Supabase (Backend)           │
                    │  Auth · RLS · RPC · Edge Functions   │
                    └─────────────────┬────────────────────┘
                                      │
                    ┌─────────────────▼────────────────────┐
                    │           Shared Core                  │
                    │  auth · permissions · i18n · theme   │
                    │  design-system · api-services        │
                    └─────────┬──────────┬─────────┬───────┘
                              │          │         │
              ┌───────────────▼──┐  ┌────▼────┐  ┌─▼──────────────┐
              │  Client Portal   │  │ Artist  │  │ Staff Portal   │
              │  (buyer/VIP)     │  │ Portal  │  │ owner/admin/   │
              │                  │  │         │  │ manager/seller │
              └──────────────────┘  └─────────┘  └────────────────┘
```

Each portal is a **deployable boundary** (separate entry, separate bundle, separate nav tree). Shared Core is a **library**, not a fourth portal.

---

## Layer Model

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Presentation** | `client/`, `artist/`, `staff/` | Routes, pages, portal-specific layouts |
| **Shared UI** | `shared/components/` | Buttons, modals, tables, nav primitives |
| **Navigation** | `shared/navigation/` | Portal nav configs; lifecycle events (V2 contracts) |
| **Authentication** | `shared/authentication/` | Session hydrate, sign-in/out, gate helpers |
| **Permissions** | `shared/permissions/` | `mdj_access_snapshot` client, role guards, route ACL |
| **Services** | `shared/services/` | Supabase client, Edge invoke, typed API modules |
| **Design System** | `shared/design-system/` | Tokens, typography, spacing, motion rules |
| **Core** | `shared/core/` | Constants, env, event bus, utilities (no DOM pages) |
| **Assets** | `assets/` | Fonts, icons, brand media (lab-owned) |
| **Docs** | `docs/` (inside lab) | Lab runbooks, ADRs, portal specs |

---

## Portal Boundaries

### Client Portal

| Allowed | Forbidden |
|---------|-----------|
| Account profile, orders, bookings | `#owner-tabs`, STAFF tab, admin dashboard |
| VIP loyalty UI | Artist Cash Flow, SoundForTips™ artist console |
| Shop checkout (buyer path) | Staff invoice / production modules |
| Public marketing deep-links | `is_staff_management` write surfaces |

**Identity:** `client_profiles`, MDJB suffix **C**. Principal: `buyer`.

### Artist Portal

| Allowed | Forbidden |
|---------|-----------|
| Owner strip (10 pillars), agenda, profile edit | Staff admin panel as embedded iframe |
| Cash Flow (artist economic tab) | Client portal account settings duplication |
| SoundForTips™ (PRO via `dj_soundfortips_plan_ok`) | Seller-limited staff tools |
| DJ Tools, Academia (artist context) | Cross-login to staff without role gate |

**Identity:** `dj_profiles`, tiers LITE/PRO/ELITE, MDJB suffix **A**. Principal: `performer`.

**Navigation contract (V2):** each surface emits readiness (e.g. `OWNER_STRIP_READY`) when auth + profile + strip DOM are satisfied. Header/shared nav **listens**; never polls.

### Staff Portal

| Allowed | Forbidden |
|---------|-----------|
| Admin dashboard, manager flows, seller-limited views | Artist profile editor as default home |
| Leads, billing, contracts (RLS-gated) | Client shop checkout |
| Shared staff core for owner/admin/manager/seller | Owner strip on artist pages |

**Identity:** `dj_profiles` with role in `owner|admin|manager|seller`, MDJB suffix **S** or **M**. Principal: `staff`.

**Permission tiers:**

| Role | Scope |
|------|-------|
| `seller` | `is_staff()` — read/moderate, limited writes |
| `owner`, `admin`, `manager` | `is_staff_management()` — full production writes |

---

## Shared Core Modules

### Authentication

- Single Supabase client factory per portal shell
- Distinguish `INITIAL_SESSION` vs `SIGNED_IN` (no premature redirects)
- Session snapshot via `public.mdj_access_snapshot()` RPC
- Never trust `app_metadata.role` without DB validation

### Permissions

- Route guards consume snapshot + Postgres-backed checks
- UI hides disallowed actions; RLS enforces writes
- Red zone: leads, billing, contracts, payments — changes require explicit ticket

### Design System

- Miami DJ Beat visual identity: gold accent, dark surfaces, Cinzel/Playfair where specified
- Anti layout-shift rules for primary nav (12ch min, active underline always reserved)
- Mobile-first; hamburger contract per portal

### Services

- Typed wrappers for Supabase tables, RPC, Edge Functions
- HTTP ≠ 200 → surface `error` / `detail` from body
- No `/web/` path assumptions; public URLs are `/pagina.html` equivalent per deploy root

### Internationalization

- English canonical keys first; Spanish in secondary catalog
- Hardcoded fallback text in shell HTML for nav (anti empty-menu flash)
- Runtime fallback to alternate locale when key missing

### Theme

- CSS variables / design tokens owned by lab
- No import from `web/styles.css` or `web/header-unified.css`

---

## Event-Driven Lifecycle (V2 Contract Pattern)

Generalization of CONTRATO V2 from owner strip:

```
Page/Surface                    Shared Navigation
     │                                │
     │  emit PORTAL_SURFACE_READY     │
     │  (auth + data + DOM gate)      │
     ├───────────────────────────────►│ listener (once)
     │                                │ apply nav order / patches
     │                                │ clear visual blocker
```

Rules:

1. **Emitter** lives in the surface that knows when gates pass.
2. **Receiver** lives in shared navigation — no poll, no MutationObserver for primary ordering.
3. `{ once: true }` + idempotent guard flags on both sides.
4. Catch-up if emit precedes listener registration.

Portal-specific event names TBD in lab ADRs (e.g. `ARTIST_NAV_READY`, `STAFF_SHELL_READY`).

---

## Deployment Topology (Future)

| Target | Notes |
|--------|-------|
| Lab | Separate origin or path prefix (e.g. `v2-lab.miamidjbeat.com`) |
| Production cutover | Per-module DNS or route flip after QA |
| V1 | Remains on current Vercel root (`web/`) until module retired |

Lab must not configure production secrets or deploy without `APROBADO DEPLOY PRODUCCIÓN`.

---

## Data & Backend

- Same Supabase project as V1 is acceptable for lab **read/integration** tests
- Lab must not apply migrations to production DB without PO authorization
- Edge Functions: lab calls existing functions; new functions live in repo only when ticket includes `supabase/` scope (out of lab foundation scope)

---

## Security Invariants (from V1 constitution)

1. `public.is_staff(uid)` — sole operational truth for staff visibility
2. Non-staff attempting staff routes → `signOut` + redirect to public entry
3. Owner STAFF nav → `./admin-dashboard.html#staff`, never `account-profile.html`
4. No heavy script before admin auth gate clears on staff dashboard equivalent
5. MDJB account IDs: `MDJB-XXXX-XXXX-C|A|S|M`

---

## Technology Choices (Recommended — Lab ADR pending)

Document only; **not decided until PO approves scaffold ticket.**

| Area | Recommendation | Rationale |
|------|----------------|-----------|
| Build | Vite or equivalent ESM bundler | Multi-portal code splitting |
| Language | TypeScript | Permissions + API typing |
| Styling | CSS modules or scoped tokens | No global V1 CSS bleed |
| State | Lightweight (context + query) | Avoid monolith global `window.__mdj*` |
| Testing | Playwright per portal | Role-matrix E2E |

Final stack approval is a separate ticket after foundation sign-off.
