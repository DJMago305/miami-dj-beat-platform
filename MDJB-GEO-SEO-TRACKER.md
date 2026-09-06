# MDJB — GEO·SEO·IA Tracker

**Rol:** Especialista GEO·SEO·IA (Miami DJ Beat LLC)
**Alcance:** `web/*.html`, `translations.js`, `sitemap.xml`, assets de imagen/video, CSS relacionado.
**Prohibido:** `supabase/`, funciones Edge (`elixis-*`), lógica de Stripe, base de datos.
**Operación:** 100% local — cero `git push`, cero PR sin autorización explícita.

## Entorno de trabajo

- Repo: `/Users/djmago/Desktop/miami-dj-beat-platform`
- Worktree dedicado: `.worktrees/main-consolidation` (rama `main`, HEAD `18cec2f`)
- Nota: el worktree raíz del repo está en `fix/mobile-ui-cleanup` con cambios sin commitear ajenos a este hilo (tocan `supabase/functions/elixis-*`) — **no tocar, no mezclar**. Este hilo opera exclusivamente dentro de `.worktrees/main-consolidation`.
- `main` local está 9 commits adelante de `origin/main` (sin publicar).

## Los 7 activos de captación

| # | Activo | Archivo | Estado |
|---|--------|---------|--------|
| 1 | Rentals | `web/rentals.html` | ✅ presente (151.9 KB) |
| 2 | Weddings | `web/weddings.html` | ✅ presente (28.5 KB) |
| 3 | Corporate | `web/corporate.html` | ✅ presente (20.2 KB) |
| 4 | Latin DJ | `web/latin-dj.html` | ✅ presente (21.0 KB) |
| 5 | Florida Keys | `web/florida-keys.html` | ✅ presente (20.7 KB) |
| 6 | Events | `web/events.html` | ✅ presente (34.8 KB) |
| 7 | Quinceañera | `web/quinceanera.html` | ✅ creado 2026-09-03 |

## Infraestructura SEO compartida

- `web/sitemap.xml` — ✅ presente (3.7 KB)
- `web/translations.js` — ✅ presente (352 KB, i18n global del sitio)
- NAP verificado: (305) 607-1780 | miamidjbeat@gmail.com

## Matriz de Keywords & Canonical Mapping

| Activo | Keyword primaria | Canonical | Schema |
|---|---|---|---|
| `rentals.html` | Equipment Rental Miami | `/rentals.html` | Service + FAQPage (4 items) |
| `weddings.html` | Wedding DJ Miami | `/weddings.html` | Service + FAQPage (4 items) |
| `corporate.html` | Corporate DJ Miami | `/corporate.html` | Service + FAQPage (4 items) |
| `latin-dj.html` | Latin DJ Miami | `/latin-dj.html` | Service + FAQPage (4 items) |
| `florida-keys.html` | DJ Florida Keys | `/florida-keys.html` | Service + FAQPage (4 items) |
| `events.html` | Event Production Miami | `/events.html` | Service + FAQPage (4 items) |

*Verificado independientemente contra el HTML real (canonical `<link>`, conteo de bloques `@type: Service`/`FAQPage`, conteo de `Question` en `mainEntity`) antes de tabular — los 6 activos coinciden con esta matriz.*

## Auditoría de Rendimiento Base (Lighthouse Baseline)

| Activo | Performance | Accesibilidad | Best Practices | SEO |
|---|---|---|---|---|
| rentals | 56 | 94 | 96 | 100 |
| weddings | 55 | 95 | 96 | 100 |
| corporate | 56 | 94 | 96 | 100 |
| latin-dj | 56 | 94 | 96 | 100 |
| florida-keys | 56 | 94 | 96 | 100 |
| events | 56 | 96 | 96 | 100 |

*Baseline aportado por el Hilo Maestro; no re-ejecutado de forma independiente por este hilo. SEO 100/100 en los 6 — Performance es el eje débil compartido (fijo en ~55-56), consistente con el Sprint #1 abajo.*

## Plan Operativo — Sprint #1 (Optimización de Medios)

**Objetivo:** reducir LCP y Speed Index mediante conversión de imágenes hero a formato WebP/AVIF y optimización de posters en carruseles de video, sin pérdida de calidad visual perceptible.

- [x] Auditar todas las imágenes hero de los 6 activos (formato actual, peso, dimensiones servidas vs. renderizadas).
- [x] Convertir heroes/logo compartido a WebP (resize a tamaño real medido en navegador, sin `<picture>` fallback — WebP directo, consistente con `elixis-avatar.webp` ya en uso en el sitio).
- [x] Inyectar `fetchpriority="high"` / `<link rel="preload">` en los elementos LCP; `loading="lazy"` + `decoding="async"` en secundarios; `width`/`height` explícitos anti-CLS.
- [x] Re-medir Lighthouse "después" en vivo — desbloqueado, los 5 `.webp` confirmados en Storage (ver tabla y caveat abajo).
- [x] Tabla de baseline actualizada.

## Auditoría Lighthouse — Después (Sprint #1 cerrado)

| Activo | Performance | Accesibilidad | Best Practices | SEO |
|---|---|---|---|---|
| rentals | 57 | 98 | 96 | 100 |
| weddings | 56 | 98 | 96 | 100 |
| corporate | 57 | 98 | 96 | 100 |
| latin-dj | 62 | 98 | 96 | 100 |
| florida-keys | 63 | 98 | 96 | 100 |
| events | 56 | 100 | 96 | 100 |

**Accesibilidad/Best Practices/SEO — confiables, estables entre corridas.** A11y subió en las 6 (94-96 → 98-100, probablemente por los `alt`/`width`/`height` agregados). BP y SEO se mantienen idénticos al baseline.

**⚠️ Performance/LCP — NO confiables como comparación limpia contra el baseline.** Medidos con `npx lighthouse` local contra `localhost:8877` en esta máquina de desarrollo compartida (con la app de Claude Code, Chrome, y otros procesos corriendo en paralelo) — el LCP reportado va de 9.9s a **49s**, absurdo para páginas de este peso. Repetí `corporate.html` dos veces: 48/CLS 0.174 → 57/CLS 0 — la variación entre corridas consecutivas de la MISMA página, sin ningún cambio de código entre medio, confirma que es ruido de máquina/contención de CPU, no una medición real. El baseline original tampoco fue verificado de forma independiente por este hilo (fue relayado por el Hilo Maestro) — comparar un número no confiable de "antes" contra uno no confiable de "después" no produce una conclusión válida.

**Evidencia confiable del impacto real del Sprint #1** — no depende de la máquina ni del momento: el [reporte de ahorro en KB/MB](#reporte-de-ahorro--sprint-1-medido-por-tamaño-de-archivo-no-depende-de-servir-en-vivo) de arriba (8.7 MB → 309 KB, 96.5%), que es aritmética de archivo, no una medición de red simulada.

**Recomendación:** para un número de Performance que sí sirva de comparación real, correr Lighthouse contra un deploy real (Vercel preview) con PageSpeed Insights o Lighthouse CI en un runner dedicado, no en esta máquina de desarrollo compartida.

### ⚠️ Hallazgo crítico — dependencia de Supabase Storage (fuera de jurisdicción de este hilo)

`web/supabase-config.js` reescribe en runtime **todas** las rutas `./assets/...` (excepto `branding/` y `dj-avatar-placeholder.*`, explícitamente exentas en el código) hacia el bucket público de Supabase Storage — `https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/...` — que es la fuente de verdad real en producción, no `web/assets/` local (mismo patrón ya documentado para los `.mp4`, ver `RENTAL_MP4_STANDARD_LEEME.txt`).

Verificado con `curl` contra el bucket real:

| Archivo | ¿Ya en Storage? | Impacto |
|---|---|---|
| `branding/logo-transparent.webp`, `branding/logo-transparent-letras.webp` | N/A — exentos del rewrite, sirven siempre desde el deploy local/Git | ✅ Sin riesgo, funcionando ya en local |
| `home_hero_4k_wide.png` (original) | ❌ 404 en Storage — **ya estaba roto en producción antes de este sprint**, hallazgo nuevo no causado por este trabajo | El fondo difuminado de rentals/corporate/latin-dj/florida-keys probablemente no carga hoy en prod |
| `Weeding_DJ.png`, `wedding_blurred_ambient.png`, `Weeding_studios.png`, `Weeding_Baner.png` (originales) | ✅ 200 en Storage — **en vivo hoy** | Si esta rama se despliega tal cual, estos 4 se romperían porque sus `.webp` nuevos no existen aún en el bucket |

**No subí nada a Storage** — ese bucket es un recurso de Supabase, fuera de la jurisdicción estricta de este hilo (regla del ticket: cero interacción con Supabase) y fuera de mis herramientas en esta sesión.

**Decisión del Hilo Maestro (2026-08-29):** mantener las referencias `.webp` tal cual (no revertir). La subida al bucket `assets` la ejecuta el hilo con permisos de infraestructura ("Backend & Storage") — confirmado en vivo por ese hilo vía mensaje cruzado durante esta sesión; su ticket de Storage está bloqueado por falta de herramienta de subida en su sesión, pendiente de resolución con el PO.

**Lista de subida para ese hilo — rutas relativas exactas dentro de `web/assets/` (mismo prefijo en el bucket `assets`):**

```
assets/home_hero_4k_wide.webp
assets/eventos-venues-patrocinadores/galeria/Weeding_DJ.webp
assets/eventos-venues-patrocinadores/galeria/wedding_blurred_ambient.webp
assets/eventos-venues-patrocinadores/galeria/Weeding_studios.webp
assets/eventos-venues-patrocinadores/galeria/Weeding_Baner.webp
```

## Corrección — superposición de marca en header móvil (2026-08-29)

**Síntoma reportado por el PO:** en móvil (<768px), el logotipo tipográfico se superponía con el selector ES/EN y el ícono del carrito en las 6 páginas.

**Causa real (no era un bug de `.brand`/CSS del header en sí):** `web/mdj-mobile-header-fix.js` — script compartido usado en 46 páginas del sitio — inyecta un botón de menú y una marca "de emergencia" (`position:fixed`) pensados como *failsafe* para casos donde `#mainHeader` queda genuinamente oculto (sesión "visitante persistente", parpadeo `.mdj-estacion-previa`; origen: `dj-profile.html`, PR #246/#248/#251). El script montaba ese failsafe **incondicionalmente** en cualquier viewport <768px, sin comprobar si el header real ya era visible. En las 6 páginas GEO/SEO (públicas, sin gating de sesión) el header real siempre está visible — el failsafe se montaba encima de todos modos, duplicando marca+menú y produciendo la superposición. La imagen de letras del failsafe seguía apuntando al `.png` original sin tocar — confirma que esto **no lo causó el Sprint #1 de imágenes**, es un bug preexistente y sitewide (46 páginas), recién descubierto.

**Fix aplicado:** gateé el montaje del failsafe detrás de una comprobación de alcanzabilidad real (`getBoundingClientRect` de `#mobileMenuBtn` y `#mainHeader .brand`) — si el header real ya es usable, el failsafe ni se monta (y se retira si ya estaba puesto); si el header real está genuinamente inalcanzable, se monta exactamente como antes, sin cambios de comportamiento. Incluí un reintento a los 400ms para los casos donde el estado de sesión resuelve después del `DOMContentLoaded` inicial (mismo patrón de espera ya usado en `supabase-config.js`).

**Verificado en las dos rutas:**
- Header real visible (los 6 activos, mobile 390×844): failsafe NO se monta — sin superposición, sin cambios en el header real, menú hamburguesa real probado y funcional.
- Header real oculto (simulado forzando `#mainHeader{display:none}` y re-disparando el script): failsafe se monta igual que antes — los 3 bugs originales que este script resuelve siguen resueltos.

**Blast radius:** el archivo se comparte con 46 páginas del sitio, no solo las 6 GEO/SEO — el cambio es un guard estrictamente aditivo (nunca deja de montar el failsafe cuando de verdad hace falta), pero no pude probar el caso real de sesión "visitante persistente" en las páginas con gating de auth (no tengo login en esta sesión) — solo lo simulé forzando `display:none`. Recomiendo que alguien con sesión real confirme en `dj-profile.html` u otra página con ese estado antes de dar esto por cerrado a nivel sitio completo.

## Reporte de ahorro — Sprint #1 (medido por tamaño de archivo, no depende de servir en vivo)

| Archivo | Original | WebP | Ahorro |
|---|---|---|---|
| `branding/logo-transparent.webp` | 3,090.7 KB | 39.2 KB | 98.7% — **en vivo ya, 6/6 páginas** |
| `branding/logo-transparent-letras.webp` | 638.4 KB | 23.7 KB | 96.3% — **en vivo ya, 6/6 páginas** |
| `home_hero_4k_wide.webp` | 746.5 KB | 48.5 KB | 93.5% — pendiente Storage (ya rota antes del sprint) |
| `Weeding_DJ.webp` (LCP weddings) | 2,067.3 KB | 39.0 KB | 98.1% — pendiente Storage |
| `wedding_blurred_ambient.webp` | 660.0 KB | 75.9 KB | 88.5% — pendiente Storage |
| `Weeding_studios.webp` | 1,023.4 KB | 36.2 KB | 96.5% — pendiente Storage |
| `Weeding_Baner.webp` | 696.8 KB | 46.7 KB | 93.3% — pendiente Storage |
| **TOTAL** | **8,923.0 KB (8.7 MB)** | **309.3 KB** | **96.5%** |

De ese total, **3,729.1 KB (3.6 MB) ya están en vivo y sin riesgo** (logo + letras, exentos de Storage). Los **5,193.9 KB (5.1 MB) restantes** quedan listos en disco pero requieren la sincronización de Storage documentada arriba para tomar efecto sin regresión.

## Log de sesiones

### 2026-08-29 — Inicialización del hilo
- Verificados los 6 activos + sitemap.xml + translations.js en `main` (`18cec2f`).
- Creado worktree dedicado `.worktrees/main-consolidation` para aislar el trabajo de este hilo del branch `fix/mobile-ui-cleanup` (dirty, fuera de jurisdicción).
- Tracker creado.

### 2026-08-29 — Re-verificación (segunda sesión del mismo hilo)
- Colisión de sesiones detectada: este tracker ya existía (creado 16:22 por una sesión previa del mismo hilo, mismo ticket de arranque).
- Re-auditados los 6 activos byte a byte contra el tracker existente — coinciden exactamente. `sitemap.xml` confirma los 6 `<loc>` de los activos. `git status` de `web/` limpio contra `18cec2f`.
- No se sobrescribió el tracker; se preserva como registro válido y se añade esta entrada.

### 2026-08-29 — Matriz de keywords, baseline Lighthouse y plan Sprint #1
- Autorizado por el Hilo Maestro (relevo pegado en chat).
- Agregada matriz de keywords/canonical/schema — verificada independientemente contra el HTML real de los 6 activos antes de tabular (canonical, bloques Service/FAQPage, conteo de items Question).
- Agregado baseline de Lighthouse (Performance/A11y/BP/SEO) tal como fue aportado por el Hilo Maestro — no re-ejecutado por este hilo.
- Agregado plan operativo Sprint #1 (WebP/AVIF en heroes + posters de video) como próximo trabajo.

### 2026-08-29 — Ejecución Sprint #1: pipeline de medios + bloqueo de Storage descubierto
- Autorizado por el Hilo Maestro (relevo pegado en chat).
- Medidas dimensiones reales en navegador (no CSS estático) antes de elegir tamaños de resize — logo/letras/mosaicos en desktop 1280/1920 y mobile 390.
- Generados 7 WebP con Python/Pillow (sin instalar herramientas nuevas del sistema): logo, letras, home_hero_4k_wide, y los 4 del mosaico de weddings. Inspección visual de cada uno antes de wirear al HTML.
- Actualizados los 6 HTML: `src` a `.webp` + `width`/`height` en logo/letras; `fetchpriority="high"`/`<link rel="preload">` en LCP; `loading="lazy"` en secundarios de weddings; `width`/`height` anti-CLS en `Club_resident.png`/`reel-slide5-clubbing.png` de latin-dj.html (sin tocar su formato, fuera del alcance pedido).
- Confirmado que no quedan `<img>` estáticos below-the-fold sin `loading` — el resto del sitio usa `<video>`/CSS bg/JS, no imágenes sueltas.
- **Al verificar en navegador local, descubrí que `web/supabase-config.js` reescribe rutas `./assets/...` hacia un bucket de Supabase Storage en runtime** (excepto `branding/`). Verificado con `curl` contra el bucket real: los 4 archivos de weddings YA estaban en vivo en Storage con sus nombres originales; mis `.webp` renombrados no existen ahí todavía. `home_hero_4k_wide.png` resultó NO estar en Storage — bug preexistente, no causado por este sprint.
- No se subió nada a Storage (fuera de jurisdicción de este hilo). HTML queda apuntando a `.webp` tal como pidió el ticket, pero documentado como bloqueado hasta la sincronización — protegido por la regla de "cero push/PR sin aprobación" que ya impide que esto llegue a producción sin revisión.
- Lighthouse "después" no se ejecutó: correr contra el estado actual mostraría imágenes rotas en weddings.html (regresión temporal, no representa la optimización real) y sería engañoso reportarlo sin ese contexto. Queda pendiente hasta resolver el bloqueo.

### 2026-08-29 — Corrección bug de superposición móvil + coordinación cruzada
- Recibido reporte visual del PO (capturas): logo/letras superpuestos con ES/EN y carrito en móvil.
- Diagnóstico independiente en navegador (no asumí la causa del ticket) — la causa real fue un script compartido (`mdj-mobile-header-fix.js`, 46 páginas) montando un "failsafe" de marca+menú sin condición, no un problema de `.brand`/CSS. Detalle completo en la sección de arriba.
- Fix aplicado y verificado en las dos rutas (header visible → sin failsafe; header oculto simulado → failsafe intacto). Reintento a 400ms agregado para estados de sesión que resuelven tarde.
- Coordiné por mensaje cruzado con el hilo GEO/SEO paralelo (`miami-dj-beat-platform-12`) que también estaba operando en este mismo worktree: confirmé propiedad del worktree y que los 5 `.webp` están finales — evitó una posible colisión de escritura.
- Exportada la lista de rutas exactas para el hilo de Backend & Storage (bloqueado por falta de herramienta de subida en su sesión, según reportó él mismo).

### 2026-08-29 — Sincronización de Storage confirmada (por el Hilo Maestro)
- El PO subió manualmente los 5 archivos `.webp` pendientes al bucket `assets` de Supabase Storage (guiado paso a paso, dashboard). Verificado por SQL directo contra `storage.objects` (no por reporte relayado) — dos intentos previos reportados como "ya subido" resultaron falsos antes de este.
- Confirmados en Storage: `Weeding_Baner.webp` (46.7 KB), `Weeding_DJ.webp` (39.0 KB), `Weeding_studios.webp` (36.2 KB), `wedding_blurred_ambient.webp` (75.9 KB), `home_hero_4k_wide.webp` (48.5 KB) — coinciden con los tamaños de este tracker.
- **El bloqueo de "Lighthouse después" queda levantado** — las imágenes ya no estarán rotas al re-medir.
- Nota aparte (no de este hilo): aviso de seguridad de Supabase en el bucket `assets` ("Clients can list all files") — no se encontró una política RLS específica de `assets` vía `pg_policies`; se recomendó al PO usar el botón "Remove policy" del propio dashboard en vez de tocar RLS por SQL a ciegas en producción.

### 2026-09-03 — Activo #7: quinceanera.html creado (Fase 7, GEO/SEO/AEO completo)
- Nota de entorno: el worktree dedicado (`.worktrees/main-consolidation`) fue eliminado por otro hilo en algún punto de la sesión; el trabajo desde el hallazgo del bug de header móvil en adelante (incluyendo todo lo de abajo) se hizo directo en el repo raíz (`fix/mobile-ui-cleanup`, sincronizado con `main` por un proceso externo a este hilo — ver hallazgo del mismo día).
- Contexto: la tarjeta "Quinceañera" en index.html #dj-types quedó pendiente hace varios turnos (sin destino — ningún activo GEO/SEO cubría quinceañeras específicamente). El PO entregó 3 fotos reales de eventos (`/Users/djmago/Desktop/Quinceanera /`), pidió crear la página dedicada y el SEO/AEO completo ("chat gpt siri gogle").
- `web/quinceanera.html` creado calcado de weddings.html (mismo patrón editorial, misma estructura): JSON-LD Service + FAQPage (4 preguntas: vals, corte/damas y chambelanes, sorpresas, MC bilingüe), meta description, canonical, GA4, mosaico de 3 fotos reales optimizadas (900x600 + 2×720x540, recortadas de originales de 3.2-5.7 MB a 70-115 KB c/u).
- Mesh de enlaces interno completado (matching el patrón `feat(nav): implement detached floating services dropdown` de la Fase 2): agregado a `SERVICES` en `mdjb-shared-header.js` (el dropdown real de "SERVICIOS" — la única puerta de navegación entre estas páginas), footer cross-link en las 6 páginas existentes + la nueva, tarjeta del home ahora sí enlaza a `quinceanera.html`, entrada en `sitemap.xml`.
- Incidente de nombres de carpeta: el PO renombró `web/assets/quinceanera/` → `Quinceañera/` (mayúscula+ñ) en Finder; al intentar crear esa misma carpeta en el dashboard de Supabase Storage, el botón "New folder" la rechazó — su validación de nombre es más estricta que la API de subida directa. Revertido a `quinceanera/` (minúsculas, sin acento) para igualar la convención del resto del sitio y evitar el problema de raíz permanentemente.
- Todo verificado en vivo en `localhost:8000` (único puerto autorizado): JSON-LD parsea sin error, mosaico carga las 3 fotos, dropdown de Servicios lista las 7 páginas, footer y tarjeta del home enlazan correctamente.
- ⚠️ Pendiente de Storage: 3 `.webp` en `assets/quinceanera/fotos/` necesitan subirse antes de producción — mismo patrón del resto del sprint. Video de quinceañera pendiente de que el PO lo busque.

## Nota de entorno (2026-09-06)

`.worktrees/main-consolidation` (mencionado arriba) fue eliminado durante una limpieza de git — estaba limpio, sin trabajo pendiente, así que no se perdió nada. Desde entonces este hilo opera directo sobre el repo raíz, en `main` (sincronizado con `origin/main` vía PRs individuales, nunca push directo). La cifra "9 commits adelante" de la sección de arriba ya no aplica — ver reconciliación real en el log de abajo.

### 2026-09-05 — Fix canonical/www (Search Console) + Events hub maduro

- **Search Console configurado por primera vez** en esta propiedad; hallazgo real: `sitemap.xml`, `robots.txt` y los `<link rel="canonical">` de 31 páginas apuntaban al dominio apex (`miamidjbeat.com`) mientras Vercel redirige (307→308) a `www.miamidjbeat.com` — causaba "Duplicada: sin versión canónica" en Google. Corregido en las 31 páginas + sitemap + robots. Vercel migrado de 307 a 308 (permanente) por el PO, guiado paso a paso.
- **Ticket formal "Events SEO/GEO/AEO"**: auditoría de 10 puntos entregada antes de tocar código. `events.html` madurado con hreflang (es/en/x-default), Open Graph, y JSON-LD `Event`+`eventSchedule` real (sin `startDate` inventado) para las 4 residencias reales (Mojitos Calle 8, El Valle, Sundowners brunch/dinner).
- **`one-hit-wonder.html` nueva** — página dedicada para el show itinerante de DJMago305, usando `schema.org/EventSeries` (no `Event`) para no fabricar fechas/ubicación. Sección "Backend/Producto" (CRUD venues, checkout tickets, QR/WhatsApp) documentada y **remitida a otro hilo**, no ejecutada aquí.
- **Hero banner horizontal en `events.html`**: video real de venue, con retry contra la política de Chrome de pausar "video-only background media" — investigado a fondo (contando pausas/reproducciones reales), confirmado que el ciclo de pausa/reproducción era una condición del entorno del navegador en ese momento, no un defecto del código (se reprodujo igual en `weddings.html`, ya estable). Re-codificado a 1280×720 (antes 1920×1080) por ser mejora legítima independiente.
- **Banner de bodas retirado** de `events.html` (diluía intención de búsqueda del hub público) + residencias reordenadas por día real y zona geográfica real agregada a cada tarjeta.
- **Causa raíz real del video que nunca cargaba**, encontrada tras una falsa pista de "caché de CDN por nombre de archivo": `events.html` usaba ruta **relativa** (`./assets/...`), pero `.gitignore` excluye todo `web/assets/**/*.mp4` del repo a propósito ("served from Supabase Storage") — el video nunca se despliega ahí sin importar el nombre. Confirmado con control: `weddings-hero.mp4` (video ya en uso, dado por funcional) **también** daba 404 en producción por la misma razón. Corregido a URL absoluta de Supabase Storage, siguiendo el patrón ya usado en `staff.html` (avatar DJMago). **Nota para cualquier hilo futuro**: ningún `<source>`/`src` de video en este sitio debe usar ruta relativa.
- PRs de este ciclo: #301 (canonical/www), #303 (events hub), #304 (One Hit Wonder), #305 (hero banner), #306 (wedding banner + reorden), #307 (cache-bust, superado), #308 (fix real de ruta absoluta) — todos mergeados por el PO.

### 2026-09-05/06 — Auditoría de Autoridad, Citations y Local SEO (sin implementación)

Ticket de auditoría pura ("no crear nada antes de comprobar qué existe"), entregado en formato A-J con evidencia real (no navegado por este hilo directamente — se delegó a 2 investigaciones en paralelo con agentes, más auditoría interna del código hecha por este hilo):

- **Citations externas — hallazgo principal: presencia casi nula.** Google Business Profile: ROJO, sin ficha, confirmado con fetch directo a Google (sin panel de conocimiento ni Local Pack). Yelp, WeddingWire, The Knot, TikTok, medios locales: ROJO (ausentes). Facebook/Instagram/YouTube/Bing: GRIS (no verificable por bloqueos de login de esas plataformas a herramientas automatizadas — requiere verificación manual del PO logueado). Único hallazgo positivo: ficha de bajo perfil en `guidetoflorida.com` con **inconsistencia de NAP** (publica una dirección residencial que no aparece en ningún canal oficial) — pendiente de que el PO confirme si es suya.
- **Competencia (10 negocios reales investigados)**: 3-4/10 confirmados en vivo en el Local Pack de Google para "DJ Miami"; 7/10 tienen ficha en WeddingWire; solo 3/10 tienen posicionamiento latino dedicado (Miami DJ Beat sí tiene ángulo latino auténtico — DJMago305, residencias reales — pero sin las citations para que Google lo priorice todavía). **AI Overview de Google verificado en vivo**: para "DJ Miami" recomienda a Miami DJs/Miami Party DJ; para "Latin DJ Miami" recomienda a DJ Zapmar/DJ Coke — Miami DJ Beat no aparece en ninguno.
- **Auditoría interna del código**: `sameAs` inexistente en el schema de Organization pese a que las cuentas reales (`facebook.com/miamidjbeat`, `instagram.com/miamidjbeat`, etc.) sí existen en el HTML de `contact.html`/`equipo.html` — corregido. `DJMago305` mencionado por nombre en 5 páginas públicas sin enlazar nunca a su perfil canónico `/dj/djmago305.html` — corregido (con el hallazgo adicional de que `i18n.js` aplica `innerHTML`, así que el link debe vivir en `translations.js`, no solo en el HTML estático, o se pierde en cada carga). `aggregateRating` de 1★/1 reseña en `djsolitario.html`/`djyuyo.html` expuesto públicamente en JSON-LD — riesgo real de rich snippet dañino, removido. `<title>` del home 100% de marca sin término genérico — corregido a "Miami DJ Beat — DJ in Miami & Event Production".
- **Ruta de activación de Google Maps entregada al PO (2026-09-06)**, fuera de la jurisdicción de este hilo (requiere cuenta real en `business.google.com`, verificación postal/telefónica): categorías DJ Service + Academia, área de servicio (Miami, Brickell, Wynwood, Coral Gables, Doral, Miami Beach), vínculo web, campaña de reseñas reales. Reconfirmado con búsqueda en vivo el mismo día: sigue sin existir ficha de Maps.
- PRs de este ciclo: #308 (sameAs, link DJMago305, aggregateRating, título home).

### 2026-09-06 — Módulo "Método de Cabina" en Academia (manual completo)

- Origen: PDF propio del PO (Ley Cero, 18 reglas, 12 módulos, rúbrica 0-5, faltas críticas, credo), con su propio "Prompt Maestro" pidiendo auditoría previa antes de código.
- Auditoría previa: inventario de toda la sección Academia existente (`courses.html`, `certification.html`/`certification-about.html`, `dj-knowledge.html`, `standards.html`, `practical-evaluation.html`) — hallazgo clave: `standards.html` ya cubre parte de "faltas críticas" (5 estándares + 7 prohibiciones), así que el manual nuevo **enlaza** en vez de duplicar.
- `web/metodo-cabina.html` nueva, 4º float tab en `academia.html`. 3 diagramas técnicos interactivos (SVG + vanilla JS): Arco de Energía, Diagnóstico de 15s + Rescate, Cadena de Señal + Plan B.
- **Ciclo de auditoría de gaps propio** (pedido por el PO antes de comitear): la v1 era transcripción comprimida del PDF, sin el principio de certificación "¿por qué hiciste lo que hiciste?", sin cruce con `practical-evaluation.html`/`courses.html`, sin diagramas no-musicales. Corregido: 18 reglas expandidas a profundidad real de manual (checklist "Maleta Blindada" + anatomía de track en Regla 1; protocolo Floor Manager/bartenders/seguridad en Regla 3), 12 módulos restructurados como "Taller de Entrenamiento Práctico" (Contexto/Detonante/Objetivo), bloque "Defensa de Criterio" (5 preguntas guía), bloque "Jerarquía Académica" enlazando a evaluación práctica + examen de certificación, banner "Lectura Obligatoria" en `courses.html` sin tocar sus LOCKED SECTIONS, 2 diagramas estáticos más (Zonificación del Salón, Protocolo de Cierre).
- **Hallazgo de SEO real, más grave que un metadato**: las 18 reglas y 12 talleres se generaban 100% por JavaScript — el HTML crudo (lo que ve un crawler sin ejecutar JS) los mostraba **vacíos**. Convertido a renderizado estático real, verificado con `curl` sin JS: 18 + 12 tarjetas completas presentes.
- Geo-SEO: meta tags `geo.region`/`geo.placename`/`geo.position`/ICBM, JSON-LD `@graph` (Course + FAQPage con 9 preguntas honestas, `areaServed` con Miami/Miami Beach/Brickell/Wynwood/Coral Gables/Doral/Fort Lauderdale), Open Graph con foto real de DJMago en cabina (`djmago305-good-vibes-laptop-hero.webp`, verificada 200 en producción).
- **Decisión deliberada documentada**: `isAccessibleForFree` se dejó en `true`, no `false` como se pidió en un momento — el muro de "Área Exclusiva para DJs Suscritos" es un teaser puramente visual (`backdrop-filter`), el HTML sigue completo para todos; afirmar `false` habría sido un dato estructurado falso ante Google. Tampoco se construyó el modal de captura de leads (nombre/email/WhatsApp) que se propuso en un punto — sin backend real detrás habría mostrado una confirmación falsa a usuarios reales.
- **Desbloqueo real por sesión** agregado después (aprobado explícitamente): detecta sesión vía `window.getSupabaseClient()` (mismo punto de entrada que usa `mdjb-shared-header.js`), oculta el muro para DJs logueados, sin tocar el HTML estático de fondo (SEO intacto, verificado de nuevo con `curl`).
- Botón flotante de compartir agregado (`navigator.share` nativo + micro-menú de escritorio con copiar enlace/WhatsApp, reutilizando `wa.me` como en `venue-room.html`).
- PRs de este ciclo: #313 (manual completo + fondo + geo-seo + FAQ), #314 (compartir + desbloqueo de sesión) — ambos mergeados por el PO.
