# MDJPRO-ACAD-HERO-013 — Academia hero video (prod)

**Status:** **DONE** — Storage wired 2026-06-12; **pending `APROBADO PUSH`**  
**Priority:** Academia UX / prod parity  
**Related:** [ACAD-LIB-012](./MDJPRO-ACAD-LIB-012-culture-library-shipwreck-images.md), `web/data/academy-media.json`

---

## 1. Summary

Hero loop **Vinyl Loop for DJ Academy MDJB.mp4** on Academia hub, Cultura/Biblioteca, and Courses. Works on **localhost** (file on disk) but **missing in prod** because `.mp4` is **gitignored** and never deploys to Vercel.

**Fix:** Serve from **Supabase Storage** (bucket `assets`, same path as `web/assets/`) — URL in **`web/data/academy-media.json`** → `academy-media-loader.js` hydrates `<source data-academy-hero-video>`.

---

## 2. Root cause

| Item | Detail |
|------|--------|
| Local file | `web/assets/knowledge/Vinyl Loop for DJ Academy MDJB.mp4` (~3.4 MB) |
| Git | **Excluded** — `.gitignore` → `web/assets/**/*.mp4` |
| HTML (before) | Relative `./assets/knowledge/…mp4` → **404 on Vercel** |
| Poster | `hero-bg.png` in git → static image only in prod |

---

## 3. Prod asset (verified 2026-06-12)

**Already uploaded** to Supabase Storage:

| Field | Value |
|-------|--------|
| Bucket | `assets` (public) |
| Object path | `knowledge/Vinyl Loop for DJ Academy MDJB.mp4` |
| Public URL | `https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/knowledge/Vinyl%20Loop%20for%20DJ%20Academy%20MDJB.mp4` |
| Size | 3,428,629 bytes |
| `Content-Type` | `video/mp4` |
| QA | `curl -sI` → **HTTP 200** |

No re-upload needed unless replacing the file.

---

## 4. Captain contract

| Rule | Detail |
|------|--------|
| **Canonical caja** | `web/data/academy-media.json` → `hero_video` |
| **Hydrator** | `web/js/academy-media-loader.js` |
| **Pages** | `academia.html`, `dj-knowledge.html`, `courses.html` — hero `<source>` only |
| **Do not** | Commit `.mp4` to git; do not touch nav/layout |
| **Local dev** | `video_path` fallback if Storage blocked; prod uses `video_url` |

---

## 5. Files touched

| File | Change |
|------|--------|
| `web/data/academy-media.json` | `hero_video` block + version bump |
| `web/js/academy-media-loader.js` | Hydrate `[data-academy-hero-video]` |
| `web/academia.html` | Storage-backed source + loader script |
| `web/dj-knowledge.html` | Storage-backed source |
| `web/courses.html` | Storage-backed source |

---

## 6. QA checklist

| URL | Check |
|-----|--------|
| `/academia.html` | Hero video loops (muted), not poster-only |
| `/dj-knowledge.html` | Same |
| `/courses.html` | Hero bg video visible |
| Prod + localhost | Network → mp4 **200** from `…supabase.co/storage/…` |
| Safari + Chrome | `playsinline` autoplay OK |

---

## 7. Rollback

```bash
git checkout -- web/data/academy-media.json web/js/academy-media-loader.js web/academia.html web/dj-knowledge.html web/courses.html
```

Revert `<source>` to local `./assets/knowledge/…` (prod video breaks again).

---

## 8. References

- [MDJPRO-TICKET-STATUS.md](./MDJPRO-TICKET-STATUS.md)
- `web/supabase-config.js` — `MDB_ASSETS_URL` = `…/storage/v1/object/public/assets/`
