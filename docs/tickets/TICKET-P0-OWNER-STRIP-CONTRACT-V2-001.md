# TICKET-P0-OWNER-STRIP-CONTRACT-V2-001

**Estado:** 🟡 IMPLEMENTADO — **pendiente QA visual PO**  
**Fecha:** 2026-07-05  
**Reemplaza:** poll / Opción A / Opción B en `dj-profile.html`  
**Causa raíz:** C6 — contrato de inicialización junio obsoleto

---

## CONTRATO V2 (Product Owner)

El Owner Strip **no** depende del momento en que se cargó `mdj-shared-header.js`.

Depende **únicamente** del evento canónico:

### `OWNER_STRIP_READY`

Emitido **exactamente una vez** cuando:

| Condición | Verificación |
|-----------|--------------|
| Auth terminó | `loadProfile()` pasó `getSession()` |
| Profile terminó | Fila `dj_profiles` cargada (`p` presente) |
| `#owner-tabs` existe | `getElementById('owner-tabs')` |
| Strip activo | `body.dj-profile-show-owner-tabs` |

**Entonces:** `reorderOwnerStrip()` se ejecuta **exactamente una vez**.

**Prohibido en V2 (dj-profile):**

- Polls  
- MutationObservers  
- Temporizadores para reorder  

---

## IMPLEMENTACIÓN

### Emisor — `web/dj-profile.html`

Tras activar franja Owner (`loadProfile` ~L5403–5490):

```javascript
window.__mdjNavOwnUserId = session.user.id;
window.__mdjOwnerStripProfileReady = true;
window.__mdjOwnerStripReadyEmitted = true;
window.dispatchEvent(new CustomEvent('OWNER_STRIP_READY'));
```

### Receptor — `web/mdj-shared-header.js`

- `dj-profile.html`: `addEventListener('OWNER_STRIP_READY', …, { once: true })` → `_handleOwnerStripReady()` → `reorderOwnerStrip()` una vez.
- **Sin** `pollStrip()` en dj-profile.
- Satélites (`shop`, `jobs`, `dashboard`, …): **legacy poll** hasta ticket de emisión V2 por página.

---

## QA PO

Owner en `dj-profile.html?id=<uid>`, hard refresh:

1. Orden 10 pilares con **STAFF** antes de SOUNDFORTIPS™  
2. Consola: `document.querySelector('#owner-tabs a[data-mdj-nav="staff"]')` → nodo `<a>`  
3. Un solo reorder (no parpadeo de orden HTML → final)

---

## §7

| Acción | Estado |
|--------|--------|
| V2 implementado | ✅ dj-profile + header listener |
| QA visual PO | ⏳ Pendiente |
| Commit / push / deploy | ⛔ No autorizado |

---

## ROLLBACK

- Revertir bloque emit en `dj-profile.html`  
- Restaurar `pollStrip()` en `mdj-shared-header.js` para dj-profile  

---

## Baseline documental

Indexado en **TICKET-DOCS-V2-BASELINE-001** — `docs/V2/README.md` § V1 crossover.  
Contrato V2 `OWNER_STRIP_READY`; runtime V1. No confundir con specs Shared Core MOD.
