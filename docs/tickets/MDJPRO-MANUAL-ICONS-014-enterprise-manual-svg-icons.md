# MDJPRO-MANUAL-ICONS-014 — Enterprise SVG icons (MDJPRO interactive + print manuals)

**Status:** **Phase 1 DONE all langs** — ES approved · EN FR DE IT PT replicated `#menu` · localhost · **await `APROBADO PUSH`**

**Related:** [DL-FEAT-ICONS-010](./MDJPRO-DL-FEAT-ICONS-010-enterprise-downloads-grid.md) §3.4 explicitly deferred “Manuals print HTML (separate emoji policy if ever needed)”.

---

## 1. Summary

Replace cartoon emoji in the **official MDJPRO web manuals** with **gold stroke SVG icons** — same enterprise tone as ticket **010** (`downloads`, `dj-tools`, `load-root`, billing).

Captain has **not reviewed** manual cosmetics yet; this ticket isolates **only** the manual HTML zone — no `courses.html`, no site nav, no Mac app.

**Entry URL (local):** `http://localhost:8080/manuals/MDJPRO_Manual/es/index.html`  
**Print URL (local):** `http://localhost:8080/manuals/MDJPRO_Manual_Print/es/index_print.html`

---

## 2. Captain contract

| Rule | Detail |
|------|--------|
| **Zone IN** | `web/manuals/MDJPRO_Manual/**/index.html` (6 langs) |
| **Zone IN** | `web/manuals/MDJPRO_Manual_Print/**/index_print.html` (6 langs) |
| **Zone IN (optional shared)** | `web/manuals/mdj-manual-icons.css` — **new file under `manuals/` only** if needed |
| **Zone OUT** | `web/styles.css`, `downloads.html`, `courses.html`, Academia, auth, Supabase, Mac `~/Desktop/MDJ` |
| **Zone OUT** | PDF files under `web/downloads/*.pdf` — static exports; separate ticket if ever regenerated |
| **Zone OUT** | `web/manuals/mdj-pro.html` redirect stub — no emoji work |
| **Style** | SVG stroke `#c5a059` / `#58a6ff` accent where manual theme uses blue headers · inline or `.mdj-manual-icon` scoped |
| **Copy** | Do **not** rewrite manual text — icon swap only |
| **Layout** | No sidebar width / nav restructure · preserve `#menu` anchor behavior |
| **Push** | One batch commit when Captain approves QA · **`APROBADO PUSH`** |
| **Deploy** | **`APROBADO DEPLOY PRODUCCIÓN`** after localhost sign-off |

**Public copy policy:** [MDJPRO-PUBLIC-ARTIST-COPY-NOTE](./MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md) — artist-facing; no developer/debug copy added.

---

## 3. Audit (2026-06-12)

Emoji counts per file (approx.):

| File set | Lang | Emoji instances | Unique glyphs |
|----------|------|-----------------|---------------|
| `MDJPRO_Manual/*/index.html` | en | 105 | 42 |
| | es | 103 | 45 |
| | fr, de, it, pt | ~108 each | ~48 each |
| `MDJPRO_Manual_Print/*/index_print.html` | en | 99 | 31 |
| | es | 73 | 31 |
| | fr, de, it, pt | ~86 each | ~35 each |

**Hot spots (all langs):**

1. **Sidebar `#menu`** — 17 chapter links `<i>🏠</i>` … `<i>💬</i>`
2. **Body alerts** — `.alert-icon` 💡 ⚠️ etc.
3. **Integration / feature cards** — 📁 folder icons inline
4. **Comparison tables** — ✅ YES / ❌ NO cells
5. **Premium badges** — 🔒 in chapter titles (e.g. Library Wizard)

**Icon mapping (align with 010 where applicable):**

| Emoji | SVG concept |
|-------|-------------|
| 📁 | Folder |
| 🪄 / matrix | Library Wizard grid |
| 🏷️ | Tag hex |
| 🔒 | Lock stroke |
| ✅ / ❌ | Check / X stroke (green/red keep semantic color) |
| 💡 | Lightbulb outline |
| 🚀 | Arrow / launch |
| ⌨️ | Keyboard grid |
| 📊 | Chart bars |
| 🔧 | Wrench |
| ⚖️ | Scale / legal |

---

## 4. Phased deliverables

### Phase 0 — Downloads entry (Visor en Tiempo Real) · **localhost QA pending**

| File | Change |
|------|--------|
| [`web/downloads.html`](../../web/downloads.html) | Accordion **Manual Interactivo** → CTA **Abrir Visor en Tiempo Real**: 📖 → gold-button book SVG (scoped) |

**Local URL:** `http://localhost:8080/downloads.html` → accordion **Manual Interactivo** → botón dorado.

### Phase 1 — Interactive EN + ES (Captain QA gate)

| File | Change |
|------|--------|
| `web/manuals/MDJPRO_Manual/en/index.html` | Sidebar + body emoji → SVG |
| `web/manuals/MDJPRO_Manual/es/index.html` | Same pattern · Spanish manual |

**Stop** after Phase 1 for Captain visual review on localhost.

### Phase 2 — Interactive FR, DE, IT, PT

Mirror approved EN icon blocks into the 4 remaining `index.html` files (structure is parallel).

### Phase 3 — Print manuals (6× `index_print.html`)

Apply same icon set; respect print-friendly sizing (no layout shift in `@media print` if present).

### Phase 4 — Optional cleanup

- Link shared `mdj-manual-icons.css` from all 12 HTML files if duplication is high
- Cache-bust query on CSS link only

---

## 5. QA (localhost)

1. `http://localhost:8080/manuals/MDJPRO_Manual/es/index.html` — hard refresh (**Cmd+Shift+R**)
2. Sidebar: 17 chapters show SVG, no emoji in `<i>` slots
3. Scroll sections 5–14: alerts, tables, cards — no emoji remnants in visible UI
4. Switch lang EN/ES/FR via lang selector — icons consistent
5. Open print variant ES: `…/MDJPRO_Manual_Print/es/index_print.html` — icons render for print preview
6. **Regression:** anchor jumps `#menu` links still scroll to correct section

**Captain sign-off required** before Phase 2+ and before push.

---

## 6. Git workflow

```
Branch:  cosmetic/mdjpro-manual-icons-014
Commit:  when Captain asks (batch per phase or single at close)
Push:    only with literal APROBADO PUSH
Deploy:  only with APROBADO DEPLOY PRODUCCIÓN
```

Suggested commit message:

```
cosmetic(manuals): enterprise SVG icons in MDJPRO manual HTML (014)
```

---

## 7. Rollback

| Action | Command / file |
|--------|----------------|
| Revert one lang | `git checkout main -- web/manuals/MDJPRO_Manual/es/index.html` |
| Revert all manuals | `git checkout main -- web/manuals/MDJPRO_Manual web/manuals/MDJPRO_Manual_Print` |

---

## 8. Related docs

- [MDJPRO-TICKET-STATUS.md](./MDJPRO-TICKET-STATUS.md)
- [MDJPRO-DL-FEAT-ICONS-010](./MDJPRO-DL-FEAT-ICONS-010-enterprise-downloads-grid.md)
- [MDJPRO-PUBLIC-ARTIST-COPY-NOTE](./MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md)
- [workflow-control.md](../workflow-control.md) §7 deploy gates

---
