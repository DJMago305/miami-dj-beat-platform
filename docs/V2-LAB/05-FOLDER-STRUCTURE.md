# Miami DJ Beat — Portal Architecture V2 Lab
## 05 — Folder Structure

**Ticket:** TICKET-V2-LAB-FOUNDATION-001  
**Status:** Documented only — **folders not created**

---

## Root Layout (Future)

All lab code lives under a **single root** sibling to `web/`, not inside it:

```
miami-dj-beat-platform/
├── web/                    ← V1 FROZEN (lab does not touch)
├── docs/
│   └── V2-LAB/             ← Foundation docs (this ticket)
└── portal-v2-lab/          ← FUTURE — independent lab root
    ├── client/
    ├── artist/
    ├── staff/
    ├── shared/
    ├── assets/
    └── docs/
```

---

## `portal-v2-lab/` — Top Level

| Path | Purpose |
|------|---------|
| `client/` | Buyer / VIP portal application |
| `artist/` | DJ / performer portal application |
| `staff/` | Owner, admin, manager, seller portal application |
| `shared/` | Cross-portal core library |
| `assets/` | Lab-owned static assets (fonts, icons, media) |
| `docs/` | Lab ADRs, runbooks, portal READMEs |

Optional future siblings (separate tickets): `package.json`, `turbo.json`, `.env.example`, `playwright/`

---

## `client/` — Client Portal

```
client/
├── index.html              # or Vite entry — shell only when built
├── routes/                 # Client-only pages
├── layouts/                # Buyer layouts (no owner strip)
├── features/               # Bookings, orders, VIP, account
└── portal.config.ts        # Portal id, public routes, feature flags
```

**Contains:** buyer account, shop checkout UX, event history, VIP crown UI  
**Must not contain:** `staff/`, artist owner strip, admin modules

---

## `artist/` — Artist Portal

```
artist/
├── index.html
├── routes/
├── layouts/                # Layout with artist nav slot
├── features/
│   ├── profile/            # Public + owner profile management
│   ├── dashboard/          # Agenda, flow tab entry
│   ├── soundfortips/       # PRO-gated
│   ├── cash-flow/
│   ├── dj-tools/
│   └── academia/
└── portal.config.ts
```

**Contains:** 10-pillar nav, artist tools, PRO gates  
**Must not contain:** staff admin SPA, client-only checkout as home

**Navigation:** emits surface-ready events; consumes `shared/navigation/artist-nav`

---

## `staff/` — Staff Portal

```
staff/
├── index.html
├── routes/
├── layouts/                # Staff shell (auth gate first)
├── features/
│   ├── dashboard/          # Admin home
│   ├── leads/
│   ├── billing/            # Red zone — ticket required
│   ├── contracts/
│   ├── sellers/            # Seller-limited views
│   └── staff/              # #staff entry equivalent
└── portal.config.ts
```

**Contains:** role-differentiated UI on shared staff core  
**Roles:** owner, admin, manager (full), seller (limited via `is_staff` without management writes)

**Must not contain:** artist profile editor as default; client shop

---

## `shared/` — Shared Core

```
shared/
├── core/
│   ├── constants/
│   ├── env/
│   ├── events/             # PORTAL_SURFACE_READY, etc.
│   └── utils/
├── components/
│   ├── Button/
│   ├── Modal/
│   ├── DataTable/
│   └── ...
├── navigation/
│   ├── contracts/          # Emit/listen specs
│   ├── ArtistNav/
│   ├── ClientNav/
│   └── StaffNav/
├── authentication/
│   ├── session/
│   ├── gates/
│   └── sign-out-redirect/
├── permissions/
│   ├── snapshot/           # mdj_access_snapshot client
│   ├── guards/
│   └── role-matrix.ts
├── services/
│   ├── supabase/
│   ├── edge/
│   └── modules/            # bookings, profiles, etc.
├── design-system/
│   ├── tokens/
│   ├── typography/
│   ├── themes/
│   └── globals.css         # Lab-only tokens — not V1 import
└── i18n/
    ├── en/
    └── es/
```

**Rule:** Nothing in `shared/` imports from `client/`, `artist/`, or `staff/`.

---

## `assets/`

```
assets/
├── fonts/
├── icons/
├── brand/
└── images/
```

Lab-owned copies of brand assets. **Do not** symlink `web/assets` or `web/images`.

---

## `portal-v2-lab/docs/`

```
portal-v2-lab/docs/
├── adr/                    # Architecture Decision Records
├── runbooks/
│   ├── local-dev.md
│   └── preview-deploy.md
├── portals/
│   ├── client.md
│   ├── artist.md
│   └── staff.md
└── CHANGELOG.md
```

Distinct from repo-level `docs/V2-LAB/` (foundation). Lab docs are created with scaffold ticket.

---

## Import Boundaries (Enforced)

```
allowed:
  client  → shared
  artist  → shared
  staff   → shared

forbidden:
  client  → artist | staff
  artist  → client | staff
  staff   → client | artist
  shared  → client | artist | staff
  portal-v2-lab → web
  web → portal-v2-lab (during parallel operation)
```

Enforcement: ESLint `import/no-restricted-paths` or monorepo package boundaries (scaffold ticket).

---

## Deploy Artifacts (Future)

Each portal may produce:

```
dist/client/
dist/artist/
dist/staff/
```

Or single host with path prefixes — **ADR required** before scaffold.

---

## Relation to V1 Paths

| V1 | V2 lab (conceptual) |
|----|---------------------|
| `web/dj-profile.html` | `artist/features/profile/` |
| `web/client-portal.js` | `client/features/` |
| `web/admin-dashboard.html` | `staff/features/dashboard/` |
| `web/mdj-shared-header.js` | `shared/navigation/` + portal shells |
| `web/auth.js` | `shared/authentication/` |

Mapping is **reference only** for migration planning — not copy instructions.

---

## Not Created in This Ticket

- No `portal-v2-lab/` directory on disk
- No `package.json`, HTML, CSS, or JS
- No localhost config

Await PO approval to open scaffold ticket.
