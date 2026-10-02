# TICKET: separar la plantilla de cuenta Cliente de la de Artista/DJ

**Fecha:** 2026-10-01
**Reportado por:** el PO, al probar el Paso 9 (sync bidireccional de Google Calendar) con la cuenta de cliente de prueba de Wendy.
**Estado:** Pendiente — el PO pidió documentarlo y no tocarlo a medio arreglo de un incidente de producción en curso.

## Qué se encontró

Probando con una cuenta real de Cliente, `calendar-oauth-callback` redirigía a `dj-profile.html` (la página de Artista) en vez de `client-account.html` — bug real, ya corregido (ver `docs/ESTADO_MAESTRO.md`, entrada del mismo día). Al investigarlo salió un patrón más de fondo: varias piezas del sync de calendario (`google-calendar-sync.ts`, `procesarEventosGoogle`) tratan "Cliente" como un caso secundario de "Artista/DJ" — primero intentan resolver el nombre contra `dj_profiles`, y solo si eso falla prueban `client_profiles`. Es decir, la cuenta de Cliente se comporta como una variante de la plantilla de Artista, no como su propio tipo de cuenta de primera clase.

El PO lo resume así: la cuenta de prueba de Cliente (Wendy) se creó "desde la plantilla de artista o de DJ", y antes de que haya clientes reales usando esto hay que sacar esa plantilla de un depósito separado, propio de Cliente, no reusar la de Artista.

## Por qué importa

- Es la causa raíz de por qué el bug de `dj-profile.html` nunca se notó antes: ninguna cuenta de Cliente real había probado el flujo completo de Google Calendar hasta hoy.
- Cualquier función nueva que siga el mismo patrón ("intenta DJ primero, si no hay, intenta Cliente") va a seguir arrastrando esta ambigüedad y puede volver a fallar de formas parecidas pero distintas.
- Es más seguro corregirlo ANTES de que haya clientes reales con cuentas activas, para no tener que migrar datos de cuentas ya en uso.

## Auditoría real hecha (2026-10-02) — el problema NO es donde se pensaba

Se corrió la auditoría de solo lectura que este ticket pedía. Resultado, resumido:

**La creación de cuenta YA está limpia.** Las tres vías reales de crear un Cliente (`web/auth.js` signup, `supabase/functions/staff-create-client-account/index.ts`, `supabase/functions/create-platform-account/index.ts`) insertan directo en `client_profiles`, sin tocar `dj_profiles` en ningún punto. El miedo original ("la cuenta se crea desde la plantilla de artista") no se confirmó en el código de creación.

**El problema real es la CLASIFICACIÓN de identidad, no la creación**, y está duplicado en al menos 4 lugares independientes que implementan la misma regla ("si existe una fila en `dj_profiles` con rol no-cliente, esta persona ES artista, sin importar si también tiene fila en `client_profiles`"):

1. `web/mdj-identity.js` → `mdjClassifyPlatformIdentity()` (líneas 36-64) — la función "fuente única" documentada, pero dj-primero por diseño. Comentario propio del código (línea 51): *"No dejar que user_type client en JWT pise a un dj_profiles con rol de artista — sancocho típico."* Confirma que cuentas con fila en AMBAS tablas ya son una realidad conocida y aceptada, no un caso raro.
2. `web/mdj-building-resolver.js` → `mdjResolveBuilding()` (líneas 219-311) — decide a qué página redirige el login (`dj-profile.html`/`dj-dashboard.html` vs. `client-portal.html`). Artista se chequea ANTES que Cliente (línea 291-301). Es casi seguro el mecanismo real detrás del bug de `calendar-oauth-callback` que ya se corrigió.
3. `web/mdjb-shared-header.js` (líneas 5224-5333) — reimplementación propia, PARCIALMENTE DUPLICADA de la misma regla, en vez de delegar 100% a `mdj-identity.js`. Dos copias de la misma lógica viviendo a la vez en producción.
4. Dos funciones SQL (`compute_mdjb_letter()` en `20260430340000_mdjb_account_public_id_casm.sql` y `mdj_platform_user_id()` en `20260609100000_mdj_platform_user_id.sql`) reimplementan la MISMA jerarquía en SQL, de forma independiente.

**Acoplamiento real a nivel de base de datos:**
- Un trigger (`enforce_username_unique_across_profiles()`) que impide que un Cliente y un Artista compartan el mismo username — cruza ambas tablas por diseño.
- `client_profiles` RLS depende de `is_staff(uuid)`, una función que consulta SOLO `dj_profiles` — si `dj_profiles` se separa algún día (el otro ticket grande, staff/artista), esto se rompe en cadena.
- Una migración NO aplicada en producción (`20260817000000_m1_profile_id_inmutable.sql`, "Constitución Maestra de Identidad") ya modela `dj_profiles` y `client_profiles` como un solo espacio de identificadores unificado — confirma que el problema se veía venir desde antes.

**Tamaño real:** no es "unos días reordenando fallbacks" — es un problema de arquitectura de identidad repetido en 4+ lugares, más acoplamiento real de RLS/triggers, comparable en tamaño (aunque algo menor) al de separar `dj_profiles` de staff/artista. Las únicas piezas realmente chicas (reordenar, no rediseñar) son 2-3 funciones de calendario que solo resuelven un nombre para mostrar (`google-calendar-sync.ts`, `apple-calendar-sync.ts`, `calendar-reconcile.ts`) — esas sí se arreglan en horas, pero no son el problema de fondo.

## Qué falta decidir (no ejecutar sin sesión dedicada)

1. Diseñar UN solo contrato de resolución de identidad (reemplazando las 4+ reimplementaciones) y decidir qué pasa con las cuentas que YA tienen fila en ambas tablas (son reales, no hipotéticas — el propio código lo confirma).
2. Decidir si `is_staff()`/RLS de `client_profiles` se desacopla de `dj_profiles` ahora o se coordina con el ticket de separar staff/artista (se tocan el mismo nervio).
3. Recién al final, reordenar las 2-3 funciones de calendario cosméticas (riesgo bajo, no bloqueante).

## Explícitamente fuera de alcance ahora

No se toca nada de código en esta sesión -- el PO pidió solo documentar. Se ejecuta en su propia sesión dedicada, con este diagnóstico ya hecho como punto de partida (no hace falta repetir la auditoría).

## 2026-10-02 — Primer paso real ejecutado (seguro) + mapa completo de `mdjb-shared-header.js`

El PO autorizó empezar, incrementalmente, con el consentimiento de probar primero con una cuenta de Cliente real y limpia.

**Verificado en vivo:** se recreó la fila de `client_profiles` de Wendy (`wendyeayala@hotmail.com` — cuenta de Auth DISTINTA a su cuenta de staff `wendy.miamidjbeat@gmail.com`, confirmado por `user_id` distinto; no hay "sancocho" en este caso específico) con un respaldo completo guardado antes de tocar nada. Confirmado **0 filas en `dj_profiles`** para ese `user_id`, y login real aterrizó correcto en `client-portal.html`. Esto confirma que la CREACIÓN de cuenta (ya identificada como limpia en la auditoría) funciona de punta a punta.

**Paso 1 ejecutado: `web/mdj-identity.js` enriquecido** (único archivo tocado, sin publicar aún) — se consolidaron ahí los 2 arreglos que antes vivían SOLO duplicados dentro de `mdjb-shared-header.js`:
1. Guardia de red (`djRowError`, nuevo parámetro opcional): si la consulta a `dj_profiles` FALLA (no "no tiene fila"), ya no se asume que la persona es cliente solo por tener `client_profiles` -- mismo criterio que ya existía en el header (`TICKET-ROLE-REDIRECT-002`), ahora centralizado.
2. Respaldo de JWT: si `app_metadata.role` ya dice owner/admin/manager/seller pero no llegó ninguna fila real de `dj_profiles` (ausente o falló la consulta), igual se clasifica como staff -- nunca pisa una fila `dj_profiles` real con otro rol.

Verificado con 9 casos de prueba aislados (Node, sin navegador, `new Function()` cargando el archivo real) -- los 7 casos existentes dieron el mismo resultado de siempre (cero cambio de comportamiento), y los 2 casos nuevos (degradado) quedaron corregidos. Sin tocar ningún otro archivo todavía.

**Mapa completo de `mdjb-shared-header.js` (por qué NO se siguió consolidando hoy)**: el plan original era hacer que el header delegara en la función ya enriquecida en vez de duplicar su propia lógica. Al mapear el archivo completo (no solo el bloque de `isClient`), apareció algo más grande que "una reimplementación más": hay **tres capas independientes que se refuerzan entre sí**, no una sola fuente de verdad:

1. `isClient` -- calculado en línea (el bloque ya descrito arriba, líneas ~5244-5333).
2. `navTier` (qué tan "artista" se ve alguien en el menú) -- usa `hasDjProfile` (`!!(p && djRowRole !== 'client')`) **antes** de siquiera mirar `isClient` (líneas ~5449-5461): *"Un owner/staff que ADEMÁS tiene dj_profile ES artista → debe ver el rail de artista"* (comentario propio del código, citando un fix de regresión anterior, commit `97bc51c`).
3. `mdjResolveBuyerSession()` (líneas 2281-2299) -- una función APARTE con **7 condiciones distintas** (`idn.principal==='buyer'`, metadata JWT, `hasClientRow`, el string de `settingsUrl`, incluso si la URL actual "parece" un flujo de comprador vía `mdjIsBuyerJourneyPage()`) que puede **volver a cambiar `isClient` a `true`** DESPUÉS de que `navTier` ya se calculó con el valor viejo (línea 5489-5492).

Cada capa casi seguro se agregó para arreglar un bug real puntual (hay comentarios citando tickets/commits específicos) -- no es descuido, es acumulación de parches independientes. Consolidar esto de verdad significa entender la intención original de cada una de las 7 condiciones de `mdjResolveBuyerSession()` antes de poder reemplazarlas con confianza. Se decidió NO tocar este archivo hoy -- queda como el punto de partida exacto para la sesión dedicada (no hace falta re-mapear).

**Qué sigue, en orden, cuando se retome:**
1. ~~Publicar el enriquecimiento de `mdj-identity.js`~~ -- hecho, fusionado (PR #620).
2. ~~Conectar `djRowError` en la llamada real de `mdjb-shared-header.js`~~ -- hecho el 2026-10-02: el archivo ya calculaba `djProfileErr` para su propio guardia inline, pero nunca se lo pasaba a `mdjClassifyPlatformIdentity()` -- el enriquecimiento del paso 1 nunca se activaba de verdad desde aquí hasta este cambio. Verificado en vivo con sesión real de Wendy (Cliente): `window.__mdjLastPlatformIdentity.djRowError === false`, `principal === "buyer"`, sin ninguna regresión visual. Cambio puramente aditivo (un campo más en el objeto que ya se pasaba), cero riesgo para el caso normal.
3. Entender la intención de cada una de las ~9 condiciones reales de `mdjResolveBuyerSession()` (recontadas con más cuidado -- son más de las 7 que se mencionaron antes; probablemente cada una tiene un ticket/bug real detrás, varias parecen redundantes entre sí pero no se puede confirmar sin más investigación).
4. Recién ahí, diseñar cómo las tres capas (`isClient`, `navTier`, `mdjResolveBuyerSession`) se reducen a UNA, delegando completamente en `mdjClassifyPlatformIdentity()`.
5. Probar en vivo con las 4 combinaciones reales que ya se sabe que existen: Artista puro, Cliente puro, Staff puro, y el caso dual confirmado (alguien con fila real en ambas tablas).

**Pasos 1 y 2 cerrados hoy (2026-10-02). El trabajo grande (pasos 3-5) queda para la próxima sesión dedicada, decisión explícita del PO ("comitea este paso chico y lo dejamos aquí por hoy").**
