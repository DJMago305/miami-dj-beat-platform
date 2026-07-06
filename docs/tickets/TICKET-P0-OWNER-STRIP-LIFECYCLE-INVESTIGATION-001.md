# TICKET-P0-OWNER-STRIP-LIFECYCLE-INVESTIGATION-001

**Estado:** 🔴 ABIERTO — **SOLO INVESTIGACIÓN** (cero parches autorizados)  
**Fecha:** 2026-07-05  
**Prioridad:** P0 — STAFF ausente en `#owner-tabs` (localhost vs producción)  
**Relacionado:** TICKET-P0-OWNER-STRIP-STAFF (cerrado sin fix), PARITY-001, OPTION-B (ambos **NO APROBADOS**)

---

## DECISIÓN PO (vigente)

| Implementación | Resultado |
|----------------|-----------|
| Opción A — paridad `origin/main` en `mdj-shared-header.js` | **NO APROBADA** — sin efecto visual |
| Opción B — hook post-`loadProfile` en `mdj-shared-header.js` | **NO APROBADA** — rollback completo |

**Regla hasta nuevo aviso:** **NO modificar `mdj-shared-header.js`.**  
No autorizar parches hasta **demostrar** qué proceso construye, destruye o reemplaza `#owner-tabs` durante la carga.

**Repositorio:** restaurado al bundle NAV (`stash@{2}`) en `mdj-shared-header.js`.

> **Baseline 2026-07-06:** indexado en `docs/V2/README.md` (TICKET-DOCS-V2-BASELINE-001). PR #116 en `main` incluyó fix Mi Perfil owner-staff (`f69b66e`) — **scope distinto** de esta investigación STAFF/orden.

---

## SÍNTOMA (referencia canónica = producción)

**Producción (`miamidjbeat.com`) — Owner en `dj-profile.html`:**

`INICIO · ACADEMIA · SHOP · AGENDA · CONFIG · DJ TOOLS · CASH FLOW · MI PERFIL · **STAFF** · SOUNDFORTIPS™`

**Localhost (`127.0.0.1:8080`) — misma sesión Owner:**

`INICIO · SHOP · AGENDA · CONFIG · ACADEMIA · DJ TOOLS · CASH FLOW · MI PERFIL · SOUNDFORTIPS™` (**sin STAFF**, orden ≈ **HTML crudo**)

**Interpretación forense:** el bloque `reorderOwnerStrip()` (`v20260605-owner-strip-10-pillars`) **no dejó efecto persistente** en local, o **nunca corrió** con el JS servido al browser.

---

## PREGUNTA DE INVESTIGACIÓN

> ¿Qué proceso **construye**, **destruye** o **reemplaza** `#owner-tabs` (o sus hijos) durante la carga de `dj-profile.html`?

---

## MAPA DE ACTORES (código estático — Fase 1)

### A. Construcción

| Actor | Archivo | Acción | ¿En `dj-profile.html`? |
|-------|---------|--------|--------------------------|
| **HTML estático** | `web/dj-profile.html` ~L3057 | `<nav id="owner-tabs">` + `.container` + 10 nodos (sin STAFF en HTML desde `161a45d`) | ✅ Única fuente de creación |
| `mdj-profile-nav-context.js` | ~L67–108 | **Inyecta** `#owner-tabs` si falta | ❌ **No cargado** en `dj-profile.html` |
| Otros HTML (shop, dashboard, etc.) | varios | Strip propio o inyectado | N/A en este ticket |

**Conclusión Fase 1:** en perfil Owner, `#owner-tabs` **no se crea por JS** — solo existe el nodo HTML. **Nadie reemplaza el `<nav>` entero** (grep sin `removeChild(nav)` / `innerHTML` sobre `#owner-tabs`).

---

### B. Visibilidad (no destrucción)

| Fase | Actor | Mecanismo |
|------|-------|-----------|
| T0 paint | `dj-profile.html` inline CSS ~L784 | `.dj-owner-tabs { display: none }` |
| Auth pending | `profile.css` L233–237 | `#owner-tabs` **visible** bajo `html.dj-profile-auth-check` |
| Auth resolving | `header-unified.css` L723–728 | `#owner-tabs` **visibility:hidden** si `html.mdj-auth-resolving` / `body.mdj-nav-booting` |
| Owner confirmado | `loadProfile()` ~L5403–5406 | `body.dj-profile-show-owner-tabs` + `tabs.style.display = 'flex'` |
| QR público | `profile.css` L352–355 | `#owner-tabs { display:none !important }` |
| Visual blocker | `mdj-shared-header.js` ~L4242–4254 | `documentElement.style.display=none` hasta reorder o 2.5s (solo dj-profile) |

---

### C. Mutación de hijos (reorden / inyección — NO borrado del nav)

| Actor | Archivo | Qué hace | ¿Puede quitar STAFF? |
|-------|---------|----------|----------------------|
| **`reorderOwnerStrip()`** | `mdj-shared-header.js` ~L4276+ | `appendChild` secuencial 10 pilares; **crea** `<a data-mdj-nav="staff">` si falta | **Único** que añade STAFF en perfil |
| **`pollStrip()`** | mismo bloque ~L4414 | Poll 20×300ms (~6s) al cargar script | Si falla → orden HTML, sin STAFF |
| Dashboard strip IIFE | ~L4015+ | Solo `dj-dashboard.html` | N/A |
| **`mdj-owner-tabs-marquee.js`** | `buildMarquee` / `destroyMarquee` | **Reparenta** hijos de `.container` a tracks marquee; no elimina nodos | No quita STAFF si existía; puede ocultar en clone |
| **`i18n.updateUI()`** | `i18n.js` L36+ | Cambia **texto** vía `[data-i18n]`; no reordena DOM | No |
| **`switchProfileTab()`** | `dj-profile.html` ~L6847 | Solo `.active` en botones | No |
| **`loadProfile()` owner block** | ~L5403–5454 | Muestra flow/sft; no reordena | No |

**Nota:** `#owner-tabs` tiene `data-mdj-no-marquee="1"` en HTML, pero **`mdj-owner-tabs-marquee.js` no lee ese atributo** — marquee puede activarse igual si hay overflow.

---

### D. Destrucción

| Búsqueda | Resultado |
|----------|-----------|
| `#owner-tabs` + `innerHTML` / `remove()` / `replaceWith` en JS del perfil | **No encontrado** |
| Eliminación histórica STAFF | Commit `161a45d` — quitó **un `<a>` del HTML**, no el nav |

**Conclusión Fase 1:** nadie **destruye** `#owner-tabs` en runtime en `dj-profile.html`. El problema es **reorder/inyección que no persiste o no ocurre**, no un nav borrado.

---

## CRONOLOGÍA DE CARGA (`dj-profile.html`) — hipótesis de carrera

```
T0  HTML parse
    └─ #owner-tabs en DOM (display:none)

T1  Head: djProfileAuthGuard() async (supabase getSession)
    └─ html.dj-profile-auth-check

T2  defer: i18n.js (~L3614, medio documento)

T3  Inline: loadProfile registra DOMContentLoaded listener (~L6297)

T4  defer (final ~L14137–14138):
    mdj-shared-header.js  → pollStrip() inmediato (6s max)
    mdj-owner-tabs-marquee.js → boot en DOMContentLoaded

T5  DOMContentLoaded
    ├─ loadProfile() async → getSession + dj_profiles (segundos)
    ├─ checkSessionForNav() (dentro mdj-shared-header)
    └─ marquee sync()

T6  loadProfile resuelve Owner (~L5404)
    └─ dj-profile-show-owner-tabs + display:flex

T?  reorderOwnerStrip debería haber corrido en T4–T5
    └─ Si orden final = HTML → poll NO completó O JS stale en browser
```

**Hipótesis principal (pendiente runtime):** desacople temporal entre **poll de 6s** (T4) y **activación Owner** (T6), **o** el browser ejecuta **bytes JS cacheados** sin bloque `v20260605`.

**Hipótesis secundaria:** `mdj-owner-tabs-marquee.js` reparenta hijos **después** de un reorder exitoso sin incluir STAFF (solo si STAFF nunca se insertó).

---

## C6 — CAUSA DEMOSTRADA (contrato de inicialización roto)

**Veredicto PO / Arquitectura:** `reorderOwnerStrip()` **no está roto**. El bloque `v20260605-owner-strip-10-pillars` fue escrito para un **ciclo de carga de junio 2026** que **ya no existe**. Hoy el JS corre **como fue diseñado**, pero en un **momento del lifecycle** para el que **ya no fue diseñado**.

### Contrato original (junio 2026 — `f97cea4`, 5-jun)

| Supuesto implícito | Estado en junio |
|--------------------|-----------------|
| `pollStrip()` al **parse/ejecución** del script | ✅ IIFE + poll 20×300ms al cargar `mdj-shared-header.js` |
| `#owner-tabs` en DOM estático, hijos siempre localizables | ✅ HTML ~L3054 |
| STAFF inyectado por reorder, no por HTML | ✅ post-`161a45d` |
| **`dj-profile.html` carga header JS en modo sync** | ✅ `<script src="./mdj-shared-header.js?v=20260602-auth-gate-1">` **sin defer** (cola final del body, antes de marquee sync) |
| Activación Owner ≈ mismo “tick” de boot que poll | ⚠️ `loadProfile()` ya era async, pero **orquestación de scripts** era distinta |

### Contrato actual (post-junio — drift acumulado)

| Cambio posterior | Commit / área | Efecto en lifecycle |
|------------------|---------------|---------------------|
| **`mdj-shared-header.js` → `defer`** en `dj-profile.html` | `aba733b` (16-jun) | Poll corre en fase **defer** (post-parse, pre/post DOMContentLoaded según cola), no en sync inline final |
| **`mdjApplyAuthBootMask` + `mdj-auth-resolving`** | `3d61b70` + `header-unified.css` | `#owner-tabs` **visibility:hidden** mientras resuelve rol/sesión (`922cb1c` CLS staff) |
| **`djProfileAuthGuard`** async en `<head>` | `dj-profile.html` | `html.dj-profile-auth-check` hasta getSession (hasta 12s fallback) |
| **`checkSessionForNav()`** en DOMContentLoaded | `mdj-shared-header.js` | Cadena auth paralela a `loadProfile()` |
| **Owner strip visible solo tras `loadProfile`** | ~L5403–5406 | `body.dj-profile-show-owner-tabs` + `display:flex` **después** de fetch perfil — **desacoplado del poll de 6s** |
| Auth owner / JWT (`jwtArtist`, DB wins) | `ea9e440`, `0740f06`, etc. | Más pasos antes de clasificar Owner; T6 más tardío |

### Resultado observable

```
Junio (diseño):  script sync → pollStrip (6s) ↔ DOM listo / boot compacto
Hoy (realidad):  defer → pollStrip (6s) → [expira] → loadProfile async → dj-profile-show-owner-tabs
```

- El poll **no está ligado** a ningún evento de “Owner strip listo”.
- **`reorderOwnerStrip()` puede ejecutarse** (PO: no roto) pero **fuera del contrato vigente**: antes de que el perfil confirme Owner, mientras auth enmascara la franja, o con ventana de 6s agotada antes de T6.
- Orden HTML crudo + sin STAFF en localhost = **efecto del contrato viejo**, no regresión aleatoria del algoritmo de reorder.

### Implicación para Fase 3 (sigue bloqueada)

Cualquier fix futuro **no debe** ser “otro parche en el poll de junio”. Requiere **nuevo contrato de inicialización** explícito, por ejemplo:

- Evento/canonical hook cuando `dj-profile-show-owner-tabs` está activo (Opción B rechazada como implementación, pero **diagnóstico válido**), **o**
- Mover reorder al mismo bus que `loadProfile` / auth (implica archivos hoy bloqueados), **o**
- Restaurar sync + orden de scripts de junio (regresión de performance/defer — decisión PO).

**Hasta definir contrato nuevo → no tocar `mdj-shared-header.js`.**

---

## IMPLEMENTACIONES RECHAZADAS — POR QUÉ NO APLICABAN

| Opción | Por qué falló |
|--------|----------------|
| A | Diff owner-strip vs `origin/main` = **0 bytes** antes del parche; el archivo en disco ya era el de prod |
| B | Añadió hooks en el mismo archivo sin probar causa; PO rechazó |

**Lección:** el gap local/prod no se cierra cambiando `mdj-shared-header.js` sin evidencia de **qué pisa el DOM** o **qué JS ejecuta el browser**.

---

## FASE 2 — INSTRUMENTACIÓN RUNTIME (sin tocar repo)

Ejecutar en consola **antes** de recargar (Owner, `dj-profile.html?id=<uid>`):

```javascript
(function () {
  var c = document.querySelector('#owner-tabs .container');
  if (!c) return console.warn('no container yet');
  var log = function (tag, el) {
    console.log('[owner-strip]', tag, el ? el.length : 0,
      el ? [...el].map(function (n) {
        return (n.textContent || '').trim().slice(0, 16) + (n.getAttribute('data-mdj-nav') ? '|' + n.getAttribute('data-mdj-nav') : '');
      }) : []);
  };
  log('t0', c.children);
  new MutationObserver(function (m) {
    m.forEach(function (rec) {
      if (rec.type === 'childList') log('mutation', c.children);
    });
  }).observe(c, { childList: true, subtree: false });
  new MutationObserver(function () {
    if (document.body.classList.contains('dj-profile-show-owner-tabs')) {
      console.log('[owner-strip] dj-profile-show-owner-tabs @', performance.now().toFixed(0) + 'ms');
      log('at-owner-class', c.children);
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  console.log('[owner-strip] observer armed — hard refresh now');
})();
```

**Tras reload, registrar:**

1. ¿Cuántas mutaciones `childList`?
2. ¿Aparece `data-mdj-nav="staff"` en algún momento?
3. Timestamp de `dj-profile-show-owner-tabs` vs última mutación
4. Network → `mdj-shared-header.js` → tamaño / `(disk cache)` / contiene string `v20260605-owner-strip-10-pillars`

---

## CRITERIO DE CAUSA DEMOSTRADA (gate para Fase 3)

| ID | Causa | Estado |
|----|-------|--------|
| **C1** | Browser sirve JS stale | ⏳ Secundaria — no explica prod OK con mismo `?v=` |
| **C2** | `reorderOwnerStrip` nunca retorna true | ⏳ Puede ser síntoma de C6, no causa raíz |
| **C3** | Reorder OK pero sobrescrito después | ⏳ No demostrado en runtime |
| **C4** | Marquee reparenta sin STAFF | ⏳ No demostrado |
| **C5** | Poll termina antes de nodos listos | ⏳ Subcaso de C6 |
| **C6** | **Contrato de inicialización cambió** — poll junio vs lifecycle auth/profile/nav actual | ✅ **DEMOSTRADO (git + arquitectura)** |

**C6 cierra la investigación de causa raíz.** Fase 3 requiere **decisión PO de nuevo contrato**, no otro tweak al poll legacy.

---

## FASE 3 — FIX (bloqueada hasta nuevo contrato PO)

Opciones **arquitectónicas** (elegir una; no implementar sin ticket + archivos autorizados):

| # | Enfoque | Archivos probables | Notas |
|---|---------|-------------------|-------|
| 1 | **Event bus / hook canonical** post-`dj-profile-show-owner-tabs` | `dj-profile.html` y/o `mdj-shared-header.js` | Opción B validó diagnóstico; implementación rechazada |
| 2 | **Restaurar sync** de `mdj-shared-header.js` en perfil (junio) | `dj-profile.html` script tag | Regresión defer global |
| 3 | **STAFF en HTML** `#owner-tabs` | `dj-profile.html` LOCKED | Revierte `161a45d` parcialmente |
| 4 | **Unificar boot** auth + strip en un solo owner (`loadProfile` emite evento) | `dj-profile.html` + header | Toca loadProfile — prohibido sin ticket |

**Ninguna fila autorizada hoy.**

---

## ARCHIVOS EN ALCANCE DE LECTURA (Fase 2)

| Archivo | Rol |
|---------|-----|
| `web/dj-profile.html` | HTML strip, `loadProfile`, script order |
| `web/mdj-shared-header.js` | **Solo lectura** — reorder / poll |
| `web/mdj-owner-tabs-marquee.js` | Reparent marquee |
| `web/mdj-profile-nav-context.js` | Inyección satélites (no perfil) |
| `web/i18n.js` | Texto |
| `web/profile.css` | Auth / QR visibility |
| `web/header-unified.css` | Auth-resolving hide |
| `web/styles.css` | Jobs pre-hide, strip layout |

**Fuera de alcance:** invoice bundle, `#mainNav` buyer journey (ticket aparte).

---

## §7 — GATE

| Acción | Estado |
|--------|--------|
| Ticket investigación abierto | ✅ |
| Modificar `mdj-shared-header.js` | ⛔ **PROHIBIDO** hasta gate C1–C5 |
| C6 contrato inicialización | ✅ Documentado |
| Runtime instrumentation (consola) | Opcional — confirmar timestamps T4 vs T6 |
| Fase 3 fix | ⛔ Bloqueada — espera **nuevo contrato PO** |
| Commit / push / deploy | ⛔ No autorizado |

---

## ROLLBACK

Este ticket es documentación + observación. No altera código productivo.
