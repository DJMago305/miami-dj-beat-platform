# TICKET CONSOLIDADO — URGENTE — Páginas en revisión y reindexación
Creado 2026-09-27 a pedido del PO. Estado: **PENDIENTE URGENTE**. Dueño: hilo GEO·SEO·IA (Search Console / GA4) + hilo maestro.

## Regla del PO (2026-09-27)
- Una página que **funciona pero no está terminada NO se borra**: se documenta aquí y se revisa poco a poco.
- Solo se borra lo que **no funciona** y no tiene dueño, tras análisis forense (referencias, historial de git, prueba en el navegador).
- Todo lo que haya que **reindexar** en Google se anota en este ticket, consolidado. Nunca se resuelve "de paso" dentro de otro trabajo.

## A. Páginas que funcionan pero no están terminadas (NO borrar; revisar de a poco)
Declaradas `PENDIENTE DEL PO` en `ALLOW` de `web/scripts/check-hygiene.mjs` para que el candado no las marque ni se pierdan.

| Página | Qué es | Evidencia (2026-09-27) | Falta / decisión |
|---|---|---|---|
| `web/wedding-planning.html` | Planificación de bodas (paquetes Full Planning, etc.), página SEO creada 2026-09-22 (commit 44a456eb) | Abre con encabezado y contenido real; en el sitemap con canonical propio; está en las listas de servicios de `mdjb-shared-header.js` y `scripts/verificar-contenedores.mjs` | **DECIDIDO 2026-09-27 (PO): se enlaza desde Bodas — HECHO** (línea dorada bajo «clases de baile» en `weddings.html`, ES/EN con llaves `wedding-planning-link`). Sigue abierta la revisión de su contenido e idioma (poco a poco) y la reindexación (B.3). |
| `web/mdj-commander.html` | Prototipo del Comandante, 3185 líneas | **RETIRADA 2026-09-27** (orden del PO, tras revisión forense): corría con un motor de voz/avatar viejo (`avatar-heygen-stream.js`) que nadie más en el sitio usa — `staff.html` ya usa el motor consolidado `elixis-voice-session.js`. Sus únicas pantallas propias (Radar/Decisiones/Más) no funcionan (el propio código de `staff.html` lo confirma: «navegan a pantallas… que no existen aquí»). Sin enlaces, bloqueada en `robots.txt`, sin cambios reales desde el 7 sept. | Cerrado. Archivo borrado (recuperable del historial de git); `avatar-heygen-stream.js`/`avatar-frame-player.js` quedan sin usar, se retiran en un trabajo aparte. |

## B0. Confirmado en producción por este hilo (2026-09-27)
- Las 301 de `services.html`/`services` responden **308** (Vercel usa 308 para `permanent:true`; para Google equivale a 301) → `/rentals.html`. `/autofill.html` da 404.
- `sitemap.xml` en producción: sin `services.html`, con `wedding-planning.html`.
- **Nada de esto lo puede confirmar/ejecutar este hilo en Search Console o GA4** — esa cuenta de Google solo la tiene conectada el hilo de conversación «GEO·SEO·IA» (ver memoria `reference_geo_seo_ia_thread_google_access`). Lo de abajo (B.1-B.4) queda para ese hilo.

## B — RESUELTO 2026-09-27 (la cuenta miamidjbeat@gmail.com SÍ tiene acceso; el fallo inicial fue mío — usé el formato de propiedad de dominio `sc-domain:` en vez de la propiedad real, de prefijo de URL `https://www.miamidjbeat.com/`)
1. `/services.html`: **nunca estuvo indexada** (última rastreada 17 ago 2026, antes de retirarla) — no hace falta pedir su eliminación del índice.
2. `/rentals.html`: ya estaba indexada. ✔
3. `/wedding-planning.html`: ya estaba indexada; se pidió **reindexación** (confirmado: «Se ha solicitado la indexación», cola de rastreo prioritaria) para que tome el contenido de hoy (enlace desde Bodas).
4. `weddings.html`: ya estaba indexada; se pidió **reindexación** (confirmado) para que tome el gancho de planificación nuevo.
5. `sitemap.xml`: **reenviado** (Sitemaps → Enviado: 27 sept 2026; antes 22 sept). Google aún no lo relee (eso lo hace por su cuenta).
6. `/autofill.html`: no requiere acción — nunca se indexó.

Reindexación de las 4 páginas de mayor tráfico — **HECHO 2026-09-27** (orden del PO «pide reindexación de index, find-dj, jobs y shop»):
- `https://www.miamidjbeat.com/` (home; canonical real, no `/index.html`): ya indexada, reindexación solicitada. ✔
- `find-dj.html`: **nunca se había rastreado** («Descubierta: actualmente sin indexar», sin página de referencia detectada) — se solicitó su primera indexación.
- `jobs.html`: ya indexada, reindexación solicitada. ✔
- `shop.html`: ya indexada, reindexación solicitada. ✔

Las 4 confirmaron «Se ha solicitado la indexación» (cola de rastreo prioritaria). Queda `downloads.html`, `dj-knowledge.html`, `certification.html` y las demás páginas traducidas por pedir cuando convenga; no es urgente.

## B-antiguo (ya resuelto arriba, se deja como referencia)
1. **`/services.html` retirada** (301 → `/rentals.html`, en `vercel.json` y `web/vercel.json`; ya no está en el sitemap; tenía prioridad 0.9). Acción: en Search Console, inspeccionar `/services.html` y `/rentals.html`, «Validar corrección»/solicitar indexación de `/rentals.html`, reenviar `sitemap.xml`, y comprobar que `services.html` sale del índice.
2. **`sitemap.xml` cambió** (se quitó `services.html`): reenviarlo.
3. **`/wedding-planning.html`**: el PO decidió enlazarla desde Bodas (hecho, sin desplegar). Sigue en el sitemap; tras el despliegue, solicitar indexación de `/wedding-planning.html` y de `/weddings.html` (página que ahora la enlaza).
4. **`<html lang>` corregido en 36 páginas** (declaran su idioma real de origen) y **textos traducidos** en find-dj, jobs, rentals, index, login, shop, downloads, dj-knowledge, booth, certification, certification-about: pedir reindexación de las de mayor tráfico (index, rentals, find-dj, jobs, shop) tras el despliegue.
5. **`/autofill.html` borrada** (no funcionaba; estaba bloqueada en `robots.txt`, nunca indexada): no requiere acción, solo confirmar 404 en Search Console.
6. Al desplegar: verificar que las 301 respondan 301 (no 200 ni 404) en producción.

## B2. Despliegues necesarios (no basta con fusionar)
- **Edge Function `booth-chat`** — **DESPLEGADA 2026-09-27** (`apply` vía Supabase MCP, versión 64, `verify_jwt` se dejó en `false` como ya estaba — es pública, sin login). Verificado con una llamada real desde `miamidjbeat.com` (sin sesión): responde con `/rentals.html`.
- **Generador de páginas de DJ** (`tools/dj-profiles/build.mjs`, sincronización diaria): ya trae las llaves i18n; la próxima corrida regenera `web/dj/*.html` con ellas.

- **Migración de la vista `public_dj_talent` (`bio_preview_en`)**: YA APLICADA en producción el 2026-09-27; nada que desplegar en la base. Falta desplegar el frontend (`find-dj.html`, `find-dj-search.mjs`) cuando se fusione el PR, y cargar la biografía en inglés de DJSolitario.

## C. Otros pendientes anotados que siguen abiertos (no urgentes)
3 stashes, 2 worktrees (dj-profile-engine-hardening con cambios; music-intel-serato-parser en pausa), 28 ramas locales sin fusionar, `certificate-template_LOCKED.html`; restos bilingües (módulo Event Cart compartido, `js/rentals.js` bloqueado, subcategorías de Jobs, banco de examen de certificación, documentos legales solo en inglés). Detalle en `docs/ESTADO_MAESTRO.md`.
