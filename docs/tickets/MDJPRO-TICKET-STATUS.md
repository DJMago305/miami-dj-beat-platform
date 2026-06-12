# MDJPRO tickets — status index

**Last aligned:** 2026-06-12 — **Manual + Booth batch SHIPPED prod** (PR **#79** + hotfix EN **#80**) · Captain QA **PASS**  
**Prod line:** **V.2.6.5** · notarized · Storage · catálogo **v265** · PR **#77** · **008** postinstall  
**Web latest:** PR **#80** merge `7c40685` → `main` · manual 6 langs + Booth + `booth-chat` Edge

---

## Ship closed (prod — current line)

| Ticket | Status | Notes |
|--------|--------|-------|
| **V.2.6.5 ship** | **DONE prod** | Mac 2.6.5 · PR #77 · Storage · v265 · install artista · SUITE-009 |
| [NOTARIZE-005](./MDJPRO-NOTARIZE-005-apple-gatekeeper.md) | **DONE** | Notarized prod |
| [INSTALL-OPEN-008](./MDJPRO-INSTALL-OPEN-008-postinstall-auto-open.md) | **DONE** | PASS prod |
| [VERSION-AUTO-004](./MDJPRO-VERSION-AUTO-004-xcode-single-source.md) | **RUNBOOK** | Release + notarize + sync chain |
| [SUITE-ENTERPRISE-WEB-009](./MDJPRO-SUITE-ENTERPRISE-WEB-009.md) | **DONE prod** | 4 enterprise pages + DJ Tools `grid4` |
| [PERMISOS-007](./MDJPRO-PERMISOS-007-runtime-permissions-ux.md) | **DONE Phase 1 prod** | LOAD ROOT i18n in **2.6.5 DMG** |
| [PUBLIC-ARTIST-COPY-NOTE](./MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md) | **ACTIVE policy** | No developer copy on public web |
| [MANUAL-ICONS-014](./MDJPRO-MANUAL-ICONS-014-enterprise-manual-svg-icons.md) | **DONE prod** | 6 langs · SVG sidebar · NOTE · web exit · PR **#79** · hotfix EN **#80** |
| [BOOTH-MANUAL-016](./MDJPRO-BOOTH-MANUAL-016-manual-knowledge-gates.md) | **DONE prod** | Manual bridge · role gates · human Booth · `booth-chat` deployed |

**Prod pkg SHA256:** `40926cda1c1c469bfa920a3dc9fa77fb28232538fb324e866562fabb0ef39883` · 9,680,243 bytes  
**Rollback 2.6.0:** `MDJPRO_V260_NOTARIZED_BACKUP.pkg` + migración v260

### Manual + Booth ship (PR #79 · #80 · 2026-06-12)

| PR | Merge | Scope |
|----|-------|-------|
| [#79](https://github.com/DJMago305/miami-dj-beat-platform/pull/79) | `dddbf00` | `mdj-manual-icons.css` · 6× manual HTML · Booth bridge · `mdj-assistant.js` · `booth-chat` prompt |
| [#80](https://github.com/DJMago305/miami-dj-beat-platform/pull/80) | `7c40685` | Hotfix EN manual — premature `</style>` |

**Commits:** `f96c1d9` (batch) · `dfe8a5a` (EN fix)  
**Edge:** `supabase functions deploy booth-chat` · project `hkuvuqupbxwkiykxvqdr`  
**Captain auth:** **`APROBADO PUSH`** · **`APROBADO DEPLOY PRODUCCIÓN`** — merge vía PR (branch protection; no push directo a `main`)

---

## Ship closed — Academia media + icons (PR #78 · 2026-06-12)

| Ticket | Status | Scope |
|--------|--------|-------|
| [ACAD-CABLE-011](./MDJPRO-ACAD-CABLE-011-courses-modulo6-connector-photos.md) | **DONE prod** | Módulo 6 cables — PNG re-encode + CSS |
| [ACAD-LIB-012](./MDJPRO-ACAD-LIB-012-culture-library-shipwreck-images.md) | **DONE prod** | Vault + lecciones + editorial imgs + `academy-media.json` |
| [ACAD-HERO-013](./MDJPRO-ACAD-HERO-013-academy-hero-video-prod.md) | **DONE prod** | Hero mp4 → Supabase Storage (3 páginas) |
| [DL-FEAT-ICONS-010](./MDJPRO-DL-FEAT-ICONS-010-enterprise-downloads-grid.md) | **Phase A–C DONE prod** | `downloads`, `dj-tools`, `load-root`, billing SVG — **courses emoji restante = open** |

**Also shipped:** Módulo 7 `equipo-*.png` (4 re-encoded + **`equipo-mixer.png`** created).

**Canonical caja:** `web/data/academy-media.json` · `web/js/academy-media-loader.js`  
**Commits:** `34042f1` (Academia) · `ab7e291` (icons) · merge `adc2982`  
**PR:** https://github.com/DJMago305/miami-dj-beat-platform/pull/78 — **MERGED**

---

## Archived — NO ACTION (historical docs only)

| Ticket | Notes |
|--------|-------|
| [VERSION-SYNC-003](./MDJPRO-VERSION-SYNC-003-hub-logo-version.md) | PNG `V.2.00` hub issue **not visible** — **do not reopen** |
| [PKG-RECOVERY-002](./MDJPRO-PKG-RECOVERY-002.md) | 2026-06-09 install incident — superseded |

---

## Open / deferred (real future work)

| Item | Notes |
|------|-------|
| **DL-FEAT-ICONS-010 Phase D+** | ~58 emoji restantes en `courses.html` (exam/hero) — diferido |
| **MANUAL-I18N-015** | Un HTML manual + toggle idioma — discutido, no iniciado |
| **MANUAL-ICONS-014 print** | `MDJPRO_Manual_Print` — fuera del ship #79 |
| Bump `mdj-assistant.js` sitio | Resto de páginas en cache viejo; manual ya `booth-human-1` |
| **PERMISOS-007 Phase 2+** | USB volume panel copy, optional Hub hint — **new ticket** if reopened |
| Stripe Dashboard QA | Deferred — Edge deployed |
| Mac git remote | Optional backup (`~/Desktop/MDJ` sin `origin`) |
| Módulo 4 Lección 06 | Gradient + emoji placeholder — sin asset de imagen |

---

**Handoff (Mac):** `~/Desktop/MDJ/MDJPRO_PROJECT_STATE.md` — read first every session.

**Copy público (artista):** [MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md](./MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md) — **obligatorio** antes de editar `downloads.html`, release notes web o ayuda visible al usuario.

---
