# TICKET: SEO·IA como página nativa del portal (no Artifact embebido)

**Fecha:** 2026-09-30
**Estado:** Pendiente, sin fecha — pospuesto explícitamente por el PO ("déjalo así por ahora, y deja este ajuste como ticket").

## Contexto

El botón "SEO·IA" en `staff.html` (junto a Cash Flow) abre hoy un Artifact de
Claude (`https://claude.ai/artifact/Xq8DXWtmh9WMborSAZEdsT`) — panel de
tráfico real (GA4 + Search Console vía Supermetrics) construido por el hilo
GEO·SEO·IA, con actualización automática semanal (lunes 8am).

El PO pidió que se viera "en pantalla completa" **dentro** del portal, con la
barra de menú de `staff.html` siempre visible arriba — como Cash Flow, Agenda
o Config (todas viven como `<iframe>` dentro de una `<section class="staff-view">`).

## Por qué no se pudo hacer así (intentado y revertido hoy)

Se intentó embeber el Artifact en un `<iframe>` (mismo patrón que Cash Flow).
**No funciona**: claude.ai envía la cabecera
`Content-Security-Policy: frame-ancestors 'self' chrome-extension://...`,
que bloquea explícitamente que su contenido se cargue dentro de un iframe de
cualquier otro origen — confirmado en la consola del navegador
(`Framing 'https://claude.ai/' violates the following Content Security Policy
directive...`). No es un bug de nuestro código ni algo configurable desde
nuestro lado: es una protección de seguridad del lado de Anthropic.

Por eso el botón quedó como `<a target="_blank">` (abre pestaña nueva, sin la
barra de menú del portal) — es la única forma real de mostrarlo hoy.

## Solución real (para cuando se retome)

La única vía para que este panel viva DENTRO del portal, con la barra de menú
propia, es dejar de depender del Artifact como fuente de render y construir
una página nativa del sitio:

1. Traer los datos de Supermetrics (GA4 + Search Console) a una tabla propia
   en Supabase, vía una Edge Function programada (mismo patrón que ya usa el
   Artifact: tarea semanal, lunes 8am) — en vez de que Supermetrics alimente
   directo al Artifact, que alimente una tabla nuestra.
2. Construir una vista nueva dentro de `staff.html` (sección `.staff-view`
   real, sin iframe) que lea esa tabla y pinte los mismos gráficos/tarjetas
   que hoy tiene el Artifact (reusar el HTML/CSS/JS de Chart.js del Artifact
   como base visual, ya está resuelto ahí).
3. Esto también resuelve de raíz el otro pendiente (botones de Volver/Cerrar
   en el Artifact, agregados hoy como parche) — una vista nativa no necesita
   esos botones, ya tiene la barra de menú real del portal.

## No ejecutar sin sesión dedicada

Es un proyecto de tamaño real (Edge Function + tabla nueva + vista nueva), no
un ajuste rápido. Se documenta aquí para no perder el hallazgo de hoy (por qué
el iframe no sirve) y para tener ya el plan cuando el PO decida retomarlo.

## Advertencia: "Volver"/"Cerrar" cruzan de localhost a producción al probar

Los botones "← Volver"/"✕ Cerrar" del Artifact llevan **fijo** a
`https://www.miamidjbeat.com/staff.html?vista=miperfil` — correcto y seguro
para cualquier staff real (siempre está en producción), pero al **probar en
`localhost:8000`** te saca de la prueba local y te lleva a tu sesión real de
producción (un origen completamente aparte, con su propia sesión guardada).
El PO reprodujo esto dos veces el mismo día (Owner→perfil de Wendy en una
prueba, Wendy→perfil de Owner en otra) y por un momento se interpretó como una
fuga de datos entre cuentas — no lo es: cada vez mostró simplemente lo que
fuera la sesión activa de producción en ese momento, sin relación con qué
cuenta se usaba en local.

Se intentó corregir leyendo `document.referrer` para volver al mismo origen de
donde viniste — **no es técnicamente posible**: Claude sirve el Artifact
dentro de un iframe en un subdominio propio
(`*.frame.claudeusercontent.com`), y ese iframe nunca recibe el referrer real
de la página externa que originalmente abrió el Artifact. Es una limitación
de la arquitectura de Artifacts, no de este código. Revertido a producción
fija a propósito.

**Para cuando se pruebe este flujo de nuevo en local**: tenerlo presente,
nada más — no es un bug que arreglar, es el comportamiento esperado dado que
el Artifact no puede saber si viniste de localhost o de producción. La
solución real de fondo es la misma de arriba (página nativa dentro del
portal, sin Artifact externo) — ahí "Volver" ni siquiera haría falta.
