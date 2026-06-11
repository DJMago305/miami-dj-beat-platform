# MDJPRO-SUITE-ENTERPRISE-WEB-009 — Informative enterprise pages + DJ Tools 4-card hub

**Status:** **DONE** (2026-06-11)  
**Priority:** Product / marketing (web only)  
**Author:** Captain + Architect (session closure)  
**Prod:** **Not deployed** until separate `APROBADO PUSH` / `APROBADO DEPLOY PRODUCCIÓN`

---

## 1. Summary

Four **informative enterprise pages** for MDJPRO Suite modules (same pattern as Library Wizard / Tag Master), plus a **4-card hub** on `dj-tools.html` with bottom-aligned CTAs. **No Mac app logic**, **no Supabase**, **no Cash Flow runtime**, **no auth/nav restructure**.

---

## 2. Captain contract (what was in scope)

| Rule | Detail |
|------|--------|
| **Informative only** | Marketing + audit-style copy; no gates, no `flow-handler`, no `ScanStore` |
| **Wide layout** | ~`min(1720px, 97vw)` — page-scoped `<style>` only |
| **i18n** | Keys in `translations.js` (EN canonical + ES) |
| **DJ Tools cards** | Teaser + CTA → dedicated `.html` page per module |
| **Load Root correction** | 4th card **left**; existing 3 cards shift right; `grid3` → `grid4` |
| **CTA alignment** | Equal-height tiles; buttons on same baseline with breathing room |
| **Forbidden** | `styles.css` global edits, locked HTML nav, Mac `~/Desktop/MDJ`, Supabase migrations |
| **Public copy** | Solo flujo **artista** — ver [PUBLIC-ARTIST-COPY-NOTE](./MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md) · **nunca** Terminal/taller en web |

---

## 3. Deliverables

### 3.1 Enterprise pages (new)

| Page | Theme | Mac / Web | Gate (real product) |
|------|-------|-----------|---------------------|
| [`web/load-root.html`](../../web/load-root.html) | Orange | **Mac** Hub step 1 | Basic / Premium (`basicScan`) |
| [`web/tag-master.html`](../../web/tag-master.html) | Purple | Mac | Premium (`tagMaster`) |
| [`web/library-wizard.html`](../../web/library-wizard.html) | Gold | Mac | Premium (`libraryWizard`) |
| [`web/cash-flow.html`](../../web/cash-flow.html) | Gold | **Web** SaaS | Owner artist LITE+ |

Each page includes: hero, glass note, 6 pillars, workflow steps, «What it is not» / roadmap panels, status table, CTAs.

### 3.2 DJ Tools hub (`web/dj-tools.html`)

**Order (left → right):**

1. **Load Root** → `./load-root.html` — *Explorar Load Root*
2. **Tag Master** (Limpieza de Librería) → `./tag-master.html`
3. **Library Wizard** (Crates Inteligentes) → `./library-wizard.html`
4. **Cash Flow** (Salud y economía) → `./cash-flow.html`

**Layout fix (same ticket):**

- `body.page-dj-tools .grid4 > .tile` — flex column, `height: 100%`
- `.dj-tools-feature-cta` — `margin-top: auto`, `padding-top: 22px`, `padding-bottom` on tile

### 3.3 Translations (`web/translations.js`)

| Key prefix | Purpose |
|------------|---------|
| `tools-feature-lr-*` | Load Root card on DJ Tools |
| `tools-lr-*` | Load Root enterprise page |
| `tools-cf-*` | Cash Flow enterprise page |
| `tools-feature-health-teaser` | Cash Flow card teaser |
| `tools-tag-*`, `tools-wizard-*` | Tag Master / Wizard (prior session) |

Cache bust on `dj-tools.html`: `translations.js?v=20260611-load-root-web-2`

---

## 4. Explicitly NOT modified

- `~/Desktop/MDJ` — Mac MDJPRO (Load Root, Wizard, Tag Master runtime)
- `web/flow-handler.js`, `web/dj-profile.html` (Cash Flow tab gates)
- `web/styles.css` (global)
- Locked pages: `index.html`, nav architecture
- Supabase migrations / Edge / RLS

---

## 5. Local QA checklist

| # | Check |
|---|--------|
| 1 | `http://localhost:8080/dj-tools.html` — 4 cards, Load Root leftmost |
| 2 | All four «Explorar …» buttons aligned on same horizontal line |
| 3 | Air between paragraph and button; button not flush to card border |
| 4 | Each CTA opens correct page (`load-root`, `tag-master`, `library-wizard`, `cash-flow`) |
| 5 | ES/EN toggle updates card teasers and enterprise page copy |
| 6 | Hard refresh / private window if stale `translations.js` |

---

## 6. Read-only audits delivered (chat / reference)

Informative audits (not duplicated inside every page):

- **Cash Flow** — web + `dj_ledger` + SFT merge + health index
- **Load Root** — Mac `selectRootFolder` + SSB + `ScanStore.addSource`

Use audits for future copy updates; product gates remain in Mac/web runtime code.

---

## 7. Rollback

```bash
# Remove new pages (if needed)
rm web/load-root.html web/cash-flow.html
# Revert dj-tools grid + card + scoped CSS via git checkout on:
#   web/dj-tools.html web/translations.js
```

`tag-master.html` and `library-wizard.html` predate this ticket closure row; rollback only what this ticket added if Captain requests.

---

## 8. Deploy (separate approval)

| Step | Requires |
|------|----------|
| `git commit` | Captain OK on file list |
| `git push` | Literal **`APROBADO PUSH`** |
| Vercel prod | **`APROBADO DEPLOY PRODUCCIÓN`** after preview QA |

---

## 9. Related tickets

- [MDJPRO-PERMISOS-007](./MDJPRO-PERMISOS-007-runtime-permissions-ux.md) — Mac Load Root panel UX (OPEN, Mac only)
- [TICKET-004](./TICKET-004-financial-order-architecture.md) — Cash Flow ledger architecture (OPEN, backend)

---

## 10. File manifest (this ticket)

| File | Action |
|------|--------|
| `web/load-root.html` | **Created** |
| `web/cash-flow.html` | **Created** |
| `web/dj-tools.html` | **Modified** — grid4, Load Root card, CTA alignment CSS |
| `web/translations.js` | **Modified** — `tools-lr-*`, `tools-cf-*`, `tools-feature-lr-*`, health teaser |
| `web/tag-master.html` | Prior session (referenced, not re-opened) |
| `web/library-wizard.html` | Prior session (referenced, not re-opened) |
| `docs/tickets/MDJPRO-SUITE-ENTERPRISE-WEB-009.md` | **This document** |
