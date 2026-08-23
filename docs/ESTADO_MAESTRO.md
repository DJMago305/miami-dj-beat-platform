# ESTADO MAESTRO — MIAMI DJ BEAT LLC (SSOT)
Última actualización: 2026-08-22
Estado general: Operativo / En consolidación

## 1. Módulos y Estado Técnico
- [x] Motor de Voz Realtime ELIXIS (PR #202 desplegado en producción)
- [x] Políticas de Cuota y RBAC (3h Full / 5h Mini / Fallback a texto)
- [x] Despacho SMS Seguro (`elixis_sms_pending` + validación E.164 + Twilio, verificado con envío real)
- [x] Saneamiento de Marca (Retirado SoundCaribe, unificado Miami DJ Beat LLC)
- [x] Ejecución de SQL de Memoria Persistente en Supabase (`elixis_memoria_PRODUCCION.sql`)
      — 2026-08-22. Instalado y VERIFICADO en producción (ref hkuvuqupbxwkiykxvqdr):
      escribir ok=true · recordar=1 · olvidar=true.
      Objetos activos: `elixis_memory_facts` (voz), `agent_memory` (texto),
      vista unificada `dj_memory_facts` y funciones write/forget/recall/upsert (service_role).
- [ ] Conexión Stripe Connect Artistas (Sub-hilo Financiero)
      — 2026-08-22 DIAGNÓSTICO (Hilo Business Financial Intelligence, verificado por el
      Hilo Maestro): NO existe infraestructura Connect en el repo — cero
      `stripe_account_id`, cero eventos Connect en `stripe-webhook`, cero
      `transfer`/`accounts.create`. Sí existe el modelo de datos (`financial_payables`
      con payee DJ_PROFILE) pero no el motor que mueve dinero real.
      ⚠️ BLOQUEANTE antes de construir: hay dos ledgers de balance de artista sin
      reconciliar — `dj_ledger` (legacy) y `financial_payables`/`financial_owner_ledger_entries`
      (canónico nuevo). Decisión pendiente del PO: cuál es la fuente de verdad,
      antes de conectar Stripe Connect encima de cualquiera de los dos.
      — 2026-08-22 RESUELTO (Hilo Business Financial Intelligence): SSOT formal —
      `financial_payables`/`financial_payments`/`financial_owner_ledger_entries` son
      la única fuente de verdad de balances y payouts. `dj_ledger` queda marcado
      para deprecación progresiva (sin borrar nada, sin migración disparada aún).
      Stripe Connect diferido a sprint dedicado, post-cierre de la matriz de
      contenedores.
- [ ] Reconciliación de la Agenda del Artista (Sub-hilo Road Master Map / Calendario BI)
      — 2026-08-22 HALLAZGO (Hilo Maestro): el calendario rediseñado y aprobado
      (`calendario-operacional-inteligente.html`, 10–14 ago) no lee `artist_agenda`
      (16-ago, R9a/R9b) — lee `leads`, igual que `staff-agenda.html`. El write-path
      real que resuelve "la reserva no escribe en el calendario personal" existe
      por un camino paralelo: `web/dj-dashboard.html` (sección "Calendario
      Personal", RLS `dj_user_id = auth.uid()`) y las dos tools de `elixis-chat`
      (`consultar_agenda_artista` / `registrar_evento_agenda`).
      — 2026-08-22 PRECISIÓN (Hilo Road Master Map, verificado por el Hilo Maestro
      en el código): `dj_events` (legacy, mar-2026) no tiene NINGÚN lector ni
      escritor en toda la plataforma — ni web, ni edge functions. El único rastro
      es un comentario en `elixis-chat` explicando por qué no se usa ("dj_events
      está vacío"). No participa del riesgo de consistencia: `elixis-chat` solo
      cruza dos fuentes reales, `leads`/`event_builder_orders` y `artist_agenda`
      — no tres. Sigue siendo una pregunta legítima de consistencia entre esas dos.
      — 2026-08-22 CUARTA PIEZA (Hilo Road Master Map, verificado por el Hilo
      Maestro): la misma línea de comentario que descartó a `dj_events` nombra
      dónde viven las reservas reales — `event_builder_orders` (la tabla del
      disparador de avisos instalado hoy, estados `confirmed`/`cancelled`).
      Tiene 8 consumidores reales (`elixis-chat`, `stripe-webhook`,
      `admin-dashboard.html`, `staff-admin.html`, `staff-order.html`,
      `client-portal.js`, `mdj-event-builder.js`, `production-module.js`) y
      **cero** en las 3 pantallas de agenda. Enlaza con `leads` por FK nullable
      (`event_builder_orders.lead_id → leads.id ON DELETE SET NULL`) — una orden
      confirmada y pagada sin `lead_id` (o con el lead borrado) sería invisible
      para cualquier calendario que solo lea `leads`.
      **Recomendación (Hilo Road Master Map):** la pregunta de SSOT de agenda no
      es de tres piezas sino de dos ejes — (1) **reserva**: `leads` (lo que leen
      hoy las pantallas) frente a `event_builder_orders` (la orden pagada, Stripe
      y el disparador de avisos) hay que reconciliarlos antes de fijar uno solo;
      (2) **proyección personal**: `artist_agenda`, ya resuelta como derivada,
      alimentada de forma idempotente por R9b. `dj_events` queda como baja simple
      — cero consumidores de código, nada que desconectar antes. Decisión final
      de SSOT (reserva) pendiente del PO.
      — 2026-08-22 VERIFICADO EN PRODUCCIÓN (Hilo Road Master Map, ref
      hkuvuqupbxwkiykxvqdr, guion de solo lectura de 25 filas): `artist_agenda`/R9a/R9b
      está aplicado **entero**, nada a medias — funciones `artist_agenda_record` y
      `artist_agenda_record_from_assignment`, `is_staff`, el índice único
      `artist_agenda_assignment_lead_dj` (garantiza que R9b no duplique al
      reasignar), RLS activo con sus dos políticas (staff / artista sobre lo
      suyo), y las 4 columnas del puente de identidad — todo `true`. Las 3 tablas
      fantasma del encargo original (`events`, `agenda_locks`, `dj_assignments`)
      confirmadas `false` también en la base, no solo en el código.
      — 2026-08-22 DECISIÓN DEL PO: **R9b NO es la solución definitiva por sí solo.**
      Es necesario integrar lo que R9b ya escribe en `artist_agenda` DENTRO del
      calendario rediseñado (`calendario-operacional-inteligente.html`) — no basta
      con que la reserva aparezca solo en la lista simple de `dj-dashboard.html`.
      **R9 del mapa (Road Master Map) queda ABIERTA** — no se cierra hasta que esa
      integración exista. Próximo paso técnico: que el calendario rediseñado lea
      `artist_agenda` (o su equivalente tras resolver el SSOT de reserva de arriba)
      además de `leads`, en la vista de artista.
      — 2026-08-22 SSOT DE RESERVA RESUELTO (PO): **`event_builder_orders` gana**
      sobre `leads` como fuente de verdad comercial de la reserva. Toda orden
      confirmada en `event_builder_orders` debe materializarse en `artist_agenda`
      (resolviendo la junta de identidad `leads.assigned_dj_id`/`dj_profiles.id`
      → `auth.users.id`). `artist_agenda` sigue siendo la proyección personal del
      artista, no la fuente. `dj_events` queda marcada para DROP en la próxima
      migración de limpieza (cero consumidores de código, ya verificado).
      — 2026-08-22 GUION DE BAJA ARCHIVADO: `supabase/scripts/cleanup_dj_events.sql`
      (PR #233, fusionado) — 4 pasos, no un DROP directo: auditoría de dependencias
      en solo lectura (filas, FKs entrantes, vistas), copia de resguardo
      (`dj_events_archive_20260822`), el `DROP TABLE` comentado a propósito, y
      verificación posterior. Vive en `supabase/scripts/`, no en
      `supabase/migrations/` — disponible para **ejecución manual controlada**,
      ningún `supabase db push` lo corre solo. Pendiente: que el PO lo ejecute
      línea por línea en producción cuando lo decida.
      — 2026-08-22 POLÍTICA (PO): la agenda de STAFF es la **master** (Matrix/Owner
      — `calendario-operacional-inteligente.html` en modo staff); la de artistas
      y clientes es **personal** (aislada por RLS, cada quien ve solo lo suyo).
      Encaja con lo ya construido para el artista (`artist_agenda`, RLS
      `dj_user_id = auth.uid()`). El calendario de CLIENTE todavía no existe —
      queda anotado como tarea futura, no se construye ahora.
- [ ] Calendario de Cliente (futuro, sin dominio asignado todavía)
      — 2026-08-22 REGISTRADO (PO): no existe todavía. Anotado como tarea para
      más adelante, siguiendo la política master/personal de arriba — el
      cliente vería su propia agenda personal, aislada, igual que el artista.
- [ ] Bug de layout: clima encogido en `staff.html?vista=agenda` (sin dominio activo)
      — 2026-08-22 HALLAZGO (Hilo Maestro, en vivo con el PO): a ancho de
      escritorio, `web/weather-experience/` (embebido dentro de `staff-agenda.html`)
      se renderiza encogido en una tarjeta angosta arriba a la izquierda en vez
      de usar el ancho disponible; el calendario grande sí carga más abajo, pero
      es fácil no llegar a verlo. Localizado en `web/weather-experience/styles.css`
      (`.center`/`.rail`/`.exp`) — no es un problema de datos ni de sesión, es de
      layout responsivo del propio módulo. Dominio #5 (Weather Design Bible / UI)
      de la matriz — sin hilo activo en ese dominio ahora mismo. No causado por
      el rename de marca de hoy (verificado). Sin arreglar todavía.
- [x] Centro Legal (LC-12/13A/13B) — auditoría forense cerrada, riesgo neutralizado
      — 2026-08-22 HALLAZGO (dominio #3, verificado por el Hilo Maestro y en
      producción real por el PO): son 9 tablas `legal_*` (la auditoría de julio
      decía 8 — su sonda truncaba nombres largos), cero consumidores de código
      en `web/` ni `supabase/functions/`, diseñadas contra `MiamiDJBeat-MigracionV2`
      (repo que nunca aterrizó). Las 3 migraciones se autodeclaran "NOT APPLIED"/
      "isolated Postgres validation" en sus propias cabeceras.
      ⚠️ **Riesgo encontrado, con severidad corregida tras verificar en
      producción:** `20260722101300_..._lc13a.sql` redefine `auth.uid()` con un
      stub de laboratorio sin el respaldo JSONB (`request.jwt.claims`) que sí
      tiene la función real — confirmado en producción: `auth.uid()` real usa
      `coalesce(...)` entre `request.jwt.claim.sub` y `request.jwt.claims->>'sub'`;
      el stub solo lee la primera rama. **Pero el escenario catastrófico queda
      DESCARTADO**: `auth.uid()` real es propiedad de `supabase_auth_admin`, no
      del rol que ejecuta las migraciones — `CREATE OR REPLACE FUNCTION
      auth.uid()` fallaría con "must be owner of function uid". `LC-13A` no
      puede ejecutarse en Supabase alojado tal como está escrita; sus propias
      cabeceras ya lo decían ("isolated Postgres validation" — se escribió para
      un Postgres local). El daño real, más pequeño pero concreto: un
      `supabase db push` aplicaría LC-12 con éxito (7 tablas + secuencia) y
      luego LC-13A abortaría en su línea 12, dejando 7 de 9 tablas huérfanas
      (sin RLS, sin las funciones que las protegen) y la cadena de migraciones
      en estado fallido, bloqueando la siguiente migración legítima. Las
      migraciones vivían en `supabase/migrations/` — la carpeta que
      `supabase db push` ejecuta sin preguntar — de ahí que moverlas siguiera
      siendo lo correcto, aunque el riesgo real sea de cadena rota, no de
      autenticación caída.
      **Verificado en producción real (PO):** cero estado parcial — las 9 tablas,
      la secuencia y las 22 funciones legales salen `AUSENTE` sin excepción. No es
      una migración a medias, es un módulo entero que nunca tocó la base.
      **Acción tomada:** las 3 migraciones se movieron a
      `supabase/scripts/legal-center-design/` (con README explicando el porqué y
      los pasos antes de reescribir) — solo rename, cero contenido SQL modificado.
      Riesgo vivo neutralizado sin perder el diseño. No se aplica ni se borra
      todavía; se reescribe cuando exista producto real, sustituyendo el stub por
      identidad real y retirando las dos tablas de laboratorio `legal_lc13*`.
      **Nota de gobernanza:** el Centro Legal no tenía dominio en
      `docs/JURISDICCIONES.md` — cae dentro del #3 (BFI/Artist Financial,
      "reportes de ingresos y contratos"), pero no estaba registrado
      explícitamente. Pendiente formalizarlo si vuelve a activarse.
- [x] `platform_incidents` — núcleo de registro inmutable de incidentes técnicos/UI (PR #235, fusionado)
      — 2026-08-23 (Hilo Maestro, contrato de datos aprobado por el PO antes de
      escribir código): tabla `platform_incidents` con RLS activo y **cero
      políticas** — mismo candado que `libro_operaciones`, dominio distinto
      (incidentes de ingeniería/UI, no el diario financiero del artista; son
      tablas separadas, no se mezclan). Única entrada:
      `platform_incidents_reportar()` (SECURITY DEFINER, exige
      `is_staff(auth.uid())`, identidad resuelta en servidor). Única salida:
      la vista `platform_incidents_staff`, filtrada por `is_staff()`. Sin
      UPDATE ni DELETE en ningún camino — un incidente se reporta completo,
      con qué pasó y cómo se solucionó, en una sola fila.
      **Cabecera de entorno: PRUEBA** (`mdjb-ensayo`) — fusionar el PR solo
      subió el archivo al repo; correrlo contra cualquier base sigue siendo
      un paso manual del PO, empezando por el `SELECT to_regclass(...)` de
      comprobación que trae el propio guion.
      **Pendiente, marcado explícitamente en el SQL:** catálogo cerrado de
      `dominio`/`severidad` (hoy texto libre); dónde vive el botón/emoji de
      reporte en la interfaz (decisión de placement de UI, no de este
      contrato); si esta tabla termina alimentando `docs/INCIDENTES.md` o
      coexiste aparte.

## 2. Bitácora de Sincronización entre Cajas
- [2026-08-22] Inicialización del Hub Central de sincronización multi-hilo.
- [2026-08-22] Matriz de Jurisdicciones (`docs/JURISDICCIONES.md`) registrada + regla 6 en `CLAUDE.md`. Rename de marca `mdj-shared-header.js` → `mdjb-shared-header.js` fusionado en 61 archivos activos (PR #213).
- [2026-08-22] Hilo Elixis Voice Agent Blueprint reportó memoria persistente instalada (ver arriba) y detectó `dj_memory_facts` documentada como tabla en `JURISDICCIONES.md` cuando es una vista — corregido por el Hilo Maestro en el mismo commit.
- [2026-08-22] Camino de escritura de la memoria confirmado con datos reales (escribir/recordar/olvidar) — hito de memoria persistente ELIXIS cerrado.
- [2026-08-22] Hilo Business Financial Intelligence entregó diagnóstico de Stripe Connect (ver arriba) — sin infraestructura, con conflicto de dos ledgers sin reconciliar. Esperando decisión del PO antes de abrir ticket de construcción.
- [2026-08-22] SSOT de balance/payouts resuelto: `financial_payables` gana, `dj_ledger` a deprecar progresivamente. Stripe Connect queda diferido a sprint dedicado; el hilo BFI queda en espera de esa fase o de la siguiente tarea en su dominio.
- [2026-08-22] Hilo Road Master Map / Calendario BI auditó el encargo de agenda: las tablas nombradas (`events`, `agenda_locks`, `dj_assignments`) no existen; las reales son `artist_agenda` (16-ago, R9a/R9b), `leads` y `dj_events` (legacy). Decisión de SSOT de agenda pendiente del PO (ver arriba).
- [2026-08-22] PO fijó la política master/personal de agenda (ver arriba) y registró el calendario de cliente como tarea futura. El Hilo Maestro encontró en vivo un bug de layout del módulo de clima dentro de `staff.html?vista=agenda` (ver arriba) — dominio #5, sin hilo activo, sin arreglar.
- [2026-08-22] CORRECCIÓN: el hallazgo del write-path paralelo en `dj-dashboard.html` es del Hilo Maestro, no del hilo Road Master Map (atribución errónea en la entrada anterior). Ese hilo ya rebasó con autorización del PO y su reconciliación completa (`V11`, `V12`, `R14`…`R21`, `cap-estacion-nav`, `cap-avisos-push`) está dentro de `main` — la rama NO sigue aparcada. Queda un commit local sin subir (`c4e1398`, arregla 3 referencias muertas al rename del PR #213 en `docs/roadmap/master-map.json`).
- [2026-08-22] `dj_events` refinado a tabla sin ningún consumidor de código (ver arriba).
- [2026-08-22] Cuarta pieza encontrada: `event_builder_orders` (8 consumidores reales, cero en las pantallas de agenda, enlazada a `leads` por FK nullable). La pregunta de SSOT de agenda se reencuadra en dos ejes — reserva (`leads` vs `event_builder_orders`, sin resolver) y proyección personal (`artist_agenda`, ya resuelta como derivada). `dj_events` queda como baja simple.
- [2026-08-22] `artist_agenda`/R9a/R9b verificado en producción real, instalación completa (ver arriba) — al revés de `avisos_pendientes` (tabla sin función) de anoche. R9 del mapa queda deliberadamente sin cerrar hasta que el PO responda si R9b es definitivo o provisional.
- [2026-08-22] PO respondió: R9b no es definitivo por sí solo — falta integrarlo al calendario rediseñado (ver arriba). R9 del mapa queda abierta, con el próximo paso técnico ya definido.
- [2026-08-22] PO resolvió el SSOT de reserva: `event_builder_orders` gana sobre `leads` (ver arriba). `dj_events` marcada para DROP en la próxima migración de limpieza. Confirmado directamente por el PO, no relayado de un tercero, tras detectarse una contradicción en un mensaje de "resolución" que decía lo opuesto sobre R9b.
- [2026-08-22] **Cierre de sprint de gobernanza y saneamiento git.** `main` consolidado con: Regla 7 en `CLAUDE.md` (auditoría visual obligatoria antes de commit/merge/producción — origen: incidente de commits sin autorización previa del PO, dos veces en la misma sesión); UI-0822 (agenda de staff: paños negros, efecto imán, tarjetas — PR #224); decisiones de R9b y SSOT de reserva (PR #225); `web/mdjb-music-intelligence.html` trackeado por primera vez, corrigiendo un 404 real en producción en el routing de Academia (PR #226); referencias del Road Master Map sincronizadas al rename de marca del PR #213 (PR #227).
- [2026-08-22] **Worktree independiente creado para el hilo #5 (Weather Design Bible / UI):** `~/Desktop/mdjb-weather-ui`, rama `fix/weather-ui-canvas-refit` (incluye el fix de canvas WebGL en iframe anidado + el cache-busting `?v=` que le faltaba al único módulo del sitio sin ese patrón). Previene la colisión de commits cruzados entre hilos que causó el incidente de PR #223 hoy. Ese fix de clima todavía no tiene PR propio a `main` — pendiente de abrir cuando el hilo #5 esté listo.
- [2026-08-22] Centro Legal: auditoría forense cerrada (ver arriba). Corrige la auditoría de julio (eran 9 tablas, no 8). Riesgo de `auth.uid()` sobreescrito confirmado en producción por el PO mismo, con severidad corregida (el escenario catastrófico queda descartado — `auth.uid()` es propiedad de `supabase_auth_admin`, la migración fallaría por permisos, no por tumbar la autenticación), y neutralizado moviendo las 3 migraciones fuera de la ruta ejecutable (PR #230) — sin aplicar ni borrar el diseño.
- [2026-08-22] `docs/LIBRO_OPERACIONES_IA.md` creado y fusionado (PR #231) — norma operativa de los 5 mandamientos de seguridad de ramas/código y los protocolos de contención de agentes, grounded en los incidentes reales de esta sesión.
- [2026-08-22] Fix de clima del hilo #5 fusionado (PR #232, `fix/weather-ui-canvas-refit-v2`): canvas WebGL a ancho completo en el iframe anidado + cache-busting. Ticket cerrado del todo.
- [2026-08-22] `dj_events`: guion de baja archivado y fusionado (ver arriba, PR #233) — disponible para ejecución manual controlada, ninguna migración automática lo dispara.
- [2026-08-23] `platform_incidents` fusionado (PR #235, ver arriba) — núcleo de registro inmutable de incidentes técnicos/UI, contrato de datos aprobado por el PO antes de escribir código. Sprint de la cabecera (Single Row Header) rechazado por el Hilo Maestro y remitido al dominio #5 — protocolo "Reporto, no ejecuto" del propio `docs/LIBRO_OPERACIONES_IA.md` en acción, el mismo día que se escribió.
