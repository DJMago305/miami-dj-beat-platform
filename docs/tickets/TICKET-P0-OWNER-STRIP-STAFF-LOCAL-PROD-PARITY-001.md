# TICKET-P0-OWNER-STRIP-STAFF-LOCAL-PROD-PARITY-001

**Estado:** 🔴 ABIERTO  
**Fecha:** 2026-07-05  
**Prioridad:** P0 — paridad visual Owner (STAFF + orden 10 pilares)  
**Declarado por:** Capitán — captura prod = referencia canónica  
**Relacionado:** TICKET-P0-STAFF-TAB-RESTORE-001 (solo `#mainNav` buyer journey; **no** cubre `#owner-tabs`)

---

## SÍNTOMA

| Entorno | Página | Franja `#owner-tabs` | STAFF |
|---------|--------|----------------------|-------|
| **Producción** (`miamidjbeat.com`) | `dj-profile.html` Owner | Orden 10 pilares | ✅ Visible entre MI PERFIL y SOUNDFORTIPS™ |
| **Local** (`127.0.0.1:8080`) | `dj-profile.html` Owner | Orden ≈ HTML crudo (sin Academia antes de Shop) | ❌ Ausente |

**Orden canónico (prod — referencia PO):**

`INICIO · ACADEMIA · SHOP · AGENDA · CONFIG · DJ TOOLS · CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™`

---

## NO ES CAUSA (descartado)

| Hipótesis | Veredicto |
|-----------|-----------|
| Trabajo **invoice** (`stash@{1}`: `admin-dashboard.html`, `production-module.js`, `staff-invoice-print.html`) | ❌ Bundle separado; **no toca** `mdj-shared-header.js` ni `#owner-tabs` |
| Commit `161a45d` (28-may) quitó STAFF del **HTML** de `#owner-tabs` | ⚠️ Verdad histórica, pero **prod lo compensa con JS** — no explica prod OK |
| PR #107–#115 post-nav-freeze | ❌ Sin commits que quiten STAFF de owner strip en `origin/main` |
| Ticket P0-STAFF-TAB-RESTORE-001 (`mdjEnsureStaffMainNavLink`) | ⚠️ Solo `#mainNav` buyer journey; **no inyecta** en `#owner-tabs` de perfil |

---

## ROOT CAUSE (hipótesis principal — pendiente confirmación runtime)

En **`origin/main`**, STAFF en `#owner-tabs` **no viene del HTML** de `dj-profile.html`. Lo crea/reordena JavaScript:

- **Bloque:** `/* OWNER STRIP — 10 PILARES */` — `mdj-shared-header.js` (~L4258+), tag `v20260605-owner-strip-10-pillars`
- **Commit origen:** `f97cea4` (2026-06-05) — `fix(staff-nav): stabilize owner staff navigation`
- **Función:** `reorderOwnerStrip()` → crea `staffEl` si falta → `appendChild` secuencial en orden 10 pilares
- **Poll:** hasta 20 × 300 ms (~6 s) hasta `return true`

**Local sin STAFF + orden HTML crudo** indica que `reorderOwnerStrip()` **no completó** (poll agotado) o el browser ejecutó **JS distinto/stale** al de prod.

### Candidatos técnicos (orden de auditoría)

1. **Caché local** — `mdj-shared-header.js?v=20260603-art-007c-staff-same-entry-1` sirve bytes viejos sin bloque 10 pilares.
2. **Rama / working tree** — `fix/v1-nav-origin-jobs-events-qa` + `stash@{2}` nav bundle modifica `mdj-shared-header.js` (verificar que no rompa el IIFE owner strip).
3. **Error JS previo** — fallo en auth/header antes del IIFE impide llegar a `pollStrip()`.
4. **Race auth** — poll termina antes de que `#owner-tabs` tenga nodos estables (menos probable: `flowEl`/`sftEl` tienen fallback por `#dj-tab-flow-btn` / `#dj-tab-sft-btn` en HTML estático).
5. **Condición `_staffBuildingPage`** — en `dj-profile.html` debe ser `false`; si pathname local difiere, podría saltarse inyección (improbable).

---

## EVIDENCIA GIT

| Commit | Fecha | Efecto STAFF owner strip |
|--------|-------|--------------------------|
| `97bc51c` | 28-may 19:57 | STAFF **añadido** al HTML `#owner-tabs` |
| `161a45d` | 28-may 20:56 | STAFF **quitado** del HTML `#owner-tabs` |
| **`f97cea4`** | **5-jun** | STAFF **re-inyectado por JS** + reorder 10 pilares ← **baseline prod** |
| `215e044` | 21-jun | Geometría `#mainNav` staff; reposiciona MI PERFIL tras CONTACTO — no quita owner strip STAFF |

**Prod desplegado (`origin/main` @ PR #115):** incluye bloque 10 pilares.  
**Invoice stash (5-jul local):** sin relación.

---

## ARCHIVOS EN SCOPE (cuando Capitán autorice fix)

| Archivo | Rol |
|---------|-----|
| `web/mdj-shared-header.js` | `reorderOwnerStrip()`, inyección STAFF, poll |
| `web/dj-profile.html` | Carga defer del header; bootstrap Owner (`dj-profile-show-owner-tabs`) — **LOCKED** — solo bloque acotado si PO autoriza |
| `web/styles.css` | Visibilidad `#owner-tabs` — **LOCKED** — solo si ticket amplía |

**Fuera de scope:** invoice bundle, `header-unified.css` (salvo ticket nav explícito).

---

## PLAN DE AUDITORÍA (QA local — ejecutar antes de fix)

### A. Consola (Owner en `dj-profile.html?id=<uid>`)

```javascript
// 1 — ¿Existe bloque 10 pilares?
document.documentElement.outerHTML.indexOf('v20260605-owner-strip-10-pillars') > -1

// 2 — ¿STAFF en DOM?
document.querySelector('#owner-tabs a[data-mdj-nav="staff"]')

// 3 — Orden visible (textos)
[...document.querySelectorAll('#owner-tabs .container > *')].map(el => el.textContent.trim().slice(0, 20))

// 4 — UID nav
window.__mdjNavOwnUserId
```

### B. Network

- Hard refresh (⌘⇧R).
- Confirmar `mdj-shared-header.js?v=20260603-...` → **200**, tamaño ≈ prod, sin `(disk cache)` stale.

### C. Git parity

```bash
git diff origin/main -- web/mdj-shared-header.js
# Debe ser vacío o solo cambios explícitos del ticket nav acordado
```

### D. Comparar con prod

Misma URL relativa, misma sesión Owner → orden de tabs debe coincidir pixel/texto con captura PO.

---

## FIX PROPUESTO (mínimo — pendiente OK Capitán)

**Opción A (recomendada):** Paridad local = `origin/main` en `mdj-shared-header.js`; descartar drift del nav stash local hasta QA PO.

**Opción B:** Si poll falla por timing — extender poll / enganchar `reorderOwnerStrip()` al evento post-`loadProfile` Owner (`dj-profile-show-owner-tabs`) sin tocar HTML locked.

**Opción C:** Unificar STAFF owner strip con `mdjEnsureStaffMainNavLink()` pattern — **solo** si Arquitecto amplía scope; hoy P0-RESTORE-001 no cubre `#owner-tabs`.

---

## CRITERIOS DE ACEPTACIÓN (PO visual)

Owner en **local** `dj-profile.html`:

- [ ] Orden idéntico a prod (10 pilares).
- [ ] STAFF visible entre MI PERFIL y SOUNDFORTIPS™.
- [ ] Click STAFF → `./admin-dashboard.html` (staffInDb).
- [ ] Cliente / artista puro / invitado: sin STAFF.
- [ ] Sin duplicar STAFF.
- [ ] Hard refresh estable (3 cargas seguidas).

---

## §7 — GATE

| Acción | Estado |
|--------|--------|
| Ticket abierto | ✅ 2026-07-05 |
| Auditoría runtime local | ⏳ Pendiente |
| Fix autorizado | ⏳ Espera OK Capitán + lista archivos |
| Commit / push / deploy | ⏳ Sin `APROBADO PUSH` / `APROBADO DEPLOY PRODUCCIÓN` |

---

## ROLLBACK

Revertir solo el diff acordado en `mdj-shared-header.js` (o `git checkout origin/main -- web/mdj-shared-header.js` si fix fue paridad pura).

---

## Baseline documental

Indexado en **TICKET-DOCS-V2-BASELINE-001** — `docs/V2/README.md` § V1 crossover.

**Post PR #116 (`f69b66e`, 2026-07-06):** corregido redirect **Mi Perfil** desde vista STAFF (`admin-dashboard` owner-tabs) → `dj-profile.html?id=<uid>`. Este ticket sigue **abierto** para paridad **STAFF visible + orden 10 pilares** en `dj-profile.html` local vs prod.
