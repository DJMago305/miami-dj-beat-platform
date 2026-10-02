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

**Verificado en vivo:** se recreó la fila de `client_profiles` de Wendy (`wendyeayala@hotmail.com` — cuenta de Auth DISTINTA a su cuenta de staff `wendy.miamidjbeat@gmail.com`, confirmado por `user_id` distinto. **CORRECCIÓN 2026-10-03:** la frase original decía "no hay sancocho en este caso específico" y eso estaba incompleto: la cuenta de STAFF de Wendy (`c07a065a…`, `role='seller'`) TAMBIÉN tiene una fila en `client_profiles` (creada 2026-09-30 04:37, nueve minutos después de su fila `dj_profiles`). Es un caso dual real; hoy no hace daño porque el rol `seller` la clasifica como staff antes de mirar `client_profiles`) con un respaldo completo guardado antes de tocar nada. Confirmado **0 filas en `dj_profiles`** para ese `user_id`, y login real aterrizó correcto en `client-portal.html`. Esto confirma que la CREACIÓN de cuenta (ya identificada como limpia en la auditoría) funciona de punta a punta.

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
3. ~~Entender la intención de cada una de las ~9 condiciones reales de `mdjResolveBuyerSession()`~~ -- hecho el 2026-10-03, ver sección "Paso 3 resuelto" más abajo.
4. Recién ahí, diseñar cómo las tres capas (`isClient`, `navTier`, `mdjResolveBuyerSession`) se reducen a UNA, delegando completamente en `mdjClassifyPlatformIdentity()`.
5. Probar en vivo con las 4 combinaciones reales que ya se sabe que existen: Artista puro, Cliente puro, Staff puro, y el caso dual confirmado (alguien con fila real en ambas tablas).

**Pasos 1 y 2 cerrados hoy (2026-10-02). El trabajo grande (pasos 3-5) queda para la próxima sesión dedicada, decisión explícita del PO ("comitea este paso chico y lo dejamos aquí por hoy").**

## 2026-10-02 — Caso puntual investigado: ¿Wendy (vendedora) se ve como artista en algún lado?

El PO pidió investigar cómo separar el perfil de Wendy (`wendy.miamidjbeat@gmail.com`, cuenta de staff/vendedora, distinta de su cuenta de Cliente `wendyeayala@hotmail.com`) de artista a vendedora dentro de staff. Resultado de la investigación: **ya está correctamente separada en todo lo que es clasificación/visualización — no hay bug activo.**

Verificado:
1. Su fila en `dj_profiles` ya tiene `role='seller'` (no `'dj'`).
2. `mdj-identity.js` → `mdjClassifyPlatformIdentity()` ya la resuelve como `principal: 'staff'` (vía `staffInDb`), no artista.
3. `public_dj_profiles` (el roster público de DJs) la excluye por completo -- ese view filtra `WHERE role = 'dj'` en su definición.
4. `web/staff-admin.html` (líneas 7089-7121) ya la etiqueta "MDJBStaff" / `_fuente: 'Equipo interno (asignado por Owner)'` / `_proStatus: 'STAFF'` en el CRM -- mismo mecanismo (`isRealStaffRole` por `role` en `admin|owner|manager|seller`) que ya se usó para corregir la cuenta de Owner el 2026-09-19.

Lo único que NO está separado es el almacenamiento físico: su fila vive dentro de `dj_profiles` (129 columnas, ~100 de ellas específicas de artista y `NULL` para ella) en vez de una tabla propia de staff. Eso es exactamente el alcance ya documentado y deliberadamente pospuesto en `docs/tickets/2026-09-30-TICKET-separar-dj-profiles-staff-de-artista.md` (61 funciones SQL de permisos + 46 páginas web + 36 Edge Functions dependen de la estructura actual -- proyecto de varias semanas).

**Decisión del PO (2026-10-02): "déjalo documentado por ahora, no lo ejecutamos todavía".** No se toca código ni base de datos para este caso puntual -- el caso de Wendy queda como ejemplo concreto ya verificado para cuando se ejecute el ticket grande de separación física.

## 2026-10-03 — Paso 3 resuelto: qué decide de verdad `mdjResolveBuyerSession()`

Método: se extrajo el código real del header (`mdjResolveBuyerSession`, `mdjIsBuyerJourneyPage`), se transcribió la lógica inline de `isClient`/`jwtArtist` y se cargó el `mdj-identity.js` real, todo en un arnés de Node (solo lectura, nada del repo se modificó). Se evaluaron las **360 combinaciones** de (fila `dj_profiles`: ninguna/dj/owner/seller/client) × (`app_metadata.role`) × (`user_metadata.user_type`) × (fila `client_profiles`) × (error de red en la consulta a `dj_profiles`) × (página `index.html` / `dj-profile.html`). Luego se quitó cada condición, sola y en grupo, para ver cuántas combinaciones cambian de resultado.

**Cuentas reales hoy (13, por combinación):** 7 artistas puros (`dj`, sin fila client), 2 clientes puros (JWT `client`, sin fila dj), 1 owner, 1 seller con fila client (la cuenta de staff de Wendy), 1 cuenta con JWT `artist` pero SIN fila `dj_profiles` y CON fila client (Aron Rosso, último login 2026-05-21, fila client creada 2026-09-27).

**Resultado, condición por condición** (c0..c8, en el orden en que aparecen en el código):

| Condición | Veredicto |
|---|---|
| c0 `isDjStaff \|\| isNavStaffSolo` → false | **Esencial.** Cambia 24 combinaciones. (`isNavStaffSolo` está incluido en `isDjStaff`: seller ⊂ staff.) |
| c1 `isClient === true` | Redundante salvo para un caso de política (ver K abajo). |
| c2 `idn.principal === 'buyer'` | **Esencial.** Cambia 6 combinaciones (rescata combinaciones raras como fila dj `client` + JWT owner). |
| c3 JWT/metadata dice client y no hay fila dj | Efectiva solo bajo error de red + fila client (ver H). |
| c4 `idn.hasClientRow && !hasDjProfile` | Efectiva solo bajo error de red + fila client (ver H). Es la que hace el trabajo real. |
| c5 fila client + `dbRole` client | **Código muerto.** |
| c6 `clientRow && !hasDjProfile` | **Código muerto** (duplicado exacto de c4). |
| c7 `hasClientRow && !hasDjProfile && mdjIsBuyerJourneyPage()` | **Código muerto** (subconjunto de c4). |
| c8 `settingsUrl` contiene `client-account`/`client-portal` | **Código muerto**: `settingsUrl` solo vale `client-account` cuando `isClient` ya era `true` (c1 ya devolvió true antes), y `client-portal` nunca aparece en ese valor. |

Prueba en grupo: quitar c5+c6+c7+c8 a la vez cambia **0 de 360** combinaciones. Cuatro de las nueve condiciones se pueden borrar sin ningún efecto observable.

**El header actual ya coincide con el clasificador canónico en 348 de 360 combinaciones.** Las 12 que difieren son exactamente DOS conflictos de política, no bugs de código sueltos:

- **H — error de red + fila client:** si la consulta a `dj_profiles` falla (red lenta en móvil) y la cuenta tiene fila `client_profiles` y no trae JWT `client`, el canónico dice `performer` (guardia `TICKET-ROLE-REDIRECT-002`: no deducir "cliente" solo por tener fila client cuando la consulta falló) pero el header termina diciendo `buyer`, porque c3/c4 de `mdjResolveBuyerSession()` anulan ese mismo guardia que el bloque inline sí respeta. Es decir: el guardia está implementado dos veces y una de las dos lo contradice. Cuentas reales afectadas hoy: **ninguna** (los 2 clientes reales traen JWT `client`, que c2 resuelve bien aunque falle la consulta; Wendy-staff la protege c0).
- **K — JWT `user_type='client'` sin `app_metadata.role` + fila dj no-cliente:** el bloque inline del header dice "el JWT explícito de cliente siempre gana" (comentario de línea ~5254); el canónico y el comentario de `mdjResolveBuyerSession` dicen "la base de datos gana". El mismo usuario sale `buyer` en `index.html` y `no-buyer` en `dj-profile.html` (por el override `viewingOwnDjProfile`). Cuentas reales afectadas hoy: **ninguna** (las cuentas con fila dj ya traen `app_metadata.role`, que desactiva la lectura de `user_type`).

**Hallazgo extra (inconsistencia real, una cuenta):** `navTier` (el rail de artista/cliente del menú) se calcula con el valor de `isClient` ANTES de que `mdjResolveBuyerSession()` lo pueda voltear a `true`. Para Aron Rosso (JWT artista, sin fila dj, con fila client) el menú dibuja rail de artista (`artist_lite`) mientras el resto de la cabecera lo trata como comprador. Es la tercera capa del problema, no una cuarta fuente de verdad.

**Decisiones de política que necesita el PO antes del paso 4** (recomendación en cursiva):
1. Error de red + fila client sin JWT client: ¿gana el guardia conservador (no deducir cliente) o la fila client? *Recomendado: el guardia — el clasificador canónico ya lo implementa y los clientes reales traen JWT `client`, así que no pierden nada.*
2. JWT `user_type='client'` vs fila `dj_profiles` no-cliente: ¿gana el JWT o la base de datos? *Recomendado: la base de datos — `user_metadata` lo escribe el propio usuario (así lo dice el comentario de `mdj-identity.js`), no debe poder pisar un rol real.*
3. Aron Rosso: ¿es artista (le falta su fila `dj_profiles`) o es cliente (el JWT `artist` está de más)? Dato de negocio, no de código.

**Qué sigue (paso 4, propuesto, no ejecutado):** borrar c5-c8 (cero efecto, ya probado), y reemplazar `isClient` inline + el resto de `mdjResolveBuyerSession()` por `idn.principal === 'buyer'` aplicando las decisiones 1 y 2, calculando `navTier` DESPUÉS de esa decisión. Con las dos decisiones tomadas el cambio de comportamiento queda acotado a las 12 combinaciones listadas arriba, ninguna con cuenta real hoy. El paso 5 (prueba en vivo con las combinaciones reales) sigue igual.

Arneses reproducibles de esta sesión (scratchpad de la sesión, no commiteados): `test-buyer-session.js` (matriz de casos con nombres) y `ablation.js` (ablación por condición y en grupo).

### Corrección al "Paso 3" y decisiones del PO (2026-10-03)

**Corrección importante:** la conclusión "c5-c8 son código muerto" solo es cierta en las páginas que SÍ cargan `mdj-identity.js`. **7 páginas cargan `mdjb-shared-header.js` sin cargar `mdj-identity.js`** (`dj-profile.html`, `dj-dashboard.html`, `staff.html`, `staff-admin.html`, `staff-agenda.html`, `calendario-operacional-inteligente.html`, `road-map.html`; las otras 74 páginas con header sí lo cargan). En esas 7, `idn` es `null` y el header usa su respaldo inline: ahí `mdjResolveBuyerSession()` corre sin c2/c4/c5, y c3/c6/c7 son las que deciden. Consecuencia: el cambio de `djRowError` del PR #622 y el respaldo de JWT staff de `mdj-identity.js` (PR #620) no tenían ningún efecto en esas 7 páginas. Mientras `idn` no exista en todas, no se puede borrar el respaldo inline.

Dar el clasificador a esas 7 páginas cambia el resultado en 54 de 360 combinaciones (arnés `legacy-vs-canon.js`), **todas** cuentas con JWT `owner`/`seller` SIN fila en `dj_profiles` (caso degradado): hoy en esas páginas pierden el estatus de staff y, si además tienen fila client, el header las trata como comprador. Ninguna cuenta real hoy (el owner y la vendedora sí tienen fila `dj_profiles`). Es decir: es una corrección, no un riesgo para cuentas reales.

**Decisiones del PO:**
1. Error de red + fila client sin JWT client → **gana el guardia conservador** (no deducir "cliente" solo por la fila).
2. JWT `user_type='client'` vs fila `dj_profiles` no-cliente → **gana la base de datos**.
3. Aron Rosso → **es cliente** (el PO primero dijo artista y se corrigió el mismo día; vale lo último). El clasificador ya lo da como comprador (fila client, sin fila dj), así que no hace falta regla extra. Queda pendiente, aparte y sin tocar sus datos, que su `app_metadata.role` sigue diciendo `artist` y debería corregirse en Auth.

**Autorizado por el PO (2026-10-03):** opción 1, una línea `<script src="./mdj-identity.js…">` en cada página afectada. Corrección: eran **4**, no 7. `calendario-operacional-inteligente.html`, `staff.html` y `road-map.html` solo nombran el header en comentarios y no lo cargan; las que de verdad lo cargan sin clasificador eran `dj-profile.html`, `dj-dashboard.html`, `staff-agenda.html` y `staff-admin.html`.

## 2026-10-03 — Pasos 4 y 5 ejecutados (rama `fix/identity-consolidar-isclient-en-canonico`, SIN comitear)

**Paso 4 — qué cambió:**
- `web/mdjb-shared-header.js`: «¿es comprador?» ahora lo decide `idn.principal === 'buyer'` (el clasificador). Se eliminó el override de `dj-profile.html` y `mdjResolveBuyerSession()` ya no decide cuando hay clasificador (`isBuyerSession = idn ? isClient : …`). El cálculo inline antiguo y `mdjResolveBuyerSession()` quedan SOLO como red de seguridad si `mdj-identity.js` no cargara; borrarlos del todo es una limpieza posterior, ya que las 77 páginas con header cargan el clasificador.
- `mdj-identity.js`: sin cambios (las decisiones 1 y 2 ya eran su comportamiento).
- Una línea `<script>` de `mdj-identity.js` antes del header en `dj-profile.html` (con `defer`), `dj-dashboard.html`, `staff-agenda.html` y `staff-admin.html`.
- **Cache-bust:** `vercel.json` sirve los `.js` con `Cache-Control: public, max-age=31536000, immutable`, o sea que el `?v=` de la URL es el único mecanismo para que un navegador que ya visitó reciba código nuevo. Los PRs #620 (`mdj-identity.js`) y #622 (`mdjb-shared-header.js`) NO subieron el `?v=`, así que quien ya había visitado el sitio siguió con el código anterior. Se subió a `20261003-identidad-unica` en las 73 páginas con el header y las 71 (+4 nuevas) con el clasificador. Las 4 páginas `web/dj/*.html` siguen fijadas a propósito en versiones antiguas del header; no se tocaron.

**Paso 5 — verificación:**
- En vivo (servidor local, sesión real de cliente de Wendy, dentro de páginas completas con `#mainHeader` presente): `index.html` y `client-account.html` dan `principal: "buyer"`, `djRowError: false`, clases `mdj-is-client mdj-buyer-session`, cero errores de consola. Las 4 páginas modificadas sirven el script y lo cargan antes del header.
- Por arnés (Node): las 10 clases de cuenta que importan (artista, cliente, owner, seller+fila client, Aron, guardia de red, JWT vs BD, owner degradado) dan el resultado esperado; las 9 pruebas previas de `mdj-identity.js` siguen en verde.
- **NO verificado en vivo:** sesiones de owner, staff y artista (no hay sesión disponible y las credenciales no se ingresan). Ese caso lo cubre solo el arnés. Pendiente que el PO confirme con su propia sesión de Owner y con un artista antes de mergear.

## 2026-10-03 (tarde) — Seguimiento del PR #625: Aron, respaldo inline borrado, artista verificado

- **Aron Rosso:** `auth.users.raw_app_meta_data.role` pasó de `artist` a `client` (única fila, solo ese campo, con guarda `where role='artist'`, respaldo en el scratchpad de la sesión y comando para revertir). `auth.users` solo tiene un trigger de INSERT, así que el UPDATE no disparó nada. Su `user_metadata.user_type` sigue en `talent`; no influye porque con `app_metadata.role` presente el clasificador ignora `user_type`. Autorizado por el PO.
- **Respaldo inline borrado de `mdjb-shared-header.js`:** se eliminaron `mdjResolveBuyerSession()` completa, la rama `else` del cálculo inline de `isClient` y la variable `metadataSaysClient` (quedó sin uso). Ahora `isClient = !!(idn && idn.principal === 'buyer')`. Si `mdj-identity.js` no cargara, nadie se clasifica como comprador; no se tocó el respaldo de `isDjStaff`/`isNavStaffSolo` (no era el cálculo pedido). `?v=` del header subido a `20261003-sin-respaldo-inline` en las 73 páginas que lo cargan.
- **Sesión de artista verificada en vivo** (`djmago305@gmail.com`, `dbRole: dj`, servidor local): `dj-dashboard`, `dj-profile`, `index` y `account-settings` dan `principal: performer`, sin sesión de comprador, `#mainHeader` presente y modo de header de artista. `staff.html` la devuelve a `dj-dashboard`, como corresponde. **Sin verificar en vivo:** sesión de vendedora.
- **[RESUELTO 2026-10-02, opción B del PO — ver sección de abajo]** Hallazgo aparte: el header llamaba a la Edge Function `member-welcome` (`mdjb-shared-header.js` ~línea 4364), que no existe ni en `supabase/functions/` ni desplegada en producción. En localhost se ve como error de CORS en la consola. Habría que decidir si crearla o quitar la llamada.

## 2026-10-02 (noche) — Errores de consola de localhost corregidos (decisiones del PO)

Revisando los errores de consola que salían en todas las sesiones (Owner, artista, vendedora, cliente), eran dos, sin relación con la identidad:

1. **400 al escribir en `audit_log` (`web/role-guard.js`):** el navegador insertaba `user_id`, `event`, `metadata`, `user_agent`; la tabla actual (`actor_user_id`, `accion`, `detalle`, `origen`, `dispositivo`…) no tiene ninguna de esas columnas y su única política es de lectura, sin INSERT para el cliente. Es decir, los `page_view` de `account-settings`, `staff-admin`, `dj-profile` y `client-portal` **nunca se registraron**; el 400 solo lo hacía visible. **Opción A del PO:** se quitó el helper `logEvent` y el bloque `AUDIT_PAGES`; `?v=` de `role-guard.js` sube a `20261002-sin-auditoria-cliente` en las 4 páginas que lo cargan. Si algún día se quiere auditar accesos de verdad, debe hacerse desde una función del servidor (un registro de auditoría escrito por el navegador es falsificable): es otro ticket.
2. **CORS / petición fallida a `member-welcome`:** correo de bienvenida opcional que nunca existió (ni en el repo ni desplegado) y que el header intentaba tras cada login nuevo. **Opción B del PO:** se quitó `mdjTryMemberWelcomeNotify()` y su llamada; el aviso visual "Bienvenido a la familia" no se tocó. `?v=` del header sube a `20261002-sin-member-welcome`. Si se quiere un correo de bienvenida real habría que crear la función (con el correo diseñado) y volver a llamarla desde `mdjMaybeRunVipWelcomeProtocol()`.

**Sin verificar en vivo:** la sesión del navegador expiró antes de poder recargar las páginas; falta confirmar con una sesión iniciada que ya no salen ni el 400 ni el CORS.
