# TICKET — `tools/dj-profiles/build.mjs`: plantilla desactualizada + sin protección de contenido hand-curated
Creado 2026-09-28, tras la primera auditoría real de este generador en meses (item pendiente de la lista maestra: "nunca se dejó seguro para volver a correrlo"). Estado: **RESUELTO Y CONSTRUIDO (2026-09-28)** — ver sección final.

## Qué se hizo hoy (sin dañar nada, todo revertido)
1. Se leyó el archivo completo (1233 líneas) — tiene una cantidad enorme de blindaje **estructural** ya construido: 20 "Correcciones" documentadas (aborto ante colisión de slug, roster vacío, ancla de identidad de `djmago305` protegida contra borrado automático, JSON-LD escapado contra inyección, manifiesto de slugs para distinguir rename de baja real, `seo_publish_status` como compuerta editorial estricta).
2. Se corrió el test suite ya existente (`build.test.mjs`, 22 pruebas) — **1 fallaba**: el `@id`/schema Person que el generador quiere escribir en `equipo.html` para Gerardo A Valle no coincidía con el archivo real en vivo (que está simplificado a propósito, sin `alternateName`).
3. **Corregido y CONFIRMADO por el PO**: `PERSON_IDENTITY.owner` en `build.mjs` ya no lleva `alternateName` — converge a la versión mínima real. El PO también confirmó que `jobTitle`/`image`/`worksFor` SÍ deben estar en `equipo.html` (se habían perdido sin querer) — se restauraron a mano en el archivo real, generándolos con la propia función `renderTeamPage()` para que sean byte-idénticos a lo que el generador produce. Test suite: **22/22 en verde**.
4. Se corrió `--dry-run --reconcile` contra producción real: el plan fue perfecto — 5 DJs elegibles reales (incluye a DJ Ary y JULITO DJ PMM, con las bios agregadas hoy mismo), 4 no elegibles con la razón exacta, cero datos inventados.
5. **Se corrió DE VERDAD** (`MDJB_ENV=PROD node tools/dj-profiles/build.mjs --reconcile`, sin `--dry-run`) para verificar el resultado final antes de armar un PR. **Esto reveló el problema real** — ver abajo. Todo se revirtió con `git checkout` antes de comitear nada; nada llegó a git ni a producción.

## Hallazgo real: el generador sobrescribe sin avisar archivos editados a mano después de su última corrida
La corrida real dañó 5 archivos existentes:
- **`web/dj/directorio.html`**: perdió el hero de video de pantalla completa, el formulario de búsqueda (ciudad/fecha/tipo de evento), el layout de franjas apiladas (`.djidx-strip-list`) y las insignias de experiencia por venue — todo trabajo real de sesiones recientes (incluida esta misma sesión). El propio archivo tenía, ANTES de que esta corrida lo borrara, un comentario explícito: *"Editado a mano: tools/dj-profiles/build.mjs NO se puede correr sobre esta página sin perder datos hand-curated"* — referenciando `docs/tickets/2026-09-27-URGENTE-dj-profile-engine-hardening-hallazgos.md` (ese ticket no se leyó antes de correr el generador; debió leerse primero).
- **`web/equipo.html`**: la reescritura completa **borró las tarjetas de Wendy E Ayala y ELIXIS** — son contenido hand-authored, no vienen de ninguna fila de `dj_profiles`, así que `renderTeamPage()` no las conoce y las descarta al regenerar el archivo entero.
- **`web/dj/djmago305.html`**: perdió 5 de 8 etiquetas de especialidad hand-curated (Wedding, Resident, Warm-Up, Club, Luxury Events, Radio → quedaron solo 3 genéricas derivadas de `artist_specialty`), perdió el enlace de Beatport, perdió `mdj-lang-boot.js`, y **revirtió los cache-busts de varios `<script>` a versiones viejas** (`?v=20260904-dj-profiles` en vez de `?v=20260921-...`) — riesgo real de servir JS obsoleto.
- **`web/dj/djyuyo.html`**: revirtió `og:image`/`twitter:image` a una foto de portada anterior (existe una más nueva en producción que el generador no conocía).
- **`web/dj/djsolitario.html`**: perdió `mdj-lang-boot.js` (el único cambio "bueno" fue que sí agregó el párrafo de `bio_en`, que es contenido real y deseado).

**Causa raíz**: `isManagedProfileFile()` solo verifica *propiedad* (¿tiene la marca `notranslate page-dj-profile` + un `<link rel="canonical">` que calza?) — nunca verifica si el archivo fue editado a mano desde la última corrida. Cualquier archivo que "reconoce" como propio se sobrescribe entero, sin diff, sin fusión, sin aviso.

## Hallazgo real #2: hasta los archivos NUEVOS salen con plantilla vieja
`HEADER_HTML`/`FOOTER_AND_SCRIPTS_HTML` (constantes de HTML copiadas a mano dentro de `build.mjs`) no incluyen `<script src="/js/mdj-lang-boot.js">` — que hoy ya es parte estándar de **71 de 91 páginas** del sitio. Los 2 archivos genuinamente nuevos que la corrida creó (`dj-ary.html`, `julito-dj-pmm.html`, sin nada previo que perder) salieron con esa plantilla desactualizada — se borraron también, no son seguros para publicar tal cual.

## Qué queda ganado de hoy (real, verificado, listo para commitear aparte)
- El fix de `PERSON_IDENTITY.owner` (sin `alternateName`) + la restauración de `jobTitle`/`image`/`worksFor` en `equipo.html` — 22/22 pruebas en verde. Esto es independiente del resto del ticket y seguro de fusionar ya.

## RESUELTO (2026-09-28) — construido, probado, verificado contra producción real

**1. Plantilla refrescada.** `HEADER_HTML`/`FOOTER_AND_SCRIPTS_HTML` y el `<head>` de las 3 funciones de render (`renderPage`/`renderIndexPage`/`renderTeamPage`) ahora incluyen `<script src="/js/mdj-lang-boot.js?v=20260927-boot">` (copiado literal de `web/dj/djmago305.html` real) y los cache-busts vigentes de `mdj-identity.js`/`auth.js`/`mdjb-shared-header.js` (`?v=20260921-*`, antes `?v=20260904-dj-profiles`). Documentado en el propio código que estos valores no se autoactualizan — quien vuelva a tocar el generador debe re-copiarlos de una página real.

**2. Protección de contenido hand-curated — dirección elegida: (b), sacar las páginas compartidas del alcance del generador por completo.** Rediseño real del `main()`:
- El generador **solo crea** páginas de perfil que **no existen todavía en disco** (`plan.create`) — nada que perder ahí.
- **Nunca vuelve a escribir** un perfil que ya existe (`plan.keep`), sin importar cuánto haya cambiado la fila en la base desde la última corrida.
- **`directorio.html` y `equipo.html` quedan permanentemente fuera del alcance de escritura automática** — el generador nunca los toca. En vez de escribirlos, imprime un aviso de "ACCIÓN MANUAL REQUERIDA" con la lista exacta de slugs nuevos que hay que agregar a mano.
- El borrado (`--reconcile`) sigue intacto — sigue siendo seguro porque solo borra páginas de perfil individuales que el propio generador creó y cuyo DJ ya no está en el roster, nunca páginas compartidas.

**3. Etiquetas "ricas" de `djmago305.html` — investigado.** Confirmado por SQL directo: `dj_profiles` no tiene ninguna columna de tags (`information_schema.columns` sin resultados para `%tag%`). Las 8 etiquetas (Wedding, Resident, Warm-Up, Club, Luxury Events, Radio...) son 100% hand-curated, sin respaldo en la base — no es un campo que falte en `FETCH_COLUMNS`, es contenido editado a mano legítimo. Con el rediseño del punto 2, `djmago305.html` nunca se vuelve a reescribir, así que esas etiquetas quedan protegidas automáticamente.

**Verificación:**
- Test suite: **23/23 en verde** (se agregó la prueba 23, que corre el generador en modo REAL — sin `--dry-run` — contra un scratch temporal vía `MDJB_OUTPUT_DIR`, con un perfil marcado como "ya existente" + `directorio.html`/`equipo.html` con contenido hand-curated sintético, y confirma que ninguno de los tres se toca, mientras que perfiles genuinamente nuevos sí se crean).
- Corrida real contra producción (`MDJB_ENV=PROD`, `MDJB_OUTPUT_DIR=/tmp/...`, sin tocar `web/`): las 5 páginas correctas (djmago305, dj-ary, djsolitario, djyuyo, julito-dj-pmm) se listaron como `CREATE` porque el scratch estaba vacío — comportamiento esperado y correcto para esa validación aislada. La página nueva (`dj-ary.html`) confirmó traer `mdj-lang-boot.js` y los cache-busts vigentes.
- `web/assets/lighting/` (hallazgo aparte, encontrado durante esta misma auditoría): NO se toca — el PO confirmó que esas fotos están reservadas para una futura página de renta de equipos, ver `project_lighting_assets_reserved_for_rental_zone` en memoria.

**Pendiente real, fuera de este ticket**: la próxima vez que se quiera publicar `web/dj/dj-ary.html`/`julito-dj-pmm.html` de verdad, hay que (a) correr el generador real apuntando a `web/` (ya seguro), y (b) agregar a mano el enlace/tarjeta correspondiente en `directorio.html` — el generador avisa cuáles faltan, no los agrega solo.
