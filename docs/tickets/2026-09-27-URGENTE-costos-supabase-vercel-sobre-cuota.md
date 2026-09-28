# Costos extra: Supabase (egress) + Vercel — ambos diagnosticados

**Fecha:** 2026-09-27 / actualizado 2026-09-28
**Pedido por el PO:** "hay que revisar cómo bajamos esos costos de gastos extras por encima de lo que podemos, hay que hacer un análisis y vamos a ver los de vercel también, paso a paso, déjalo como tarea urgente los dos casos."
**Estado:** DIAGNÓSTICO COMPLETO en los dos casos. Nada implementado todavía — quedan decisiones reales del PO antes de tocar código o borrar nada.

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
