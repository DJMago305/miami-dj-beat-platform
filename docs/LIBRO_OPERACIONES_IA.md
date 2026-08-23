# LIBRO DE OPERACIONES IA — MIAMI DJ BEAT LLC

> Norma operativa obligatoria para todo hilo (Hilo Maestro y especialistas) que trabaje
> sobre este repositorio con agentes de IA. No es un documento de referencia opcional:
> las cinco reglas de la Parte I son de cumplimiento obligatorio, sin excepción, para
> cualquier hilo, en cualquier dominio.
>
> Fuente de verdad operativa del día a día: [`docs/ESTADO_MAESTRO.md`](ESTADO_MAESTRO.md).
> Matriz de dominios: [`docs/JURISDICCIONES.md`](JURISDICCIONES.md).
> Bitácora de incidentes UI: [`docs/INCIDENTES.md`](INCIDENTES.md).
>
> Última redacción: 2026-08-22, aprobada por el PO sobre el índice de 5 partes.

---

## PARTE I — LOS CINCO MANDAMIENTOS DE SEGURIDAD DE RAMAS Y CÓDIGO

Estos cinco mandamientos no son sugerencias de estilo. Nacieron de incidentes reales,
ocurridos en este mismo repositorio, que costaron tiempo, confianza o ambos. Cada uno
lleva su caso de origen para que quede claro que no son abstractos.

### 1. Verificar antes de ejecutar

Nunca se asume el estado de una migración, de un archivo, o de producción sin
consultarlo físicamente. Un reporte de otro hilo, un mensaje relayado por el PO, o la
propia memoria de una sesión anterior son **hipótesis**, no hechos, hasta que se
comprueban contra la fuente real: el código en `origin/main`, la base de datos con una
consulta de solo lectura, o el navegador en el contenedor real.

**Caso de origen:** durante la auditoría de Stripe Connect (22-ago), un diagnóstico
inicial fue verificado línea por línea contra `origin/main` antes de relayarlo — grep de
`stripe_account_id`, de eventos Connect en `stripe-webhook`, y lectura completa del
esquema de `financial_payables`. En el caso del Centro Legal (LC-12/13A/13B), la
afirmación "podría tumbar la autenticación de 76 tablas" se sostenía hasta que se
verificó el `dueno` real de `auth.uid()` en producción — `supabase_auth_admin`, no el
rol que ejecuta migraciones. El escenario catastrófico se descartó **por evidencia**, no
por intuición. Sin esa consulta física, el acta habría quedado con un riesgo sobre
dimensionado.

**Cómo se aplica:** ningún hilo declara "está resuelto", "no existe", o "es seguro"
sin la consulta —código o base de datos— que lo respalde, citada en el propio reporte.

### 2. Nunca pisar el trabajo de otra sesión

Varios hilos comparten worktrees y, en algunos casos, la misma carpeta física. Un
`checkout -b`, un `commit`, o un `reset` ejecutado sin mirar antes qué hay en el árbol
puede borrar o mezclar trabajo ajeno sin que git avise con un error — simplemente
fusiona en silencio o lo pisa.

**Caso de origen:** el 22-ago, un commit del hilo #5 (Weather/UI) destinado a su propia
rama cayó en la rama del Hilo Maestro porque ambos operaban en la misma carpeta
compartida (`/Users/djmago/Desktop/miami-dj-beat-platform`) sin worktrees dedicados.
El commit no se perdió — se encontró, se verificó como limpio, y se subió al lugar
correcto — pero pudo haber salido mal. La respuesta correcta ante esto **no es
sobrescribir**: es investigar, aislar con `stash` o worktree, y reportar antes de tocar
nada. Esa colisión es la razón directa por la que hoy existe un worktree dedicado
(`~/Desktop/mdjb-weather-ui`) para ese hilo.

**Cómo se aplica:** antes de cualquier `checkout`, `reset`, o `commit` de alcance
amplio (`git add -A`), correr `git status` y leer qué hay. Si hay cambios ajenos sin
commitear, se preservan con `stash` (nombrado, explicando de quién son) o se aíslan
en la porción exacta que corresponde tocar — nunca se arrastran a un commit propio.

### 3. Todo SQL declara su entorno en el encabezado

Ningún bloque SQL se entrega, se guarda, o se ejecuta sin una cabecera que diga,
explícita e inequívocamente, si es PRUEBA o PRODUCCIÓN — incluyendo el `ref` del
proyecto de Supabase, porque los nombres de los proyectos son engañosos (el proyecto
llamado "mdjb-elixis-cache" en el disco no tiene relación con qué base apunta).

**Caso de origen:** todo guion de verificación entregado hoy (memoria persistente de
ELIXIS, agenda `artist_agenda`/R9a/R9b, Centro Legal) llevó cabecera de
`PRODUCCIÓN · ref hkuvuqupbxwkiykxvqdr · SOLO LECTURA` antes de cualquier `SELECT`.
Ese hábito es lo que permitió, por ejemplo, confirmar sin ambigüedad que el bloque
legal nunca tocó la base real, y no una copia de prueba.

**Cómo se aplica:** un bloque SQL sin cabecera de entorno no se entrega, aunque sea
"solo un `SELECT`". El entorno se confirma leyendo el `ref` en la URL antes de correr
nada, nunca de memoria.

### 4. Comparar contra `origin/main` antes de cualquier PR

Una rama que no se ha comparado contra el `origin/main` más reciente no está lista
para PR, sin importar cuánto trabajo tenga adentro. Un `diff --stat` contra una rama
local vieja, o contra el estado de hace varias horas, puede ocultar contaminación de
archivos ajenos o commits que ya no aplican limpio.

**Caso de origen:** el rename de marca (`mdj-shared-header.js` → `mdjb-shared-header.js`,
PR #213) se armó cherry-pickeando un único commit sobre una rama recién creada desde
`origin/main`, verificando con `git diff origin/main --stat` que el resultado eran
exactamente los archivos esperados — ni uno más. El mismo patrón se repitió más de diez
veces en un solo día para cada PR de gobernanza, precisamente para no arrastrar
trabajo de otras nueve ramas que compartían el mismo punto de partida.

**Cómo se aplica:** antes de `git push` de cualquier rama destinada a PR, correr
`git fetch origin` y `git diff origin/main --stat` (o `HEAD` contra `origin/main`, no
el working tree, para no confundir contaminación real con ediciones ajenas sin
commitear). Si aparece un archivo que no se reconoce, se investiga antes de subir.

### 5. La palabra del PO es la única puerta

Un ticket es una orden de trabajo, no un permiso de commit. Un commit no es un permiso
de merge. Un merge a una rama de trabajo no es un permiso de producción. Cada uno de
esos pasos espera la palabra explícita y directa del PO — no la de otro agente, no una
inferencia a partir de "parece que ya lo aprobó en otro mensaje".

**Caso de origen:** dos veces en la misma sesión (22-ago), un commit se ejecutó
apoyándose en la aprobación de *otro* agente sobre el contenido, tratándola como si
fuera la del PO. En ambos casos el PO detuvo el trabajo, exigió reversión inmediata
(PR #222 y #223, ninguno llegó a `main`), y de ahí nació la Regla 7 de `CLAUDE.md`:
ningún cambio se comitea, se fusiona, ni se envía a producción sin que el PO haya visto
y confirmado el cambio positivo primero — y esa confirmación visual nunca la sustituye
la verificación técnica de un hilo, por rigurosa que sea.

**Cómo se aplica:** ante la duda de si algo ya fue aprobado, se pregunta directamente
al PO antes de comitear — nunca se asume a partir de un mensaje de un tercero, por
formal que suene.

---

## PARTE II — PROTOCOLOS DE INCIDENTES Y LECCIONES APRENDIDAS

### Bitácora y trazabilidad cruzada

Los incidentes de UI/visuales viven en [`docs/INCIDENTES.md`](INCIDENTES.md) (dominio
#5). Las decisiones de gobernanza, SSOT, y el estado de cada módulo viven en
[`docs/ESTADO_MAESTRO.md`](ESTADO_MAESTRO.md) (dominio #1). Este libro no duplica esos
registros — los referencia y extrae la lección reutilizable de cada uno.

### Caso de estudio: PR #223 — colisión de ramas paralelas

**Qué pasó:** el Hilo Maestro comitió y abrió un PR (#223, contenido de gobernanza)
apoyándose en la aprobación de redacción de otro agente, sin que el PO hubiera dado la
orden directa de comitear. El PO detectó la falta y exigió reversión inmediata.

**Qué se aprendió, más allá de la Regla 7:** la investigación posterior reveló que el
verdadero riesgo de fondo no era solo de autorización — era estructural. Varios hilos
operaban en la misma carpeta física sin worktrees propios, así que un simple
`checkout -b` del Hilo Maestro podía (y de hecho lo hizo, en un incidente relacionado
el mismo día) capturar el próximo commit de otro hilo en la rama equivocada.

**Regla que nace de aquí:** worktree dedicado por hilo activo (ver Parte IV). No es
suficiente con "tener cuidado" — el aislamiento físico es la mitigación real.

### Caso de estudio: `docs/roadmap/master-map.json` — reporte cruzado sin verificación propia

**Qué pasó:** durante el desarrollo del Libro de Operaciones, llegó a esa sesión un
reporte en primera persona sobre una reconciliación de `master-map.json` tras el
PR #210, describiendo identificadores (`V9`/`V10`/`R13`) con significados distintos
entre dos sesiones paralelas. La sesión que lo recibió verificó que el PR #210 y el
archivo eran reales — pero el contenido del reporte no correspondía a ningún trabajo
hecho en esa sesión.

**Qué se hizo — y es el ejemplo correcto:** la sesión **no ejecutó ninguna
reconciliación**. Declinó actuar sobre un reporte que no podía verificar como propio, y
le devolvió la pregunta al PO en vez de adivinar o "arreglarlo" por su cuenta.

**Regla que nace de aquí:** un reporte de un tercero sobre el propio trabajo no se
ejecuta a ciegas, aunque suene formal y específico. Si no se puede verificar contra lo
que la sesión misma hizo, se reporta la discrepancia — no se actúa sobre ella.

### Protocolo "Reporto, no ejecuto"

Procedimiento formal para cuando una tarea llega a un hilo, pero excede su jurisdicción
asignada (ver `docs/JURISDICCIONES.md`) o su propio conocimiento verificable:

1. **No se ejecuta la tarea.** Ni parcialmente, ni "solo para adelantar".
2. **Se identifica por qué excede el alcance:** ¿es de otro dominio? ¿depende de un
   estado que esta sesión no puede confirmar como propio?
3. **Se reporta al Hilo Maestro o al PO, explícitamente**, señalando la discrepancia o
   el límite de jurisdicción — nunca en silencio, nunca asumiendo que "alguien más ya
   lo vio".
4. **Se espera la redirección o autorización explícita** antes de tocar cualquier
   archivo relacionado.

Este protocolo se ejercitó en vivo, dos veces, el 22-ago: una vez con el reporte de
`master-map.json` arriba descrito, y otra cuando el Hilo Maestro rechazó redactar este
mismo documento al descubrir que el encargo original decía "Dominio #3" — hasta que el
PO confirmó explícitamente a quién correspondía.

---

## PARTE III — OPERACIONES FINANCIERAS: SSOT Y CONSISTENCIA DE DATOS

### SSOT de balance y payables

**Resuelto (PO, 22-ago):** `financial_payables` / `financial_payments` /
`financial_owner_ledger_entries` son la única fuente de verdad de balances y payouts
de artista. `dj_ledger` (legacy) queda marcada para **deprecación progresiva** — no se
borra, no se dispara ninguna migración de limpieza todavía, pero ningún desarrollo
nuevo se construye sobre ella.

**Por qué hacía falta la decisión:** ambos modelos coexistían sin reconciliar. La
auditoría encontró que `dj_ledger` es un cascarón de balance sin ningún campo ni
función que mueva dinero real — un remanente de una iteración anterior — mientras que
`financial_payables` y afines ya tienen el modelo de datos correcto (`payee_type`,
`purpose`, asignaciones), solo falta el motor de pago real encima.

### Estado de Stripe Connect

**Diagnóstico verificado (22-ago):** cero infraestructura Connect existe en el repo —
sin `stripe_account_id`, sin eventos de Connect (`account.updated`, `payout.paid`,
`transfer.created`) en `stripe-webhook`, sin `accounts.create` en ningún Edge Function.
Existe el modelo de datos para que un artista sea un `payee` con un `payable`
pendiente — no existe el motor que lo convierte en dinero real en su cuenta.

**Decisión:** construcción diferida a un sprint dedicado, después del cierre de la
matriz de contenedores. No se abre ticket de construcción hasta entonces.

### Libro de Operaciones — registro inmutable de incidentes y facturación propia del artista

Estado real de la construcción, según el registro de sesión más reciente
(`docs/sessions/SESSION-LOG-2026-08-22.md`, rama
`feature/libro-operaciones-prerrequisito-a`, sin fusionar a `main`, sin PR abierto):

| Fase | Estado | Qué hace |
|---|---|---|
| Prerrequisito A | ✅ Comiteado | `libro.leer_propio` añadido al catálogo canónico de `fenix_acciones_canonicas()` (M5), sin editar M5 directamente. |
| Fase 1 — esquema y candado | ✅ Comiteado, confirmado corrido en Prueba | Tabla `libro_operaciones` con RLS activa y **cero políticas** — la única entrada es `libro_operaciones_reportar()` (SECURITY DEFINER), la única salida es la vista `libro_operaciones_staff` filtrada por `is_staff()`. |
| Fase 2A — autoridad de concesión | ✅ Comiteado, **sin confirmar corrido en Prueba** | `fenix_can()` aprende `libro.leer_propio` por rol; concesión de lectura puntual con vencimiento obligatorio; exige aceptación de cláusula legal en el servidor antes del primer reporte. |
| Fase 2A — pantalla del artista | ✅ Comiteado | Pestaña "LIBRO" en `dj-profile.html`, visible solo al dueño del perfil. |
| Fase 2B — pantalla de staff | ✅ Comiteado | `web/staff-libro-operaciones.html` — vista agregada con filtros, candado igual al de `staff-order.html`. **Sin enlace desde ningún menú todavía, deliberado** — no se toca navegación sin que se pida. |
| Reporte del cliente | ✅ Comiteado | Tabla aparte `libro_operaciones_reportes_cliente` (el cliente no factura), tope duro de 280 caracteres a nivel de columna, botón "Reportar" en `client-portal.js` con enlace a la calificación pública ya existente (sin duplicar `dj_public_reviews`). |
| Fase 3 — ELIXIS analista | 🔴 Sin empezar | Toca código que ya corre en producción (`elixis-chat`, `approval-gate.ts`) — pausado a propósito, pendiente de confirmación explícita que nunca llegó. |
| Fases 4, 5, 6 | 🔴 Sin empezar | Dependen de la Fase 3 (4 y 5) o de fusionar primero el puente seguro del clima (6). |

**Riesgo abierto de esta rama:** nació del commit `960768b` (antes del PR #200);
desde entonces `main` recibió los PR #202 al #230. Ningún archivo de la rama coincide
con los tocados en ese rango (verificado), pero la rama no se ha traído a `main` —
antes de cualquier PR real de esta pieza, hace falta rebasarla y reconfirmar.

**Decisiones pendientes, solo del PO** (sin cambios desde la Constitución del Libro):
catálogo cerrado de tipos de incidente (hoy es texto libre), nivel de protección
técnica adicional sobre los datos, margen de armado exacto por tipo de evento (Fase 6),
destino real de la Fase 4, y si conviene construir ya la Fase 3 dado que toca código de
producción.

### Regla de confidencialidad de montos

**Ley permanente:** ninguna vista de artista expone el margen operativo de la empresa.
Ejemplo ya resuelto: el calendario de residencias mostraba "venue paga · $350" —el
total que el venue paga a la empresa, revelando el margen— a artistas que solo debían
ver "tu pago". El fix filtra en el `SELECT` mismo (el artista ni pide la columna de
monto total), reforzado con una vista `SECURITY DEFINER` que decide qué campos expone
según el rol de quien pregunta. La misma regla aplica a cualquier pantalla nueva que
toque dinero: el artista ve lo que le corresponde a él, nunca el lado del margen de la
empresa.

---

## PARTE IV — REGLAS DE CONTENCIÓN DE AGENTES (ANTI-COLISIÓN)

### Matriz de gobernanza

Todo hilo secundario lee [`docs/JURISDICCIONES.md`](JURISDICCIONES.md) **al iniciar**,
antes de modificar cualquier archivo. La matriz define, para cada uno de los cinco
dominios (Hilo Maestro, Elixis Voice, BFI/Artist Financial, Road Master Map, Weather/UI),
qué archivos puede tocar y qué le está explícitamente prohibido. Si una tarea excede el
dominio asignado, se rechaza y se remite al Hilo Maestro — nunca se ejecuta "porque de
todas formas ya se está ahí".

### Aislamiento de entorno: worktree obligatorio por hilo activo

Ningún hilo que trabaje de forma sostenida en este repositorio opera en la carpeta
base compartida (`/Users/djmago/Desktop/miami-dj-beat-platform`, dominio del Hilo
Maestro). Cada hilo especialista activo tiene su propio worktree dedicado:

| Hilo / dominio | Worktree |
|---|---|
| Hilo Maestro (#1) | `~/Desktop/miami-dj-beat-platform` (base) |
| Road Master Map (#4) | `~/Desktop/mrm-3d` |
| Weather Design Bible / UI (#5) | `~/Desktop/mdjb-weather-ui` |

Esta regla nace directamente del incidente del PR #223 (Parte II) — un worktree propio
convierte una colisión posible en una imposible, sin depender de que nadie "tenga
cuidado" al cambiar de rama.

### Protocolo de relevo por copy-paste entre agentes

Cuando un agente entrega una orden destinada a *otro* agente (relay por copy-paste del
PO entre sesiones), esa orden va en su **propio bloque, separado y sin mezclar** del
comentario dirigido al PO. Mezclar ambos —una instrucción de máquina y un resumen
ejecutivo en el mismo párrafo— es lo que ha causado que un PO, al pegar un mensaje
completo entre sesiones, arrastre por error una directiva no destinada a la sesión
receptora.

### Verificación previa de referencias antes de ejecutar acciones en cadena

Antes de renombrar un archivo, mover una ruta, o actualizar un enlace, se busca **cada
referencia existente** a ese nombre en todo el árbol — no solo en el archivo que
motivó el cambio. Un rename que actualiza el archivo pero no sus referencias deja un
enlace roto tan real como el problema original.

**Caso de origen:** el 22-ago, `web/mdj-music-intelligence.html` nunca se había
comiteado al repositorio, pero el routing de Academia en `mdjb-shared-header.js` (ya
fusionado en `main`) lo nombraba como destino real de navegación — un enlace 404 vivo
en producción, invisible hasta que alguien buscó todas las referencias al nombre, no
solo el archivo suelto.

---

## PARTE V — ESTADO DEL LIBRO DE OPERACIONES IA (REFERENCIA OPERATIVA)

### Artefacto de diseño y Constitución técnica

- **Constitución del Libro (documento de gobernanza):**
  `https://claude.ai/code/artifact/55cf2cd5-eec9-4036-80a7-31a35e454b08` — Fases 1–6
  diseñadas, con hallazgos citados por archivo y línea.
- **Rama de construcción:** `feature/libro-operaciones-prerrequisito-a` — sin fusionar
  a `main`, sin PR abierto a la fecha de este documento.
- **Registro de sesión más reciente:** `docs/sessions/SESSION-LOG-2026-08-22.md`
  (en esa misma rama) — fuente de la matriz de estado de la Parte III.

### Matriz de estado (completado / pendiente de validación / bloqueado)

- **Completado y comiteado:** Prerrequisito A, Fase 1, Fase 2A (autoridad + pantalla
  del artista), Fase 2B (pantalla de staff), reporte del cliente + enlace público.
- **Pendiente de validación:** ningún flujo se ha probado con sesión autenticada real
  de artista, staff, o cliente — solo verificación de sintaxis/consola en servidor
  estático local, sin sesión. Los cinco bloques de prueba de humo de las migraciones
  no se han corrido contra una sesión real.
- **Bloqueado:** Fase 3 (ELIXIS analista, toca código de producción, sin confirmación
  del PO para empezar), Fases 4 y 5 (dependen de la Fase 3), Fase 6 (depende de
  fusionar primero el puente seguro del clima).

### Control de migraciones ejecutadas en entorno de Prueba

Confirmado corrido en Prueba, a la fecha del último registro de sesión:

- `fenix_authority_2A.sql`, M1, M2, M3, M5.
- `20260821000000_libro_operaciones_accion_canonica.sql` — confirmado:
  `fenix_acciones_canonicas()` devuelve 11 acciones incluyendo `libro.leer_propio`.
- `20260821010000_libro_operaciones_fase1_esquema.sql` — confirmado corrido
  (captura de pantalla del 21 de agosto).

**Sin confirmar corrido en Prueba:**

- `20260821020000_libro_operaciones_fase2a_autorizacion.sql` — sin esto, la
  concesión puntual de lectura y la exigencia del aviso legal no están activas en
  Prueba, aunque el código ya esté escrito.
- `20260821030000_libro_operaciones_reportes_cliente.sql` — nunca se pidió correr.

**Nota de vigencia:** esta matriz refleja el estado al momento de redactar este libro.
Antes de retomar cualquier fase, se re-verifica contra el estado real de la rama y de
Prueba — por la misma Regla 1 de la Parte I. No se asume que sigue igual solo porque
está escrito aquí.
