# SESSION LOG — 2026-06-17
**Plataforma:** Miami DJ Beat LLC  
**Rama base:** `main`  
**PR mergeado a main:** `feat/search-007-universal-search` (commit `d484caa`)  
**Deployment Vercel:** pendiente confirmación en producción  
**Sesión:** 2026-06-17 09:44 — 11:05 UTC-4

---

## TICKETS COMPLETADOS

### TICKET-SEARCH-007 — Universal Smart Search + Find-DJ Redesign

**Objetivo:** Pulir el buscador del header para que funcione como buscador universal del sitio — búsqueda por nombre de artista, categoría de talento y equipo de renta; y rediseñar las tarjetas de resultados de `find-dj.html`.

**Archivos modificados:**
- `web/find-dj.html`
- `web/header-smart-search.js`
- `web/js/rentals.js`
- `web/js/mdj-cart-pill.js`

---

### Cambios detallados

#### `web/find-dj.html`

1. **Hero eliminado** — Se removieron: badge "Verified Talent Network", título "Find the Perfect DJ Beat", subtítulo, formulario de filtros (Talent Category, Area, Budget, SEARCH TALENT), notas de texto y todo su CSS asociado.

2. **Elementos de página eliminados** — Fecha auto-rellena (`f-date`), barra social lateral (`mdj-social-bar.js`), `find-dj-priority-note`, `find-dj-client-hint`.

3. **Tarjetas rediseñadas** — De chips compactos (132px, foto 72px circular) a tarjetas completas:
   - Grid: `minmax(220px, 1fr)` — 2 columnas en mobile < 500px
   - Foto: 100% width, aspect-ratio 1:1, zoom en hover
   - Specialty tag flotante sobre la foto
   - Nombre (15px bold), ciudad, bio (2 líneas)
   - Badge PRO/LITE en la fila del nombre
   - Botón RENTAR siempre al fondo (flex: 1 en `.find-dj-chip__link` y `.find-dj-chip__body`)

4. **Auto-búsqueda al cargar** — `DOMContentLoaded` siempre llama `searchDJs()`.

5. **Lógica de búsqueda en cascada** (3 intentos):
   - `selectFull` + `stage_name OR full_name OR mdjb_id` (contains)
   - `selectMid` + `stage_name OR full_name` (si falla mdjb_id)
   - `selectMin` + solo `stage_name` (fallback mínimo)

6. **Modos de filtrado:**
   - `?q=nombre` → `stage_name/full_name/mdjb_id.ilike.%nombre%` (contiene)
   - `?specialty=bartender` → `artist_specialty.ilike.%bartender% OR roles.ilike.%bartender%` (tokens multi-palabra)
   - Sin params → directorio DJ: `artist_specialty.ilike.%dj% OR roles.ilike.%dj%`

7. **Version string actualizado** — `mdj-shared-header.js` → `?v=20260617-db-wins-buyer-fix`

---

#### `web/header-smart-search.js`

1. **`RENTAL_TALENT_INTENTS`** — Array de 12 categorías de talento/equipo con regex bilingual (ES + EN), cada una con:
   - `re` — regex para detectar la intención
   - `specialty` — tokens para filtro en find-dj.html
   - `findLabel` / `rentLabel` — textos del dropdown
   - `rentHref` — URL de rentals.html con `?open=<modal>`

   | Categoría | Keywords ES | Keywords EN |
   |---|---|---|
   | MC / Presentador | mc, presentador, maestro, ceremonia | emcee, host, announcer, presenter |
   | Staff | bartender, bart, mesero, chef, barra | waiter, server, catering |
   | Payasos | payaso, circo, show, mimo | clown, circus, entertainer, juggler |
   | Hora Loca | hora, hora loca, robot, personaje | crazy hour, character, led |
   | Músicos | musico, saxo, percusi, timbal, banda | musician, saxophone, live band, drummer |
   | Audio | audio, sonido, microfono, bocina, mixer | sound, microphone, mic, speaker |
   | Iluminación | iluminacion, laser, pantalla | lighting, lights, screen, led wall |
   | FX | fx, efecto, confeti, chispa, niebla | effects, confetti, spark, fog, smoke |
   | Furniture | mueble, silla, mesa, decoracion | furniture, chair, table, decor, linen |
   | Carpas | carpa, toldo | tent, canopy |
   | Kids | inflable, castillo, niño, brinca | inflatable, bounce, kids, castle |
   | Escenario | escenario, tarima, truss | stage, concert, truss, staging |

2. **`renderRentalTalentQuickLink`** — Dropdown con DOS opciones (igual que DJ):
   - "Ver [categoría] disponibles" → `find-dj.html?specialty=<tokens>`
   - "[Categoría] — Rentar" → `rentals.html?open=<modal>`

3. **`renderNameSearchQuickLink`** — Fallback para cualquier búsqueda sin intent:
   - Muestra "🔍 Buscar '[query]' en el directorio"
   - Navega a `find-dj.html?q=[query]`

4. **DJ dropdown ampliado** — Segunda opción "DJ / Actuación — Rentar" → `rentals.html?open=dj`.

5. **`resolveQuery` (Enter)** — Orden de prioridad:
   1. DJ directory intent → `find-dj.html?from=header`
   2. Rental talent intent → `find-dj.html?specialty=<tokens>`
   3. Public route match
   4. Account destinations
   5. Event teasers → si vacío → `find-dj.html?q=[query]`

---

#### `web/js/rentals.js`

**Handler genérico `?open=<categoría>`** al final de `DOMContentLoaded`:

| `?open=` | Modal | Render function |
|---|---|---|
| `dj` | `dj-modal` | `renderDjHero('weddings', false)` |
| `staff` | `staff-modal` | `renderStaffHero('bartender', false)` |
| `mc` | `mc-modal` | — |
| `horaloca` | `horaloca-modal` | `renderHoraLocaCatalogue()` |
| `payasos` | `payasos-modal` | `renderPayasosHero('gif', false)` |
| `roster` | `roster-modal` | `renderLiveHero('sax', false)` |
| `fx` | `fx-modal` | `renderFxHero('sparks', false)` |
| `lighting` | `lighting-modal` | — |
| `audio` | `rental-dynamic-modal` | `renderRentalCatalog('audio')` |
| `furniture` | `rental-dynamic-modal` | `renderRentalCatalog('furniture')` |
| `tents` | `rental-dynamic-modal` | `renderRentalCatalog('tents')` |
| `inflatables` | `rental-dynamic-modal` | `renderRentalCatalog('inflatables')` |
| `stages` | `rental-dynamic-modal` | `renderRentalCatalog('stages')` |
| `lighting-gear` | `rental-dynamic-modal` | `renderRentalCatalog('lighting')` |

Delay de 120ms para asegurar que el DOM esté listo antes de abrir el modal.

---

#### `web/js/mdj-cart-pill.js`

**Bug fix `qty:0`:** La expresión `parseInt(l.qty, 10) || 1` retornaba `1` para items con `qty: 0` (falsy), mostrando badge "1" en carrito aparentemente vacío.

```js
// ANTES: (parseInt(l.qty, 10) || 1) → 0||1 = 1 para qty:0
// DESPUÉS:
var n = parseInt(l.qty, 10);
return sum + (n > 0 ? n : 0);
```

---

## TICKETS PENDIENTES (abiertos para próximas sesiones)

| Ticket | Descripción | Estado |
|---|---|---|
| TICKET-DJTOOLS-006 | MDJPRO App standalone no purchasable (Stripe Price ID pendiente) | Pendiente |
| TICKET-COMMS-001 | Staff Communication System (notificaciones + alertas) | Pendiente — estratégico |

---

## REGLAS ANTI-REGRESIÓN ESTABLECIDAS

1. **Jean Poul no debe aparecer en búsqueda "dj"** — El filtro de directorio usa `artist_specialty.ilike.%dj%` (no slug). `dj_slug` fue removido del name search.
2. **Booth Assistant permanece en find-dj.html** — No remover `mdj-assistant.js` de esta página.
3. **`?open=<modal>` en rentals.js** — El handler está al final del `DOMContentLoaded`; no duplicar ni romper el OPEN_MAP.
4. **Botón RENTAR siempre al fondo** — `flex: 1` en `.find-dj-chip__link` es mandatorio para alinear tarjetas de diferente altura.
5. **Búsqueda en cascada (3 niveles)** — No simplificar a un solo query; `mdjb_id` y `full_name` pueden no existir en la vista pública.
