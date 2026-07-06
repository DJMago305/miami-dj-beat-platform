# Miami DJ Beat — Portal Architecture V2 Lab
## 03 — Development Rules

**Ticket:** TICKET-V2-LAB-FOUNDATION-001  
**Applies to:** `portal-v2-lab/` only (when scaffolded)  
**Does NOT apply as license to edit V1**

---

## Rule Zero — Isolation

> The lab **never** modifies V1.

| Path | Lab may touch? |
|------|----------------|
| `portal-v2-lab/` | Yes (after scaffold approval) |
| `web/` | **No** |
| `supabase/` | **No** (unless separate migration ticket) |
| `edge-functions/` | **No** (unless separate ticket) |
| `production/`, `localhost/`, `invoice/` | **No** |
| Existing `docs/` outside `docs/V2-LAB/` | **No** |

---

## Code Origin

1. **No direct copy** from `web/` into the lab.
2. Reimplementation from **spec + PO approval** only.
3. If PO authorizes selective reuse, document in lab ADR: source file, reason, diff review, expiry.
4. Shared npm packages (if any) must be **new packages**, not symlinks into `web/`.

---

## Language & Copy

| Surface | Language |
|---------|----------|
| UI strings (canonical) | English (`en`) |
| UI strings (secondary) | Spanish (`es`) |
| Code, types, functions | English |
| Legal / official documents | English preferred |
| Commit messages | English, conventional |

Add English i18n keys first; Spanish follows.

---

## Portal Separation Rules

### Client Portal developers MUST NOT

- Import from `artist/` or `staff/`
- Render owner strip or staff CTAs
- Call staff-only RPCs from UI without guard (UI should not call them at all)

### Artist Portal developers MUST NOT

- Import staff admin modules
- Embed client checkout flows as primary navigation
- Grant SoundForTips™ without `dj_soundfortips_plan_ok` equivalent

### Staff Portal developers MUST NOT

- Import artist creative editors as default landing
- Bypass `is_staff_management` for invoice/manual write flows
- Block auth gate with heavy catalog loads before gate clear

### Shared Core developers MUST NOT

- Import portal-specific pages
- Hardcode routes belonging to a single portal in non-configurable core
- Add `#mainNav` or V1-specific selectors

---

## Authentication Development

- Hydrate session before routing decisions
- Treat `INITIAL_SESSION` separately from `SIGNED_IN`
- Route guards use DB snapshot, not JWT alone
- Failed staff gate → sign out + public redirect (same semantics as V1 constitution)

---

## Navigation Development

- Primary nav: fixed geometry — no layout shift on active state
- Desktop menu items: minimum **12ch** width floor
- Active underline pseudo-element always present (invisible when inactive)
- Shell HTML includes hardcoded nav labels before i18n hydrates
- Lifecycle: **emit/listen contracts** — no poll-based reorder for primary nav

---

## Permissions Development

- Read `mdj_access_snapshot()` (or lab equivalent client) at shell boot
- Map roles: buyer, performer, staff (owner/admin/manager/seller)
- Commercial tiers: client VIP ≠ artist PRO ≠ staff free access
- Red zone changes require ticket ID in commit message and PO sign-off

---

## Git & Deploy (Lab)

| Action | Requirement |
|--------|-------------|
| Commit | Only when PO requests in ticket |
| Push | `APROBADO PUSH` |
| Production deploy | `APROBADO DEPLOY PRODUCCIÓN` |
| Lab deploy | Separate preview; never auto-replace V1 |

---

## Pull Request Standards

1. State portal affected: client | artist | staff | shared
2. List files touched — all under `portal-v2-lab/`
3. Confirm **no V1 paths** in diff
4. Manual QA checklist from `07-QUALITY-GATES.md`
5. Screenshots for nav geometry (desktop + mobile)

---

## Dependency Rules

- No dependency on V1 script tags or global `window.MDJ_*` from `web/`
- Supabase anon key: env-based, not committed
- Pin major versions; document upgrades in lab changelog

---

## Documentation Rules

- Lab ADRs live in `portal-v2-lab/docs/adr/` (when scaffold exists)
- Foundation docs live in repo `docs/V2-LAB/` (this set)
- Do not edit existing repo docs outside `docs/V2-LAB/` without ticket

---

## Review Gates

Every lab PR requires:

- [ ] Zero files changed outside `portal-v2-lab/` and authorized `docs/V2-LAB/`
- [ ] Portal boundary check passed
- [ ] No copied V1 file without ADR
- [ ] i18n keys added EN first
- [ ] Permission matrix spot-check for changed routes

---

## Escalation

If lab work **requires** a V1 change:

1. Stop implementation
2. Open separate V1 ticket
3. Wait for PO + Architect written scope expansion
4. Lab ticket remains blocked until V1 work is independent or merged
