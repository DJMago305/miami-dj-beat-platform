# TICKET-005 — Role & Building Separation (Architecture Contract)

**Status:** OPEN — Reference document. No code changes authorized yet.
**Type:** Architecture / Governance
**Author:** Captain (product owner) + Agent session 2026-05-22

---

## The Three Buildings — Never Mix

The platform has three completely separate buildings.
Same visual architecture, different residents, different rules.

| Building | Residents | Primary Page(s) |
|---|---|---|
| **Staff** | Owner · Manager · Admin · Seller | `account-profile.html` |
| **Artists** | DJ · Talent · Performer | `dj-profile.html` · `dj-dashboard.html` |
| **Clients** | Buyers · Paying customers | `client-portal.html` |

---

## Login Routing Rules (Post-Auth Redirect)

| Role (dj_profiles.role) | Landing page | Rationale |
|---|---|---|
| `owner` | `dj-profile.html` | Owner is also the platform DJ/artist — lands in artist building |
| `admin` | `account-profile.html` | Back-office staff |
| `manager` | `account-profile.html` | Back-office staff |
| `seller` | `account-profile.html` | Back-office staff |
| `client` / buyer | `client-portal.html` | Buyer building |
| `talent` / `dj` / `artist` | `dj-profile.html` | Artist building |

**Owner special case:** Owner holds both roles — platform owner AND the primary DJ/performer.
Login must take them to the artist building (`dj-profile.html`).
The staff building (`account-profile.html`) is accessible via STAFF / CONFIG nav links, not default landing.

---

## Absolute Separation Rules

### Financial Separation
- **Client Financials** (total charged, deposits, balances) → visible ONLY to Owner / Manager / Seller inside `account-profile.html` or staff panels.
- **Talent Compensation** (DJ payout, pay status, pay date) → visible to the assigned DJ in their operational panel. Amount is what THEY get paid, not the event total.
- **Company Financials** (margins, gross, net) → Owner / Manager only.
- **Seller / Manager Commissions** → each sees only their own.
- **Ledger / Audit Trail** → append-only. Never overwrite. Never expose raw to DJ or client.

### Prohibited Patterns
- ❌ Never show event total (client charge) to the assigned DJ.
- ❌ Never show company financials or margins to clients.
- ❌ Never redirect a staff member to `client-portal.html` via `?redirect=` param injection.
- ❌ Never redirect a client to `dj-profile.html` or `account-profile.html`.
- ❌ Never merge client subscription/billing logic into the artist profile flow.
- ❌ Never infer "customer" account type for an owner/staff from `client_profiles` table existence alone.

---

## Premium Gate Rules

- **SoundForTips™ PRO gate** (`#sft-owner-lite-block`, `#sft-tab-pro-required`) is **valid and must not be bypassed** by `role === 'owner'` hardcode.
- Owner/DJ must have an **active paid MDJPRO subscription** (`is_premium = true` OR active `plan_type`) to access SFT.
- If Owner needs PRO access, it is activated in the **database** (Supabase), not in frontend code.
- `mdbProfileSoundForTipsEligible()` and Postgres `dj_soundfortips_plan_ok(uid)` remain the source of truth.

---

## Account Type Badge — `account-profile.html`

- The badge must read the **actual `dj_profiles.role`** from DB for staff users.
- Fallback: JWT `app_metadata.role`.
- Must never default to "Customer" for a confirmed staff member.
- Correct labels: `Owner` · `Admin` · `Manager` · `Seller`.

---

## Code Zones — Do Not Cross

| File | Belongs to | Other buildings must not touch it |
|---|---|---|
| `dj-profile.html` | Artists | No staff-only panels, no client billing |
| `dj-dashboard.html` | Artists | No staff financial data |
| `account-profile.html` | Staff | No artist profile sections, no client portal UI |
| `client-portal.html` | Clients | No DJ/artist data, no staff panels |
| `client-portal.js` | Clients | No staff redirect logic |
| `auth.js` | Shared | Redirect routing only; role-detection from DB, not hardcoded |

---

## Implementation Notes (Future Sub-Tickets)

| Sub-ticket | Description |
|---|---|
| TICKET-005-A | Re-implement login redirect fix (owner→dj-profile, manager/admin/seller→account-profile) with regression tests |
| TICKET-005-B | Implement staff badge detection in `account-profile.html` (dj_profiles.role + JWT fallback) |
| TICKET-005-C | Implement compact staff nav for `index.html`, `account-profile.html` (zero-space CSS, no overflow) |
| TICKET-005-D | Block `?redirect=client-portal` for all staff roles (auth.js guard) |
| TICKET-005-E | Guest MI PERFIL visible on `index.html` → `login.html` |
