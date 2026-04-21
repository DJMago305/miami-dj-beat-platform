---
name: ordenes
description: >-
  Restauración inmediata en Jobs/carrusel MDJ. Use when the user invokes ÓRDENES,
  regression on role cards, double-circle check UI, infinite carousel parity with
  rentals.js, or physical SVG checkmarks in web/jobs.html.
---

# ÓRDENES — restauración inmediata (MDJ Jobs)

## Alcance

Solo lo pactado en el ticket; `web/jobs.html` salvo bloque explícito.

## Reglas obligatorias

### 1. Limpieza CSS (doble círculo)

- No usar `::before` ni `::after` en `.role-photo-card` para el indicador de selección.
- La única marca permitida es el nodo **`.mdj-role-check-ring`** en el HTML.
- Si hace falta, añadir reglas que fuercen `content: none` y `display: none` en `.role-photo-card::before` y `::after` en esta página.

### 2. Carrusel infinito (paridad rentals.js)

- No inventar bucles nuevos. Copiar el patrón de `initTalentSelectorInfiniteCarousel` en `web/js/rentals.js`: `dataset.mdjSimpleLoop`, `_mdjLoopScroll`, mitad de `scrollWidth`, `requestAnimationFrame` + `*InfiniteApplyRetry`.
- Aplicar el scroll host a **`#mdj-jobs-v3-carousel`**; clones según estructura real del DOM de Jobs (loop de labels → div sin checkbox).

### 3. Palomita física

- El `<svg class="mdj-role-check-mark">` debe existir en el HTML de cada tarjeta (path negro sobre anillo dorado en `.active`).
- Visibilidad: `display: none` por defecto; `display: block !important` con `.role-photo-card.active .mdj-role-check-mark` (scoped al carrusel).

### 4. Log de consola (verificación)

- Tras cambios de restauración, incluir cuando el Capitán lo pida:
  `console.log("🚨 INGENIERÍA RESTAURADA: BYPASS DE REGRESIÓN ACTIVO");`

## Prohibido

- Reintroducir pseudoelementos duplicados del check.
- “Mejorar” otras páginas o `styles.css` sin alcance explícito.
