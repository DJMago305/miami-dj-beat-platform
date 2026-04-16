# Talent selector hub — diseño de referencia (Event Services / `rentals.html`)

**Ámbito:** modal `#talent-selector-modal` (hub “Entretenimiento y Talento”). Este documento fija el estilo aprobado para **tipografía**, **tarjetas** y **carrusel infinito**. No cambiar “por gusto”: cualquier ajuste va con ticket explícito.

---

## 1. Piezas tipográficas críticas (no degradar)

### A) Línea superior — *eyebrow* (clave i18n: `talent_selector_eyebrow`)

**Texto de referencia (ES):**  
`ELEVAMOS TUS CELEBRACIONES A EXPERIENCIAS INOLVIDABLES`

- **Clase CSS:** `.mdj-talent-hub-eyebrow` (dentro de `.mdj-talent-hub-head`)
- **Fuente:** `Cinzel` (fallback: Palatino Linotype, Times New Roman, serif)
- **Peso:** 600  
- **Tamaño:** `clamp(10px, 1.2vw, 11px)`
- **Mayúsculas:** `text-transform: uppercase`
- **Tracking:** `letter-spacing: 0.36em` + `padding-left: 0.36em` (compensa ópticamente el espaciado)
- **Color:** `#ecd9a8`
- **Sombra:** brillo dorado suave + sombra oscura (ver bloque en `web/rentals.html`, estilo `#rentals-talent-selector-carousel`)

### B) Título principal (clave i18n: `talent_selector_title`)

**Texto de referencia (ES):**  
`Selecciona el talento que quieres sumar a tu paquete`

- **Clase CSS:** `.mdj-talent-hub-title`
- **Fuente:** `Playfair Display` (italic), fallback Palatino / Georgia serif
- **Peso:** 600, **estilo:** italic
- **Tamaño:** `clamp(24px, 3.6vw, 40px)` · `line-height: 1.2` · `letter-spacing: 0.03em`
- **Color relleno:** `#faf6ee` (`-webkit-text-fill-color` alineado)
- **Contorno fino:** `-webkit-text-stroke: 0.55px rgba(197, 160, 89, 0.65)`
- **Sombra:** profundidad + halo dorado suave (mismo bloque en `rentals.html`)

### Fuentes cargadas (Google Fonts en `rentals.html`)

Incluyen **Cinzel**, **Playfair Display** (italics), **Cormorant Garamond** (títulos de tarjeta). No quitar el `<link>` de fonts sin sustituto equivalente.

---

## 2. Tarjetas del carrusel (glass / lujo)

- **Contenedor scroll:** `.grid5.cinematic-hero-cards.talent-selector-carousel`
- **Tarjeta:** `.talent-cat-card.hero-glass-card` (altura fija ~318px en estilos scoped; borde dorado, blur, sombra — ver `#rentals-talent-selector-carousel`)
- **Título de tarjeta:** Cormorant Garamond, color `#f4ead0`
- **Cuerpo:** system UI, 12px, blanco ~82% opacidad
- **CTA inferior:** `.mdj-talent-card-enter` + i18n `talent_card_enter` — **ENTRAR** (ES) / **ENTER** (EN); tipografía pequeña, mayúsculas, dorado, anclada al pie con `margin-top: auto`

Copy “qué hay dentro” + CTA: ver claves `dj_cat_desc`, `hl_cat_*`, `mc_cat_*`, `talent_staff_*`, `talent_payasos_*` en `translations.js`.

---

## 3. Carrusel infinito (sistema técnico)

- **Implementación:** `web/js/rentals.js` — `initTalentSelectorInfiniteCarousel`, `mdjTalentSelectorInfiniteApply`, `mdjRebuildTalentSelectorInfiniteCarousel`, `mdjResetTalentSelectorCarousel`
- **Patrón DOM:** `[copia de todas las tarjetas][originales][copia]`; clones con clase `.mdj-talent-carousel-clone`, sin `id`, `tabindex="-1"`, `aria-hidden="true"`
- **Medición:** con el modal **visible** (`mdjTalentSelectorInfiniteApply`); si el hub se midió con modal cerrado, los anchos salen 0 — por eso el reset al abrir usa doble `requestAnimationFrame`
- **Bordes de scroll:** cerca de `scrollLeft ≈ 0` se suma un ancho de bloque; cerca del máximo se resta — evita “fin” duro y reduce saltos de página si `overscroll-behavior-x: contain` está activo en `.mdj-talent-carousel-infinite`
- **Snap:** con infinito activo, `scroll-snap-type: none` en esa pista para no chocar con los saltos

---

## 4. Archivos tocados con más frecuencia

| Qué | Dónde |
|-----|--------|
| Tipografía hub + tarjetas + CTA | `web/rentals.html` (bloque `<style id="rentals-talent-selector-carousel">` y markup del modal) |
| Textos ES/EN | `web/translations.js` (`talent_selector_*`, `talent_card_enter`, descs por categoría) |
| Lógica carrusel | `web/js/rentals.js` |
| Barra social vs modal (solo rentals) | `web/rentals.html` estilo `#rentals-social-and-checkout-stack` |

---

## 5. Regla de oro para agentes / PRs

- **No** sustituir Cinzel/Playfair del eyebrow+título por “sans genérico” sin aprobación.
- **No** reescribir los dos textos ancla del hub sin revisión de producto (son piezas de marca).
- Cualquier nuevo hub similar debe **reutilizar estas mismas clases y tokens** antes de inventar otro sistema tipográfico.
