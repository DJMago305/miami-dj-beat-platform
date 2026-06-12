# MDJPRO-ACAD-LIB-012 — Cultura y Biblioteca DJ: imágenes náufragas

**Status:** **DONE** — localhost complete 2026-06-12; **pending `APROBADO PUSH`**  
**Priority:** Academia content / editorial UX  
**Prod:** **NOT deployed**  
**Separate from:** [MDJPRO-DL-FEAT-ICONS-010](./MDJPRO-DL-FEAT-ICONS-010-enterprise-downloads-grid.md) (emoji→SVG makeup), [MDJPRO-ACAD-CABLE-011](./MDJPRO-ACAD-CABLE-011-courses-modulo6-connector-photos.md) (Módulo 6 cables)

---

## 1. Summary

Captain reports **broken or invisible images** in Academia **Cultura y Biblioteca DJ** (`dj-knowledge.html`): horizontal vault cards under *“El Legado detrás de las perillas”* (El Selecta, Bronx, Leer la pista, etc.). Same class of asset/MIME/CSS issues may affect **`courses.html`** historia grid (`web/images/lesson_*.png`).

**Entry URL (local):** `http://localhost:8080/dj-knowledge.html` (from `academia.html` tab *DJ Culture & Library*).

**Captain screenshot:** 2026-06-11 — card 1 shows browser **broken-image icon**; cards 2–3 appear as dark empty wells with faint placeholders.

---

## 2. Captain contract (when ticket opens)

| Rule | Detail |
|------|--------|
| **Zone A** | `web/dj-knowledge.html` — vault carousel + `.editorial-img` in articles |
| **Zone B** | `web/courses.html` — grid “6 Lecciones” cultura (~lines 2102–2240), paths `images/lesson_*.png` |
| **Assets** | `web/assets/knowledge/*`, `web/images/lesson_*.png` — fix integrity/MIME/visibility; no moves without OK |
| **Locked files** | `dj-knowledge.html`, `courses.html` — surgical blocks only (`.cursorrules`) |
| **Not in scope** | Emoji→SVG batch (010), Módulo 6 cable circles (011), booth 🤖, shared nav |

---

## 3. Zone A — `dj-knowledge.html` (Biblioteca DJ)

### 3.1 Horizontal vault cards (Captain capture)

| Card | `src` in HTML | File on disk | Format audit |
|------|---------------|--------------|--------------|
| El Selecta | `./assets/knowledge/hero-bg.png` | ✅ ~587 KB | **Real PNG** |
| Nacimiento Hip-Hop | `./assets/knowledge/bronx-birth.png` | ✅ | **Real PNG** |
| Leer la Pista | `./assets/knowledge/reading-floor.png` | ✅ | **Real PNG** |
| DJ vs Entertainer | `./assets/knowledge/dj-entertainer.png` | ✅ | **Real PNG** |

HTTP (localhost:8080 from `web/`): all **200**, `Content-Type: image/png`.

**Product note:** Selecta card uses **`hero-bg.png`** (mixer/generic); editorial article `#selecta` uses **`jamaica-sound.png`**. Consider swapping card 1 to `jamaica-sound.png` when fixing (Captain decision).

### 3.2 Editorial article heroes (scroll targets)

| Section anchor | Image |
|----------------|-------|
| `#selecta` | `jamaica-sound.png` |
| (inline) | `dj-vinyl.png` |
| `#bronx-birth` | `bronx-birth.png` |
| `#reading-floor` | `reading-floor.png` |
| `#dj-vs-entertainer` | `dj-entertainer.png` |

All real PNG; `.editorial-img` has no blend-mode — should display if loaded.

### 3.3 CSS visibility (may look “náufraga” even when loaded)

`.knowledge-card-bg` (page-local CSS):

- `opacity: 0.5`
- `filter: grayscale(40%)`
- Heavy `.knowledge-card-overlay` gradient (black 98% at bottom)

Combined with dark card background `#0a0a0a`, photos can read as **empty black wells** unless hover (`opacity: 0.7`, grayscale off).

### 3.4 Hero video (separate deploy note)

- `<video poster="./assets/knowledge/hero-bg.png">` + `Vinyl Loop for DJ Academy MDJB.mp4`
- **`.mp4` is gitignored** (`.gitignore` → `web/assets/**/*.mp4`) — **will not ship to prod** via repo; poster PNG still should show.

### 3.5 Open questions for fix pass

1. Why broken-image icon on card 1 if file is valid PNG? Reproduce in Safari DevTools → Network → `hero-bg.png` (status, MIME, size).
2. Tune CSS (opacity / overlay) vs re-export art — Captain visual reference needed.
3. Confirm prod/Vercel has all `web/assets/knowledge/*.png` committed (they are in git).

---

## 4. Zone B — `courses.html` (grid Historia / 6 lecciones)

Paths **`images/lesson_*.png`** (no `./` prefix — resolves to `/images/…` from site root).

| File | Format audit | MIME served |
|------|--------------|-------------|
| `lesson_kool_herc.png` | **JPEG** bytes, `.png` name | `image/png` ❌ |
| `lesson_grandmaster_flash.png` | JPEG-as-PNG | same |
| `lesson_larry_levan.png` | JPEG-as-PNG | same |
| `lesson_chicago_detroit.png` | JPEG-as-PNG | same |
| `lesson_raves_europeas.png` | JPEG-as-PNG | same |

**Same root cause as [ACAD-CABLE-011](./MDJPRO-ACAD-CABLE-011-courses-modulo6-connector-photos.md):** Safari strict `<img>` rejects JPEG body with PNG MIME → **broken-image icon**.

Additional dimming: `opacity: 0.55`, `filter: saturate(0.7)`, dark gradient overlay.

---

## 5. Recommended fix (when approved — one ticket, one QA)

### A — `dj-knowledge.html`

1. DevTools confirm load failures vs CSS-only.
2. If load OK: raise base `opacity` (e.g. 0.75–0.85), reduce overlay crush, optional `brightness()` — scoped to `.knowledge-card-bg` only.
3. Optional: card 1 → `jamaica-sound.png` for Selecta thematic match.
4. Document prod strategy for hero `.mp4` (Storage URL vs drop video). → **See [ACAD-HERO-013](./MDJPRO-ACAD-HERO-013-academy-hero-video-prod.md)** (Storage wired 2026-06-12).

### B — `courses.html` + `web/images/`

1. Re-encode 5 lesson files to **real PNG** **or** rename to `.jpg` + update `src` (mirror 011 Option A/B).
2. Optionally lighten lesson header CSS after MIME fix.

**Do both zones in one QA pass** if Captain wants Cultura/Biblioteca “done” in one shot.

---

## 6. QA checklist

| URL | Check |
|-----|--------|
| `/dj-knowledge.html` | 4 vault cards show photo (no broken icon); scroll articles show editorial imgs |
| `/courses.html` | 6 lecciones grid — 5 lesson headers visible |
| Safari + Chrome | Hard refresh; Network 200 + correct `Content-Type` |

---

## 7. Files to touch (when approved)

| File / path |
|-------------|
| `web/dj-knowledge.html` (scoped CSS + optional `src` swap) |
| `web/courses.html` (lesson `img` `src` only) |
| `web/assets/knowledge/*.png` (if re-export) |
| `web/images/lesson_*.png` (re-encode or rename to `.jpg`) |
| **`web/data/academy-media.json`** | **Canonical caja** — vault + lessons + cables (`image_path` / `image_url` for Supabase) |
| **`web/js/academy-media-loader.js`** | Hydrates `[data-academy-media]` from JSON |

---

## 8. Rollback

```bash
git checkout -- web/dj-knowledge.html web/courses.html web/assets/knowledge/ web/images/
```

---

## 9. Related

- [MDJPRO-TICKET-STATUS.md](./MDJPRO-TICKET-STATUS.md)
- [MDJPRO-ACAD-CABLE-011](./MDJPRO-ACAD-CABLE-011-courses-modulo6-connector-photos.md) — same JPEG-as-PNG pattern
- Content markdown: `web/content/selecta-jamaica.md`, `web/content/bronx-1973.md` (text only; loaded by `articles-loader.js`)
