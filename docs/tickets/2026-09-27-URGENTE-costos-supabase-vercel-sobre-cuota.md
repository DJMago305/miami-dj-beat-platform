# Costos extra: Supabase (egress) + Vercel — ambos diagnosticados

**Fecha:** 2026-09-27 / actualizado 2026-09-28
**Pedido por el PO:** "hay que revisar cómo bajamos esos costos de gastos extras por encima de lo que podemos, hay que hacer un análisis y vamos a ver los de vercel también, paso a paso, déjalo como tarea urgente los dos casos."
**Estado (actualizado 2026-10-02):** CASO 1 (SUPABASE) CERRADO. El PO confirmó que el egress se resolvió subiendo el plan de Supabase, y que la clave `service_role` expuesta en la captura del 28/09 ya fue corregida (rotada). Ambas confirmaciones son del PO; no se verificaron contra el panel de Supabase (sin acceso desde la sesión). **CASO 2 (VERCEL): sin cambios, el PO no lo mencionó** — el diagnóstico de abajo sigue siendo el último dato.
~~Estado anterior: DIAGNÓSTICO COMPLETO en los dos casos. Nada implementado todavía — quedan decisiones reales del PO antes de tocar código o borrar nada.~~

## Caso 1 — Supabase: egress por encima de cuota

- Correo real de Supabase (`noreply@supabase.com`, 2026-09-21, cuenta djmago305@gmail.com): la organización `djmago305@gmail.com's Org` (ID `iahezzmlyawacdvhyrop`) superó la cuota de **egress cacheado** de su plan.
- Confirmado vía API (`get_organization`): plan **Pro**, proyecto `hkuvuqupbxwkiykxvqdr` en estado `ACTIVE_HEALTHY` (no suspendido, no hay corte activo hoy).
- **Fecha límite real: 22 de octubre de 2026** — después de esa fecha empieza a aplicar la Política de Uso Justo si el consumo sigue igual de alto. Antes de esa fecha es período de gracia gratis.
- Objetivo explícito del correo de Supabase: bajar el egress cacheado por debajo de **275 GB**.

### Esto ya se investigó antes — no es un problema nuevo (encontrado al revisar notas antes de repetir el análisis)

`docs/ESTADO_MAESTRO.md:2182` (2026-09-22) ya documentó este mismo pico (**"Cached Egress 290.51/250 GB, 116%"**, grace period marcado ahí hasta el 21-oct, un día distinto al 22-oct del correo de esta semana — mismo aviso, fechas de gracia que se van corriendo) y ya hizo un análisis real:

- **~650 MB únicos de video en 39 páginas con autoplay**, confirmado hoy en más detalle: `resolveMdAssetPublicUrl` se usa en 15 páginas HTML + 3 JS (`web/js/rentals.js`, `web/js/avatar-frame-player.js`, `web/js/venues-showcase.js`); `data-hero-playlist` aparece 33 veces en 14 páginas. Total: **~53 videos únicos** referenciados en `web/*.html`, ~774 MB de las copias locales pre-subida (`web/assets/`, `.gitignore`d).
- **Causa raíz real, ya identificada y NO resuelta**: se intentó fijar `Cache-Control` en los objetos de Supabase Storage vía el CLI (`--experimental storage`) — la metadata quedó bien guardada en `storage.objects`, pero **el endpoint público sigue sirviendo `no-cache` de todas formas** (límite del CLI, requiere la clave de servicio para resolverlo de otra forma, no tocado sin permiso explícito). Esto significa que el navegador nunca cachea el video — cada reproducción/recarga vuelve a descargar el archivo completo. Es, con alta probabilidad, la causa estructural real, más que el peso de los videos en sí.
- **Ya se hizo trabajo real de mitigación** (2026-09-22): 23 videos comprimidos en 4 lotes (~90 MB ahorrados, sin pérdida visible confirmada cuadro a cuadro), un duplicado byte-idéntico encontrado (`Jobs Miami DJ Beat.mp4` == `club-dj-hero.mp4`), huérfanos sin tráfico identificados. Esa sesión concluyó que el pico de ESE mes probablemente fue por pruebas repetidas en producción ese mismo día — pero el problema de fondo (sin caché real) sigue abierto, por eso volvió a aparecer.
- `web/scripts/compress-web-videos.sh` existe pero es manual, cubre solo 5 archivos hardcodeados, no está en `web/package.json` ni corre en CI/deploy — no es un proceso automático.
- No hay evidencia en memoria ni en el repo de que se haya decidido poner un CDN (ej. Cloudflare) delante de Supabase Storage — sigue sin decidirse.

**Conclusión de este análisis**: no hace falta re-investigar desde cero — el diagnóstico ya existe. Lo que falta es decidir y ejecutar una solución real al problema de fondo (el cache-control que no toma efecto), no solo seguir comprimiendo videos uno por uno cada vez que vuelve a aparecer el aviso.

## Caso 2 — Vercel: RESUELTO el diagnóstico, causa raíz encontrada

Revisado en vivo (2026-09-28, PO logueado en `vercel.com/djmago305s-projects`), ciclo actual de facturación (11-sept a 11-oct):

- **Included Credit: $20.00 / $20.00 (agotado). On-Demand Charges: $24.25-$24.36** (varía un poco según filtro/refresco) — esto es lo que ya vio el PO en su banco (`VERCEL INC. -$22.11`, cargo de un ciclo anterior, mismo patrón).
- **Desglose real, por producto:**
  - **Build CPU Minutes: 210 horas → $44.21** ← esto es el 99% del gasto de infraestructura, con enorme diferencia sobre todo lo demás.
  - Observability Events: 41.25K → $0.05
  - Edge Requests, Fast Data Transfer, CPU adicional de Edge Requests: **$0.00** cada uno (tráfico real del sitio es insignificante en costo).
  - Infraestructura total: $44.26 − $20 de crédito incluido = ~$24.26 de sobrecargo.
- **Causa raíz confirmada, no solo sospechada**: la cuenta tiene **5 proyectos de Vercel**, no 1 — `web` (el sitio real, `miamidjbeat.com`), y 4 proyectos huérfanos sin repo conectado (`miami-dj-beat-platform`, `project-iyhe0`, `project-vpete`, `project-hn5fy`, creados entre abril y septiembre). Filtrando el consumo por proyecto: **los 4 huérfanos generan $0.00 de costo** — todo el gasto es 100% del proyecto `web` real.
- **El aviso de "Node.js 20 deprecated" que sigue apareciendo en el dashboard es de otro proyecto** (`miami-dj-beat-platform`, el huérfano) — no tiene relación con el fix ya aplicado en `web/package.json` (PR #535, que sí corrigió el proyecto real). El huérfano no tiene repo conectado, así que ni siquiera puede desplegar nada — el aviso es inofensivo pero confuso.
- **Por qué 210 horas de build**: cada PR genera 2 despliegues reales en Vercel (uno "Preview" al hacer push a la rama, uno "Production" al fusionar a `main`) — confirmado mirando `Deployments` del proyecto `web`: en esta sola sesión, 4 PRs (#535-#538) generaron 8 despliegues en ~2 horas. El volumen histórico de PRs de este repo es muy alto (ya pasó de 538 PRs). Esto coincide exacto con la advertencia de gobernanza ya escrita en `docs/ESTADO_MAESTRO.md` el 2026-09-27: "más PRs/ramas fragmentadas = más despliegues = más minutos de build consumidos".

**4 proyectos huérfanos de Vercel BORRADOS (2026-09-28, autorizado explícitamente por el PO)**: `miami-dj-beat-platform`, `project-iyhe0`, `project-vpete`, `project-hn5fy` — verificados uno por uno antes de borrar (ninguno tenía repo conectado ni "Production Deployment"). El PO preguntó directamente si `miami-dj-beat-platform` era "el contenedor donde está `web`" antes de continuar — verificado con dos pruebas independientes que NO tenía ninguna relación: (1) `https://miamidjbeat.com` cargó con normalidad después del borrado, (2) el proyecto `web` en Vercel siguió mostrando su Production Deployment sano, con el dominio y el historial de PRs intactos. Confirmado tras los 4 borrados: la lista de proyectos de la cuenta quedó solo con `web`.

## Próximos pasos

1. **La única palanca real para bajar el costo de Vercel es reducir el número de despliegues** — cada PR fusionado cuesta un build de producción real, sin importar qué tan chico sea el cambio (hasta un PR de solo documentación dispara un build completo). Ya existe la regla de gobernanza de no fragmentar en muchos PRs — aplicarla de verdad es lo que bajaría este número, no un cambio de configuración.
2. Decidir con el PO una solución real y permanente al cache-control de Supabase Storage (Caso 1) — opciones: CDN delante de Storage tipo Cloudflare, pedir a soporte de Supabase que revise por qué el header no toma efecto, o mover los videos a otro origen que sí cachee bien.
3. Nada se aplica sin aprobación explícita del PO (regla de gobernanza estándar del repo).

## Caso 1 — causa raíz confirmada de raíz (2026-09-28), fix real listo, sin correr todavía

**Re-verificado con `curl` real, no solo lógica**: 3 peticiones `GET` idénticas seguidas a `hora-loca-character.mp4` (52MB) — las 3 devolvieron `cache-control: no-cache` y transfirieron el archivo COMPLETO cada vez (`bytes_descargados=52291313` las tres veces). El intento anterior de arreglar esto por SQL/CLI (editar `storage.objects.metadata` directo) **nunca pudo haber funcionado**: la documentación oficial de Supabase (Smart CDN) dice que el `cacheControl` real que ve el navegador se fija **al subir/re-subir el archivo** vía la API de Storage, no editando esa fila después. La cuenta sí tiene Smart CDN activo (plan Pro) — pero mientras el header siga en `no-cache`, el CDN revalida en cada petición y no ahorra nada (confirmado: `cf-cache-status: REVALIDATED` en las 3 peticiones, con el cuerpo completo transferido igual).

**Fix real construido, probado en `--dry-run`, listo para correr**: `web/scripts/fix-storage-cache-control.mjs` — re-sube cada uno de los **93 videos reales** del bucket `assets` (confirmado por `COUNT(*)` en `storage.objects`) al mismo path (`upsert:true`, contenido byte-idéntico, descargado del propio endpoint público y vuelto a subir), con `cacheControl: 604800` (1 semana) esta vez fijado correctamente vía el SDK oficial `@supabase/supabase-js` en el momento de la subida.

**Por qué este hilo no lo corre él mismo**: requiere la `SERVICE_ROLE_KEY` real — mismo criterio que con la API Key de Twilio antes en esta sesión, esa clave no debe pasar por este chat. Corre esto tú mismo, desde tu propia terminal:

```bash
npm install @supabase/supabase-js   # una sola vez, si no lo tienes ya
SUPABASE_SERVICE_ROLE_KEY=<tu clave real> node web/scripts/fix-storage-cache-control.mjs --dry-run   # primero, para ver la lista (cero descargas/subidas)
SUPABASE_SERVICE_ROLE_KEY=<tu clave real> node web/scripts/fix-storage-cache-control.mjs              # la corrida real
```

Verificación posterior sugerida (correr el mismo `curl` de arriba contra un par de videos, debería mostrar `cache-control: max-age=604800` en vez de `no-cache`).

## Caso 1 — corrida real ejecutada (2026-09-28), verificación con metodología corregida

**El PO corrió el script él mismo** (`SUPABASE_SERVICE_ROLE_KEY=... node web/scripts/fix-storage-cache-control.mjs`, sin `--dry-run`) — **93/93 corregidos, 0 fallidos**. Confirmado en `storage.objects.metadata->>'cacheControl'` que quedó en `max-age=604800` para los archivos verificados.

**Primera verificación con `curl -I` normal dio un resultado confuso**: seguía mostrando `cache-control: no-cache` y `cf-cache-status: REVALIDATED` incluso después de re-subir y de purgar el CDN entero (`DELETE /storage/v1/cdn/assets`, respuesta `{"message":"success"}`). Esto llevó a pensar, por un momento, que el fix no había funcionado.

**Error de metodología encontrado y corregido**: `Cache-Control: no-cache` **no significa "no cachear"** — significa "cachéalo, pero revalida con el servidor antes de reusarlo" (distinto de `no-store`, que sí prohíbe cachear). `curl -I`/`curl -s` sin más nunca manda esa revalidación (no tiene caché local que revalidar), así que SIEMPRE va a pedir el archivo completo de cero — eso no prueba que el caché no funcione, prueba que estábamos probando mal. Este mismo error de metodología es, con alta probabilidad, la razón por la que la investigación del 22 y 28 de septiembre concluyó "cero ahorro" con exactamente esta misma prueba.

**Prueba correcta (petición condicional con `If-None-Match: <etag>`, simula un navegador real revisitando la página)**:
```
status=304 Not Modified, bytes_descargados=0
cache-control: public, max-age=604800
```
Cero bytes transferidos, header correcto. Esto es un ahorro real y verificado, no solo teórico.

**Pendiente, no confirmable por curl**: el ahorro real en la métrica de facturación de Supabase ("Cached Egress", `Settings → Usage`) — eso solo se puede confirmar viendo la tendencia de los próximos 1-2 días, no con pruebas puntuales. Queda anotado para revisar el 2026-09-30.

**⚠️ Incidente de seguridad menor, ya resuelto por el PO**: durante esta corrida, la clave `service_role` (formato JWT legacy) quedó expuesta en texto plano en una captura de pantalla compartida en el chat de Claude Code (se pegó por accidente en un prompt vacío de la terminal, que la mostró completa al fallar como "command not found"). Se le indicó al PO regenerar esa clave de inmediato en el dashboard de Supabase — ningún código de producción la usa (solo scripts de administración como este), así que la rotación no debería romper nada. Confirmar con el PO que ya la rotó antes de cerrar este ticket del todo.

## 2026-10-02 — Cierre del Caso 1 y datos medidos para el Caso 2

**Caso 1 (Supabase): cerrado por el PO.** Egress resuelto subiendo el plan; clave `service_role` expuesta ya corregida. Los pendientes de la sección anterior ("revisar la tendencia el 2026-09-30" y "confirmar que ya la rotó") quedan resueltos con esta confirmación. Este ticket se leyó hoy como tarea pendiente por no estar actualizado; por eso se deja constancia.

**Caso 2 (Vercel): datos medidos hoy, solo lectura, sin cambiar nada.** Desde GitHub (despliegues que Vercel registra en el repo), ciclo actual desde el 2026-09-11:
- 615 despliegues (357 Preview, 258 Production). Los de Production coinciden 1 a 1 con los PRs fusionados (09-28: 42 vs 47, 09-29: 20 vs 21, 09-30: 6 vs 6, 10-01: 2 vs 2, 10-02: 13 vs 13), lo que confirma con datos el diagnóstico de arriba: cada PR fusionado cuesta un build de producción.
- Desde el 09-28 el ritmo bajó: 104 despliegues ese día, luego 46, 16, 5 y 27.
- El build real es `exit 0` (`web/package.json`), así que el consumo no viene de compilar. El repo pesa 223 MB en GitHub, el clon no es el problema.
- No se pudo medir la duración real de cada build: los tiempos de estado que expone GitHub dan 0 s y no sirven. Eso solo se ve en el panel de Vercel (sin sesión desde la herramienta). Sigue abierta la duda de por qué salen ~210 horas de "Build CPU" con un build vacío.

## 2026-10-02 (tarde) — Caso 2 (Vercel): palanca concreta encontrada, sin aplicar

**Medido en GitHub (266 PRs fusionados desde el 2026-09-11):** 104 (39 %) no tocaron NADA bajo `web/` (solo `docs/`, `supabase/`, scripts o workflows); desde el 2026-09-28 son 45 de 90 (50 %). Cada uno de esos PRs dispara igual un build de Preview y uno de Production que despliegan exactamente el mismo sitio.

**Mecanismo disponible (verificado en la documentación oficial de Vercel, no probado aquí):** `vercel.json` admite `ignoreCommand` (hoy no tiene ninguno). Si el comando sale con código 0, el build se aborta de inmediato y el despliegue queda en estado `CANCELED`; con código 1 el build sigue normal. Ejemplo de la propia documentación: `git diff --quiet HEAD^ HEAD ./`.

**Lo que la documentación NO dice o contradice una expectativa fácil (por eso no se aplicó):**
- Un build cancelado por el Ignored Build Step **sigue contando como despliegue completo** para las cuotas de despliegues y los slots de build concurrentes. La página no dice si cobra minutos de "Build CPU", que es la métrica que pasó la cuota. El ahorro real es una incógnita hasta medirlo.
- No dice cómo queda el check de GitHub para un despliegue `CANCELED`. La protección de `main` exige los checks `check`, `financial-selftests`, `site-hygiene` y los de Vercel; si un cancelado dejara el check en rojo o pendiente, bloquearía el merge de todos los PRs de documentación.
- El comando se ejecuta dentro del *Root Directory* del proyecto, que se ve solo en el panel de Vercel (sin sesión desde la herramienta); la forma correcta de filtrar `web/` depende de él. Además `vercel.json` vive en la raíz del repo mientras `web/package.json` tiene su propio `build`, así que el Root Directory real no es obvio.
- Sigue sin explicarse por qué un build que es `exit 0` consume ~210 horas de "Build CPU". Si el costo no viene del build sino del clon/subida, `ignoreCommand` ahorraría poco.

**Propuesta (requiere aprobación del PO, es cambio de pipeline de despliegue):** (1) el PO mira en el panel de Vercel el Root Directory y la duración de 3 builds recientes; (2) prueba aislada: agregar `ignoreCommand` en una rama, abrir un PR solo de documentación y comprobar cómo quedan el estado `CANCELED` y los checks de GitHub; (3) solo si el merge no se bloquea, comparar "Build CPU" 1-2 días después. Si la CPU no baja, se revierte.

## 2026-10-02 (noche) — Caso 2 (Vercel): causa probable del costo encontrada, cambio PENDIENTE del PO

**Hallazgo (capturas del panel de Vercel, proyecto `web`):** *Build Machine = Turbo, 30 vCPU, 60 GB de memoria*, el nivel más grande. Los despliegues recientes (Preview y Production) muestran *Ready* en **7–11 s**, coherente con el build vacío (`exit 0`).

**Cuenta que lo explica:** la documentación de Vercel (`/docs/builds/managing-builds`, verificada hoy) dice que el build se cobra a **$0,0035 por minuto de CPU** (minutos de build × vCPU). Con Turbo, 30 vCPU × 1 min × $0,0035 = **$0,105 por despliegue**. Medido: ≈ $0,104 por despliegue (619 despliegues, Build CPU $64,68). Lo que la documentación NO dice y es inferencia: que cada build se facture como mínimo un minuto aunque dure 8 s; la coincidencia numérica es muy ajustada pero no está confirmada (hay una pantalla de detalle de cada despliegue con "billable duration y CPU minutes" que la confirmaría).

**Cambio propuesto (lo hace el PO en el panel, reversible, sin código):** Settings → Build and Deployment → *Build Machine* → **Standard (4 vCPU, 8 GB)** → Save. Costo estimado por despliegue: ≈ $0,014 (−87 %), con el mismo número de despliegues; a este volumen quedaría dentro de los $20 de crédito incluido. Revisar también el ajuste a nivel de *equipo* (`~/settings/build-and-deployment`, sección Build Machines) por si el Turbo viene de ahí.

**Estado: PENDIENTE, decisión del PO de no hacerlo todavía (2026-10-02).** Costo de esperar: ≈ $1–2 por día al ritmo actual; el ciclo de facturación termina el 11/10. `ignoreCommand` queda descartado por ahora: un build cancelado igual arranca la máquina, así que ahorraría poco comparado con este cambio.
