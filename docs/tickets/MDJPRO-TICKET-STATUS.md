# MDJPRO tickets — status index

**Last aligned:** 2026-06-12 — **Academia media ship batch DONE localhost** (011+012+013); await **`APROBADO PUSH`**  
**Prod line:** **V.2.6.5** · notarized · Storage · catálogo **v265** · PR **#77** · **008** postinstall  
**Active branch (cosmetic batch):** `cosmetic/mdjpro-dl-feat-icons-010` — **no push until ticket close** (`APROBADO PUSH`)

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

**Prod pkg SHA256:** `40926cda1c1c469bfa920a3dc9fa77fb28232538fb324e866562fabb0ef39883` · 9,680,243 bytes  
**Rollback 2.6.0:** `MDJPRO_V260_NOTARIZED_BACKUP.pkg` + migración v260

---

## Archived — NO ACTION (historical docs only)

| Ticket | Notes |
|--------|-------|
| [VERSION-SYNC-003](./MDJPRO-VERSION-SYNC-003-hub-logo-version.md) | PNG `V.2.00` hub issue **not visible** — **do not reopen** |
| [PKG-RECOVERY-002](./MDJPRO-PKG-RECOVERY-002.md) | 2026-06-09 install incident — superseded |

---

## Open — cosmetic batch (localhost → single push at close)

| Ticket | Branch | Status | Notes |
|--------|--------|--------|-------|
| [DL-FEAT-ICONS-010](./MDJPRO-DL-FEAT-ICONS-010-enterprise-downloads-grid.md) | `cosmetic/mdjpro-dl-feat-icons-010` | **Phase A APPROVED** · **B–C localhost** | `downloads.html`, `dj-tools.html`, `load-root.html`, `account-settings.html` billing icons; batch commit pending |

**Policy:** Accumulate work on branch → one commit batch → **`APROBADO PUSH`** → later **`APROBADO DEPLOY PRODUCCIÓN`**.

---

## Ready to push — Academia media batch (2026-06-12)

| Ticket | Status | Scope |
|--------|--------|-------|
| [ACAD-CABLE-011](./MDJPRO-ACAD-CABLE-011-courses-modulo6-connector-photos.md) | **DONE localhost** | Módulo 6 cables — PNG re-encode + CSS |
| [ACAD-LIB-012](./MDJPRO-ACAD-LIB-012-culture-library-shipwreck-images.md) | **DONE localhost** | Vault + lecciones + editorial imgs + `academy-media.json` |
| [ACAD-HERO-013](./MDJPRO-ACAD-HERO-013-academy-hero-video-prod.md) | **DONE localhost** | Hero mp4 → Supabase Storage (3 páginas) |

**Also in batch:** Módulo 7 `equipo-*.png` (4 re-encoded + **`equipo-mixer.png` created** — was missing on disk).

**Canonical caja:** `web/data/academy-media.json` · `web/js/academy-media-loader.js`

**QA before push:** `academia.html` · `dj-knowledge.html` · `courses.html` (Cmd+Shift+R)

---

## Open / deferred (real future work)

| Item | Notes |
|------|-------|
| **PERMISOS-007 Phase 2+** | USB volume panel copy, optional Hub hint — **new ticket** if reopened |
| Stripe Dashboard QA | Deferred — Edge deployed |
| Mac git remote | Optional backup (`~/Desktop/MDJ` sin `origin`) |

---

**Handoff (Mac):** `~/Desktop/MDJ/MDJPRO_PROJECT_STATE.md` — read first every session.

**Copy público (artista):** [MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md](./MDJPRO-PUBLIC-ARTIST-COPY-NOTE.md) — **obligatorio** antes de editar `downloads.html`, release notes web o ayuda visible al usuario.

---
