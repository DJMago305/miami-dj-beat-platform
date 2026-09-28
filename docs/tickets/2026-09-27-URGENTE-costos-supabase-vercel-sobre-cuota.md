# URGENTE — Bajar costos extra: Supabase (egress) + Vercel (por confirmar)

**Fecha:** 2026-09-27
**Pedido por el PO:** "hay que revisar cómo bajamos esos costos de gastos extras por encima de lo que podemos, hay que hacer un análisis y vamos a ver los de vercel también, paso a paso, déjalo como tarea urgente los dos casos."
**Estado:** ANÁLISIS EN CURSO — nada implementado todavía.

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

## Caso 2 — Vercel: costos por confirmar

- El PO reportó antes un cargo real de `VERCEL INC. -$22.11` (ver entrada de ESTADO_MAESTRO del 2026-09-27, "Consulta del PO sobre cargos bancarios") — costo legítimo de hosting, no fraude, pero sin desglose todavía de qué lo compone (bandwidth, build minutes, function invocations).
- Nota ya documentada ese mismo día: más PRs/ramas fragmentadas en una sesión = más despliegues = más minutos de build consumidos. Puede ser parte de la causa.
- **Bloqueado:** no se pudo revisar el dashboard de uso/facturación de Vercel porque la sesión de Chrome de este hilo no tiene la cuenta de Vercel logueada (se intentó entrar a `vercel.com/dashboard`, redirigió a login). Se necesita que el PO inicie sesión en esa pestaña, o dar acceso de otra forma, para ver el desglose real de uso.

## Próximos pasos

1. Decidir con el PO una solución real y permanente al cache-control de Supabase Storage (opciones a presentar: CDN delante de Storage tipo Cloudflare, pedir a soporte de Supabase que revise por qué el header no toma efecto, o mover los videos a otro origen que sí cachee bien) — comprimir video por video ya se probó y solo retrasa el problema, no lo resuelve.
2. Con el PO logueado en Vercel (ya logueado hoy en la pestaña de Twilio/Gmail — falta repetirlo para Vercel), revisar Settings → Usage/Billing del proyecto `web` (`prj_HiMB1S2s94mwlyoQiW8CHtcA4DpF`, team `team_VbkrzHWzFxDgNtAWuT92GElN`) para el desglose real de Caso 2.
3. Nada se aplica sin aprobación explícita del PO (regla de gobernanza estándar del repo).
