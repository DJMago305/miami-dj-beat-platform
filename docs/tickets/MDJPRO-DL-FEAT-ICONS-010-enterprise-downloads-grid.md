# MDJPRO-DL-FEAT-ICONS-010 — Enterprise icons (downloads feature grid)

**Status:** **IN PROGRESS** (localhost QA **APPROVED** by Captain — 2026-06-11)  
**Priority:** Cosmetic / product polish (web only)  
**Branch:** `cosmetic/mdjpro-dl-feat-icons-010`  
**Prod:** **NOT deployed** — accumulate commits on branch; **single push at end of ticket** (see §6)

---

## 1. Summary

Replace cartoon emoji (“muñequitos / billing Disney”) in the **MDJPRO Features** grid on `downloads.html` with **gold stroke SVG icons** scoped to the downloads page — Miami DJ Beat PRO / enterprise tone.

**Correct URL (local):** `http://localhost:8080/downloads.html` → tab **Funciones de MDJPRO** → `#whats-new` grid.

---

## 2. Captain contract

| Rule | Detail |
|------|--------|
| **Zone** | `web/downloads.html` feature grid only (+ i18n titles that feed that grid) |
| **Style** | SVG stroke `#c5a059` / `var(--gold)` in 44×44 glass box — page-scoped CSS |
| **No global CSS** | Do not edit `web/styles.css` |
| **No push per micro-change** | Work lands on branch; **one push** when ticket closes (Captain **`APROBADO PUSH`**) |
| **Prod freeze** | No Vercel deploy until **`APROBADO DEPLOY PRODUCCIÓN`** after batch review |
| **Rollback (wrong zone)** | Prior attempt on `dj-profile.html` `#tab-software` was **reverted** — orphan panel, not user path |

---

## 3. Deliverables

### 3.1 Done — Phase A (Captain **APPROVED**)

| File | Change |
|------|--------|
| [`web/downloads.html`](../../web/downloads.html) | 6× `.mdjpro-feat-icon` SVG blocks replace emoji divs in `#whats-new` |
| [`web/downloads.html`](../../web/downloads.html) | CSS in `#downloads-mobile-safeguard`: `body.downloads-page .mdjpro-feat-icon` |
| [`web/translations.js`](../../web/translations.js) | `feat-*-title` — emoji removed (ES + EN) |
| [`web/downloads.html`](../../web/downloads.html) | Cache bust: `translations.js?v=20260611-dl-feat-icons-1` |

### 3.2 Done — Phase B (localhost QA pending)

| File | Change |
|------|--------|
| [`web/dj-tools.html`](../../web/dj-tools.html) | 4× Pro Features grid → `.mdjpro-feat-icon` SVG (folder, tag, matrix, chart) |
| [`web/dj-tools.html`](../../web/dj-tools.html) | Client gate 🔒 → lock SVG; pricing table ✅ → stroke check SVG |
| [`web/load-root.html`](../../web/load-root.html) | Hub mock preview 📁🪄🏷️ → folder / matrix / tag SVG |

### 3.3 Done — Phase C (localhost QA pending)

| File | Change |
|------|--------|
| [`web/account-settings.html`](../../web/account-settings.html) | `#panel-billing` subscription cards → `.acct-sub-icon` gold SVG (star sin emoji/etiqueta, sliders MDJPRO, birrete Academia) |

**Icon mapping**

| Feature | SVG concept |
|---------|-------------|
| Library Wizard | 2×2 matrix grid |
| Risk Control | Shield + check |
| Sync Matrix | Bidirectional arrows |
| Muscle Memory / screenless | Target / crosshair |
| Tag Dictionary | Hex tag |
| Hardware Elite | Mixer sliders |

### 3.4 Explicitly NOT modified

- `web/dj-profile.html` (reverted; no owner-tab path to `#tab-software` grid)
- `web/dj-tools.html`, `web/styles.css`, Supabase, Mac `~/Desktop/MDJ`
- Manuals print HTML (separate emoji policy if ever needed)

### 3.5 Optional future phases (same ticket, same branch)

| Phase | Scope | Status |
|-------|-------|--------|
| D | `tag-master.html`, `library-wizard.html`, `cash-flow.html` mock visuals (if any) | **Deferred** |
| E | Align `dj-profile.html` `#tab-software` grid **only if** product wires that tab | **Deferred** |
| F | Site-wide emoji (cart 🛒, booth 🤖, services cards) | **Out of scope** — new ticket |

---

## 4. QA (localhost)

1. Open `http://localhost:8080/downloads.html`
2. Hard refresh (**Cmd+Shift+R**)
3. Tab **Funciones de MDJPRO** — 6 cards show gold SVG icons, **no emoji** in titles after i18n runs

**Captain sign-off:** Phase A **approved** (session 2026-06-11).

---

## 5. Git workflow (batch push)

```
Branch:  cosmetic/mdjpro-dl-feat-icons-010
Commit:  when Captain asks (not per cosmetic tweak)
Push:    only with literal APROBADO PUSH at ticket close
Deploy:  only with APROBADO DEPLOY PRODUCCIÓN
```

Suggested commit message when batching:

```
cosmetic(downloads): enterprise SVG icons on MDJPRO features grid (010)
```

---

## 6. Rollback

| Action | Command / file |
|--------|----------------|
| Revert Phase A | `git checkout main -- web/downloads.html web/translations.js` |
| Wrong-zone (already done) | `dj-profile.html` restored from `main` |

---

## 7. Related docs

- [MDJPRO-TICKET-STATUS.md](./MDJPRO-TICKET-STATUS.md)
- [MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md](./MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md)
- [workflow-control.md](../workflow-control.md) §7 deploy gates
