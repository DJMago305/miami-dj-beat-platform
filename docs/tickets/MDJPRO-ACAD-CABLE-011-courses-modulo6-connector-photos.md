# MDJPRO-ACAD-CABLE-011 — Módulo 6 connector photos (courses.html circles)

**Status:** **DONE** — localhost complete 2026-06-12; **pending `APROBADO PUSH`**  
**Priority:** Academia UX / content visibility  
**Prod:** **NOT deployed** — work only when Captain opens this ticket  
**Related batch:** [`MDJPRO-DL-FEAT-ICONS-010`](./MDJPRO-DL-FEAT-ICONS-010-enterprise-downloads-grid.md) (separate scope)

---

## 1. Summary

On **`web/courses.html`**, **Módulo 6 — Tipos de Conexiones** (6 cards: XLR, TRS, RCA, USB, Speakon, PowerCON), decorative **circular photo wells** on the right of each card should show connector photos from `web/assets/course/`. Captain reports circles appear **empty** or show **broken-image icon** (Safari). Assets exist; HTML links are present. Fix deferred to this ticket.

**Local URL:** `http://localhost:8080/courses.html` → scroll to **Módulo 6 — TIPOS DE CONEXIONES Y CUÁNDO USARLOS**.

---

## 2. Captain contract (when ticket opens)

| Rule | Detail |
|------|--------|
| **Zone** | Módulo 6 cable cards only — 6 circle `<img>` + optional scoped CSS in `courses.html` |
| **Do not touch** | Módulo 5/7+, nav, `styles.css` global, emoji/icon batch elsewhere |
| **Assets** | `web/assets/course/cable_*.png` (6 files) — fix format/MIME, do not relocate |
| **Rollback** | Restore pre-ticket HTML + asset names if Captain rejects QA |

---

## 3. Audit findings (2026-06-11 / 2026-06-12)

### 3.1 Files and links — OK

| Asset | Path in HTML | On disk | Git tracked |
|-------|----------------|---------|-------------|
| XLR | `./assets/course/cable_xlr.png` | ✅ | ✅ |
| TRS | `cable_trs.png` | ✅ | ✅ |
| RCA | `cable_rca.png` | ✅ | ✅ |
| USB | `cable_usb.png` | ✅ | ✅ |
| Speakon | `cable_speakon.png` | ✅ | ✅ |
| PowerCON | `cable_powercon.png` | ✅ | ✅ |

`python3 -m http.server 8080` from `web/` returns **HTTP 200** for these paths.

### 3.2 Root causes (both must be addressed together)

**A — MIME / extension mismatch (broken `<img>` in Safari)**

- All six files are **JPEG data** (magic bytes `FF D8 FF…`) but named **`.png`**.
- `SimpleHTTP` serves `Content-Type: image/png` while body is JPEG.
- Safari/strict browsers show **broken-image placeholder** on `<img>` tags.
- Módulo 7 `equipo-*.png` backgrounds may still work (CSS `background-image` is more tolerant) — same JPEG-in-PNG issue possible there but **out of scope** unless Captain expands.

**B — CSS hides photos even when decode succeeds**

Original inline styles on each `<img>`:

- `opacity: 0.5`
- `mix-blend-mode: screen` (XLR, RCA) or `luminosity` (TRS, USB, Speakon, PowerCON)
- Parent circle: dark glass + `backdrop-filter: blur(6px)`

Dark connector photos on dark cards → connector **invisible** (empty glass circle).

---

## 4. Attempts log (all rolled back — Captain did not approve)

| # | Approach | Result |
|---|----------|--------|
| 1 | Remove blend; `opacity: 0.92`; `object-fit: contain` | **Not approved** — circles still empty (MIME issue not addressed) |
| 2 | Scoped `#modulo-6-cables` CSS: no blend, brighter filter, lighter circle bg | **Not approved** — broken-image icon visible (MIME) |
| 3 | Rename to `.jpg` + update `src` + cache bust | **Not approved** — rolled back to original `.png` names and HTML |

**Current repo state:** Original Módulo 6 markup restored (inline circle styles + `cable_*.png` paths). No `#modulo-6-cables` style block.

---

## 5. Recommended fix (single ticket, one QA pass)

Execute **both** steps in the same change — partial fixes failed Captain QA.

### Step 1 — Asset integrity (pick one)

| Option | Action | Pros |
|--------|--------|------|
| **A (recommended)** | Convert 6 files to **real PNG** (e.g. `sips -s format png`) keeping `.png` names | Keeps existing HTML paths; correct MIME everywhere |
| **B** | Rename to `.jpg` and update 6 `src` in `courses.html` | Fast; must update git + any future references |
| **C** | Serve via Vercel/nginx with correct `Content-Type` override | Fragile on localhost; not recommended alone |

### Step 2 — Visibility CSS (scoped to Módulo 6)

- Remove `mix-blend-mode` on `<img>`.
- Set `opacity: 1` (or ≥ `0.9`).
- Keep circle glass; optional `filter: brightness(1.2) contrast(1.1)` if photos stay dark.
- Prefer scoped class or `#modulo-6-cables` block — **no** `styles.css` global edits.

### Step 3 — QA checklist

1. `http://localhost:8080/courses.html` → Módulo 6 — **Cmd+Shift+R**
2. Módulo 7 — 5 cards show background photo (incl. **7.5** hybrid mixer)
3. DevTools → Network → filter `cable_` / `equipo_` → all **200**, `Content-Type: image/png`
3. Safari + Chrome: no broken-image icon; connector visible in all 6 circles
4. Mobile width: circles still clip correctly (`overflow: hidden` on card)

---

## 6. Files to touch (when approved)

| File | Change |
|------|--------|
| `web/assets/course/cable_xlr.png` … `cable_powercon.png` | Re-encode or rename (Step 1) |
| `web/courses.html` | Módulo 6 block + **Módulo 7** `data-academy-media-bg` |
| **`web/data/academy-media.json`** | **Canonical caja** — `cable_connectors.*` + `dj_equipment.*` |

**Do not touch:** `translations.js`, Supabase, other Academia modules unless Captain expands scope.

---

## 7. Rollback

```bash
git checkout -- web/courses.html web/assets/course/cable_*.png
```

Or restore from commit before ACAD-CABLE-011 work.

---

## 8. References

- [MDJPRO-TICKET-STATUS.md](./MDJPRO-TICKET-STATUS.md)
- Session audit: Captain confirmed assets live under `web/assets/course/`; visibility failure not missing links
