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
| `web/mdj-commander.html` | Prototipo del Comandante (MDJ COMMANDER — AI Executive Command), 3185 líneas | Abre con sesión y funciona; sus pantallas Radar / Decisiones / Más son de demostración y `staff.html` no las tiene; lo real (avatar, voz) ya vive en `staff.html` y en `js/`; `robots.txt` la bloquea; ningún enlace la abre | Revisar qué pantallas hay que transportar a `staff.html` («transportar, no enlazar») antes de archivarla. `staff.html` y varios `.js` la citan como origen de patrones. |

## B. Reindexación pendiente en Google (para el hilo GEO·SEO·IA)
1. **`/services.html` retirada** (301 → `/rentals.html`, en `vercel.json` y `web/vercel.json`; ya no está en el sitemap; tenía prioridad 0.9). Acción: en Search Console, inspeccionar `/services.html` y `/rentals.html`, «Validar corrección»/solicitar indexación de `/rentals.html`, reenviar `sitemap.xml`, y comprobar que `services.html` sale del índice.
2. **`sitemap.xml` cambió** (se quitó `services.html`): reenviarlo.
3. **`/wedding-planning.html`**: el PO decidió enlazarla desde Bodas (hecho, sin desplegar). Sigue en el sitemap; tras el despliegue, solicitar indexación de `/wedding-planning.html` y de `/weddings.html` (página que ahora la enlaza).
4. **`<html lang>` corregido en 36 páginas** (declaran su idioma real de origen) y **textos traducidos** en find-dj, jobs, rentals, index, login, shop, downloads, dj-knowledge, booth, certification, certification-about: pedir reindexación de las de mayor tráfico (index, rentals, find-dj, jobs, shop) tras el despliegue.
5. **`/autofill.html` borrada** (no funcionaba; estaba bloqueada en `robots.txt`, nunca indexada): no requiere acción, solo confirmar 404 en Search Console.
6. Al desplegar: verificar que las 301 respondan 301 (no 200 ni 404) en producción.

## B2. Despliegues necesarios (no basta con fusionar)
- **Edge Function `booth-chat`** (código ya apunta a `/rentals.html` en vez de `/services.html`): hay que desplegarla; hasta entonces el Booth Assistant puede seguir mandando a `/services.html` (que redirige 301, no rompe).
- **Generador de páginas de DJ** (`tools/dj-profiles/build.mjs`, sincronización diaria): ya trae las llaves i18n; la próxima corrida regenera `web/dj/*.html` con ellas.

- **Migración de la vista `public_dj_talent` (`bio_preview_en`)**: YA APLICADA en producción el 2026-09-27; nada que desplegar en la base. Falta desplegar el frontend (`find-dj.html`, `find-dj-search.mjs`) cuando se fusione el PR, y cargar la biografía en inglés de DJSolitario.

## C. Otros pendientes anotados que siguen abiertos (no urgentes)
3 stashes, 2 worktrees (dj-profile-engine-hardening con cambios; music-intel-serato-parser en pausa), 28 ramas locales sin fusionar, `certificate-template_LOCKED.html`; restos bilingües (módulo Event Cart compartido, `js/rentals.js` bloqueado, subcategorías de Jobs, banco de examen de certificación, documentos legales solo en inglés). Detalle en `docs/ESTADO_MAESTRO.md`.
