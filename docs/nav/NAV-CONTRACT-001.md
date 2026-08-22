# NAV-CONTRACT-001 — Frozen Main Navigation Contract

**Status:** ACTIVE — main navigation is **frozen**.  
**Scope:** Public `#mainNav` desktop row (Miami DJ Beat unified header).  
**Last updated:** 2026-06-03

---

## 1. Frozen state

The primary navigation contract is **sealed**. No drive-by edits, page-local variants, or parallel restoration systems.

Any change that affects navigation behavior, tab visibility, tab order, href targets, or layout stability requires **prior audit** and explicit human approval before commit, push, or deploy.

---

## 2. Protected files and surfaces

| Surface | Path / selector | Notes |
|--------|------------------|-------|
| Shared header logic | `web/mdjb-shared-header.js` | Single source of truth for session branches, tab reveal/hide, href wiring |
| Shared header styles | `web/header-unified.css` | Guest vs buyer vs staff CSS; anti-shift rules |
| Markup | Any HTML containing `#mainNav` | Includes public pages, client journey pages, locked pages when `#mainNav` is touched |

**Out of scope for this contract (separate bars, do not merge into `#mainNav` public row):**

- Artist strip: `#mainNav-artist`, `mdj_nav=profile` satellite context
- Staff / owner secondary bar: `#owner-tabs`
- Mobile drawer: `.mobile-nav` (parity desired but not governed by this file’s edit protocol)

---

## 3. Guest / zero-login contract (8 visible tabs)

```
INICIO · SERVICIOS · EVENTOS · SHOP · ⚙️ CONFIG · TRABAJOS · CONTACTO · MI PERFIL
```

| Tab | `data-mdj-nav` / id | Guest href |
|-----|---------------------|------------|
| INICIO | `home` | `./index.html` |
| SERVICIOS | `services` | `./rentals.html` |
| EVENTOS | `venues` | `./events.html` |
| SHOP | `shop` | `./shop.html` |
| ⚙️ CONFIG | `#mainNav-config-link` / `config` | `./login.html` (protected entry — **not** `client-account.html`) |
| TRABAJOS | `jobs` | `./jobs.html` |
| CONTACTO | `contact` | `./contact.html` |
| MI PERFIL | `#mainNav-guest-mi-perfil-link` / `my-profile` | `./login.html` |

**Hidden in guest (must not appear in the public `#mainNav` row):**

- MI PORTAL (`#mainNav-mi-portal-link`)
- DJ TOOLS (`data-mdj-nav="tools"`)
- STAFF (`#mainNav-staff-link`, `#mainNav-staff-or-profile`)

**Implementation reference (do not fork):** `mdjRevealGuestRoleEntryNav()`, `mdjRevealGuestMiPerfilNavSlot()`, guest CSS block in `header-unified.css` (`body:not(.mdj-buyer-session):not(.mdj-is-client)`).

**Known boot guard:** `mdjStripPublicEventsFromMainNav()` must **not** remove `a[data-mdj-nav="venues"]` on the six public pages (`mdjIsZeroLoginGuestNavPage()`).

---

## 4. Logged-in client (buyer) contract (8 visible tabs)

```
INICIO · SERVICIOS · EVENTOS · SHOP · ⚙️ CONFIG · TRABAJOS · CONTACTO · MI PORTAL
```

| Tab | Notes |
|-----|-------|
| ⚙️ CONFIG | `data-mdj-nav="client-config"` → `./client-account.html` |
| MI PORTAL | `#mainNav-mi-portal-link` → `./client-portal.html` (or session-resolved href) |
| MI PERFIL (guest slot) | **Hidden** — `#mainNav-guest-mi-perfil-link` must not show for buyer session |

**Implementation reference (do not fork):** `mdjApplyBuyerSessionMainNav()`, `mdjApplyBuyerConfigMainNavLink()`, `body.mdj-buyer-session` / `body.mdj-is-client` CSS.

---

## 5. Prohibitions

The following are **forbidden** without a scoped ticket + Captain/Architect approval + prior audit:

1. **Page-local nav variants** — different tab sets or order per `index.html`, `rentals.html`, `events.html`, etc., beyond the shared HTML skeleton + shared JS/CSS.
2. **Duplicated navigation logic** — second copies of reveal/hide/order/href rules in page scripts, fragments, or inline `<script>` blocks.
3. **`removeChild` / DOM deletion of tabs from page scripts** — e.g. stripping `venues` outside `mdjb-shared-header.js`.
4. **Inline restorers** — `mdj-vista-cero-guest-nav-restore` or similar per-page boot patches that fight hydration.
5. **Unauthorized local CSS** on `#mainNav`, `.header-nav`, `.top-nav` in individual HTML files or page-scoped `<style>` blocks.
6. **Reintroducing parallel systems** — new guest-nav restorers, buyer-nav injectors, or carousel-specific tab surgery outside the two protected shared files (unless ticket explicitly expands scope).

---

## 6. Future change protocol

Before editing protected surfaces:

1. **Prior audit** — document current guest, buyer, artist, and staff behavior; identify exact function/selectors and regression risk (layout shift, hydration race).
2. **Minimal diff** — only the agreed selectors/functions; no refactors, no “consistency” drive-bys.
3. **QA matrix (mandatory)**  
   - **Guest:** 8-tab contract, CONFIG → login, MI PERFIL → login, MI PORTAL / DJ TOOLS / STAFF hidden.  
   - **Logged-in client:** 8-tab buyer contract, CONFIG → client account, MI PORTAL visible, guest MI PERFIL hidden.  
   - **Artist / staff / owner:** confirm secondary bars unchanged; no duplicate public tabs.
4. **Human approval** — explicit OK for file list; separate **`APROBADO PUSH`** / **`APROBADO DEPLOY PRODUCCIÓN`** per repo workflow rules.
5. **Deliverable** — files touched, function/selector changed, BEFORE/AFTER menu strings, rollback note.

---

## 7. Related incidents (reference)

| ID | Summary |
|----|---------|
| PROD-BLOCKER-001 | Guest regression: buyer markup + CSS/JS revealed CONFIG/MI PORTAL for guests |
| PROD-BLOCKER-001-FIX-2 | EVENTOS removed by `mdjStripPublicEventsFromMainNav()` on public pages without compact-nav guard; restored via `mdjIsZeroLoginGuestNavPage()` + `mdjRevealGuestRoleEntryNav()` |

---

## 8. Governance

- **Product owner (Captain):** approves contract changes and scope expansion.  
- **Technical lead (Architect):** approves implementation approach and anti-shift rules.  
- **Agents / engineers:** read this file before any `#mainNav` or shared-header work; stop if ticket scope does not name protected files explicitly.

**No commit, push, or deploy is implied by this document alone.**
