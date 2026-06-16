# TICKET-009 — Rentals Cart Wiring (r-add-cart → MDJEventBuilder)

**Fecha de apertura:** 2026-06-16
**Abierto por:** CEO (DJMago)
**Estado:** CERRADO ✓
**Fecha de cierre:** 2026-06-16
**Aprobado por:** CEO (DJMago)
**Prioridad:** ALTA
**Archivo principal:** `web/js/rentals.js`

---

## Problema

El módulo Rentals tiene **dos rutas de carrito paralelas** que no están sincronizadas:

| Ruta | Accion | Destino | Estado |
|---|---|---|---|
| Talento / servicios (DJ, Live, MC, Staff, Payasos, FX, Lighting, Hora Loca) | `hl-activate-direct` | `MDJEventBuilder.getDraft()` (V1) | CABLEADO |
| Catálogo dinámico (Audio, Tents, Furniture, Lighting fixtures, FX especiales) | `r-add-cart` | `window.selectedPackage` directo | DESCONECTADO |

El handler `r-add-cart` (línea ~3776 de `rentals.js`) escribe directo a `window.selectedPackage` sin pasar por `MDJEventBuilder`. Los items del catálogo dinámico NO aparecen en el draft oficial del carrito.

## Síntoma visible

- Botón "AGREGAR AL PAQUETE" en catálogos dinámicos (Audio/Sonido, Carpas/Tents, Furniture, Lighting fixtures, FX especiales) responde visualmente pero el item NO se suma al total del carrito ni al checkout.
- El contador del carrito no se actualiza con estos items.
- Al ir a checkout los items del catálogo dinámico no están presentes.

## Alcance del fix

**Archivos a tocar:** `web/js/rentals.js` únicamente.

**Trabajo:** Conectar el handler `r-add-cart` a `MDJEventBuilder` con el mismo patrón de 4 pasos que ya usa `hl-activate-direct`:

1. **NEGOCIO** — leer estado actual de `MDJEventBuilder.getDraft().lines`
2. **SINCRONIZACIÓN** — llamar `mdjRentalsSyncTogglePack({ id, name, price, added })`
3. **VERIFICACIÓN** — confirmar que el draft refleja el cambio esperado
4. **UI** — actualizar botón y `selectedPackage` legacy solo si verificación pasa

**NO tocar:**
- `hl-activate-direct` handler (funciona correctamente)
- CSS / HTML de las tarjetas
- Lógica de cantidad `r-qty-up` / `r-qty-down` (funciona, es solo UI local)
- `MDJEventBuilder` ni `mdjRentalsSyncTogglePack` (ya implementados)

## Contexto técnico

- `window.MDJ_EVENT_BUILDER_V1` — flag que activa el sistema V1
- `window.MDJEventBuilder.getDraft()` — fuente de verdad del carrito
- `window.mdjRentalsSyncTogglePack({ id, name, price, added })` — función de sincronización ya existente
- `window.selectedPackage` — array legacy que debe mantenerse sincronizado como fallback
- Línea del handler actual: ~3776 en `rentals.js`
- Template del botón: línea ~2308 en `rentals.js` — `data-action="r-add-cart"`

## Tickets relacionados

- TICKET-008 (rentals-dynamic-pricing) — precios del catálogo
- SESSION-LOG-2026-06-15 — cambios visuales del módulo rentals aprobados hoy

## Criterio de aceptación

- [x] Click en "AGREGAR AL PAQUETE" de cualquier catálogo dinámico actualiza `MDJEventBuilder.getDraft().lines`
- [x] Contador del carrito se actualiza visualmente
- [x] El item aparece en el resumen de checkout
- [x] Botón cambia a "QUITAR" y revierte correctamente al volver a clickear
- [x] `r-qty-up` / `r-qty-down` respetan la cantidad al agregar (qty > 0)
- [x] No hay regresión en `hl-activate-direct` (DJ, Live, MC, Staff, Payasos, FX, Lighting, Hora Loca)

## Implementación aplicada

**Archivo:** `web/js/rentals.js` — handler `r-add-cart` (~línea 3776)

**3 cambios quirúrgicos:**
1. **PASO 1 (línea 3784):** `isCurrentlyAdded` lee de `MDJEventBuilder.getDraft().lines` cuando V1 activo. Fallback a `selectedPackage` cuando no.
2. **PASO 2 REMOVE (línea 3803):** `mdjRentalsSyncTogglePack({ id, name, price, added: false })` — EventBuilder recibe señal de eliminación.
3. **PASO 2 ADD (línea 3843):** `mdjRentalsSyncTogglePack({ id, name, price: unitPrice * qty, added: true })` — EventBuilder recibe señal de adición con precio por cantidad.

`selectedPackage` se mantiene sincronizado como fallback legacy. Retrocompatibilidad garantizada.
