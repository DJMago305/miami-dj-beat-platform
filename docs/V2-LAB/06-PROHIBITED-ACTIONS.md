# Miami DJ Beat — Portal Architecture V2 Lab
## 06 — Prohibited Actions

**Ticket:** TICKET-V2-LAB-FOUNDATION-001  
**Scope:** All contributors to V2 lab and foundation work

---

## Absolute Prohibitions

The following actions are **forbidden** without explicit Product Owner + Architect written authorization in a ticket.

### V1 Integrity

| # | Prohibited action |
|---|-------------------|
| P-01 | Modify any file under `web/` for lab convenience |
| P-02 | Modify `supabase/` migrations or scripts to “support lab” without dedicated DB ticket |
| P-03 | Modify `edge-functions/` for lab without dedicated Edge ticket |
| P-04 | Touch `production/`, `localhost/`, or `invoice/` for lab work |
| P-05 | Edit existing documentation outside `docs/V2-LAB/` |
| P-06 | Copy-paste files from `web/` into lab without reuse ADR + PO approval |
| P-07 | Symlink or alias `web/` into `portal-v2-lab/` |
| P-08 | Import V1 CSS (`styles.css`, `header-unified.css`, `profile.css`) into lab bundles |
| P-09 | Share global namespace with V1 (`window.__mdj*` collision by loading both trees) |
| P-10 | Patch V1 to “bridge” lab features (dual nav, dual auth) |

### Deploy & Git

| # | Prohibited action |
|---|-------------------|
| P-11 | `git push` without **`APROBADO PUSH`** |
| P-12 | Production deploy without **`APROBADO DEPLOY PRODUCCIÓN`** |
| P-13 | Auto-deploy lab to V1 production URL |
| P-14 | Commit secrets (`.env`, service keys) |
| P-15 | Force push to `main` / `master` |
| P-16 | Commit foundation or lab work without PO request in ticket |

### Structure & Scope

| # | Prohibited action |
|---|-------------------|
| P-17 | Create `portal-v2-lab/` before scaffold ticket approval |
| P-18 | Rename or move existing repo folders for lab |
| P-19 | Migrate by **single loose files** (must be full modules) |
| P-20 | Collapse three portals into one SPA without ADR |
| P-21 | Add staff tools to client portal “temporarily” |
| P-22 | Add artist owner strip to staff portal |
| P-23 | Embed admin dashboard in artist portal iframe as shortcut |

### Security & Permissions (Red Zone)

| # | Prohibited action |
|---|-------------------|
| P-24 | Client-side-only staff gates without RLS |
| P-25 | Trust JWT `app_metadata.role` without DB snapshot |
| P-26 | Ship staff write UI without `is_staff_management` check |
| P-27 | Alter leads / billing / contracts / payments RLS in lab ticket |
| P-28 | Update `auth.users.app_metadata` from SQL Editor |
| P-29 | Block staff auth gate with heavy loads before gate clear |
| P-30 | Redirect owner STAFF link to `account-profile.html` |

### Navigation & UX Regressions

| # | Prohibited action |
|---|-------------------|
| P-31 | Poll-based primary nav reorder (V2 uses explicit contracts) |
| P-32 | Remove hardcoded nav text before i18n (empty menu flash) |
| P-33 | Use `min-width: 0` or `width: auto` on desktop header nav links |
| P-34 | Omit inactive active-underline slot (layout shift) |
| P-35 | Show duplicate `#mainNav` + `#owner-tabs` on satellite pages |

### Product & SoundForTips

| # | Prohibited action |
|---|-------------------|
| P-36 | Grant SoundForTips™ from generic subscription flag alone |
| P-37 | Expose SFT without `dj_soundfortips_plan_ok` equivalent |
| P-38 | Treat client VIP as artist PRO |

### Process

| # | Prohibited action |
|---|-------------------|
| P-39 | “Drive-by” refactors in V1 while doing lab work |
| P-40 | Expand scope without Capitán + Architect written OK |
| P-41 | Delete V1 modules before stability window ends |
| P-42 | Run lab localhost on port 8080 reserved for V1 physical files rule |

---

## Lab-Specific Prohibitions (After Scaffold)

| # | Prohibited action |
|---|-------------------|
| L-01 | `shared/` importing portal pages |
| L-02 | Cross-portal imports (client → artist, etc.) |
| L-03 | Monolith bundle merging all three portals without code-split ADR |
| L-04 | Using V1 `?v=2026...` cache bust comments as copy source |
| L-05 | Editing locked V1 HTML structure as migration “template” |

---

## Authorization Phrases (Exact)

| Action | Required phrase |
|--------|-----------------|
| Push | `APROBADO PUSH` |
| Production merge/deploy | `APROBADO DEPLOY PRODUCCIÓN` |

Vague requests (“subir”, “publicar”) are **not** authorization.

---

## Violation Response

1. Revert offending change immediately
2. Document incident in lab ADR or ticket comment
3. Block dependent work until PO review
4. Re-audit quality gates before resume

---

## This Ticket Compliance

TICKET-V2-LAB-FOUNDATION-001 itself prohibits:

- Implementation code
- HTML / CSS / JS generation
- Folder creation (`portal-v2-lab/`)
- Commits, push, deploy
- Modifying existing project documentation

Only `docs/V2-LAB/*.md` creation is authorized.

---

## Awaiting Approval

PO must acknowledge prohibited-actions list before lab scaffold ticket opens.
