# ESTADO MAESTRO — MIAMI DJ BEAT LLC (SSOT)
Última actualización: 2026-08-29
Estado general: Operativo / En consolidación

## 1. Módulos y Estado Técnico
- [x] Motor de Contratos y W-9 (Legal Engine) — núcleo fusionado (PR #244), 2 pendientes visuales abajo
      — 2026-08-23 IMPLEMENTADO Y CORREGIDO (Hilo Maestro, continuando el trabajo
      del Hilo Legal & W-9 Engine): `web/contracts-engine.html` — motor bilingüe
      ES/EN con 5 plantillas (DJ, Corporativo, Venue, Staff, W-9). Conectado a
      `staff.html` y a `dj-profile.html` ("Mis Documentos").
      **El W-9 NO se recreó en HTML/CSS** — un documento fiscal del gobierno no
      se reconstruye, se muestra tal cual: el PDF real (idéntico byte a byte al
      oficial de irs.gov, verificado por SHA-256) queda embebido en un visor,
      con el link directo a `irs.gov/pub/irs-pdf/fw9.pdf` como respaldo. El
      artista lo descarga, lo llena y firma con su propio lector de PDF, y lo
      vuelve a subir por un dropzone (solo `.pdf`, máx. 10MB) que calcula su
      SHA-256 en el navegador (`crypto.subtle`) antes de guardarlo — nunca se
      genera ni se rellena un PDF por código.
      **Acceso reubicado**: "Legal / Contratos" vive únicamente en el menú
      lateral de `staff.html` (grupo Operaciones, mismo patrón que "Inbox ·
      Tickets") — la barra superior quedó intacta, sin tocar (diff verificado).
      **Dos bugs reales de producción encontrados y corregidos en vivo** (ref
      `hkuvuqupbxwkiykxvqdr`): (1) la firma de parámetros de
      `guardar_contrato_firmado` no coincidía — corregida tras verificar los 10
      parámetros reales vía `information_schema.parameters`; sobraba un
      `p_status` que no existe en la función. (2) `signed_contracts.contract_type`
      tiene su propio `CHECK` que solo acepta `W9`/`DJ_AGREEMENT`/
      `VENUE_AGREEMENT`/`CORPORATE_AGREEMENT`/`STAFF_AGREEMENT` — los ids locales
      de plantilla (`w9`, `dj`, `venue`...) no coinciden con esos valores.
      **Esto afectaba a los 5 templates, no solo al W-9** — nadie podía guardar
      remotamente antes de este fix. Corregido con una tabla de mapeo
      (`LOCAL_TO_DB_CONTRACT_TYPE`) en el único punto compartido de guardado.
      Sin verificación end-to-end autenticada dentro del contenedor real de
      `staff.html`/`dj-profile.html` con sesión de staff/artista (Regla 4) — no
      hubo credenciales disponibles en esta sesión de build; sí se probó en
      vivo contra producción el flujo de guardado (hash real + llamada RPC real,
      sin insertar filas de prueba por decisión del PO). Sintaxis validada con
      `node --check`/parseo de scripts en los 4 archivos tocados: sin errores.
      **PR #244 fusionado a `main` (2026-08-23).**
      — 2026-08-23 HOMOLOGACIÓN VISUAL (Hilo Maestro): tema oscuro permanente
      aplicado a `contracts-engine.html` con los tokens reales de `staff.html`
      (`--gold:#c5a059`, `--bg:#050810`) + `backdrop-filter` (glassmorphism)
      en topbar, tarjetas de plantilla, panel de campos, marco del documento y
      dropzone del W-9. El "papel" de los documentos (contrato, PDF del W-9)
      se queda claro a propósito — es el papel dentro del marco oscuro, no el
      chrome de la herramienta. Commiteado como checkpoint local
      (`d9d5922`), sin PR nuevo abierto todavía.
      **⏸️ ARQUITECTURA APROBADA PARA LA PRÓXIMA SESIÓN DE MAQUILLAJE VISUAL**
      (PO 2026-08-23, reemplaza el punteo genérico anterior — esta es la
      versión concreta a construir):
      1. **Nuevo acordeón `⚖️ Bóveda Legal` en el sidebar de Staff** (mismo
         nivel que Gobernanza/Clientes/Equipo/Operaciones/Eventos, no un link
         suelto dentro de Operaciones como quedó hoy). Sus sub-ítems son la
         selección de plantilla, hoy dentro del propio HTML del motor:
         - 🎧 Contrato Artista / DJ
         - 🏢 Eventos Corporativos
         - 🏛️ Venue / Residencia
         - 🎚️ Staff / Operador Técnico
         - 🧾 Formulario IRS W-9
         Click en un sub-ítem → carga esa plantilla en el área principal de
         trabajo (mismo mecanismo de panel que ya usan Gobernanza/Inbox).
      2. **Limpieza del área principal de `contracts-engine.html`**: quitar
         la columna "TEMPLATES" interna (ya no hace falta — la selección vive
         en el sidebar) para que el formulario y el visualizador del
         documento usen el 100% del ancho.
      3. **Quitar la barra superior beige/propia** (ES/EN/Marca) del motor —
         debe vivir bajo el header nativo de `staff.html`, sin una segunda
         cabecera encima.
      Punto 2 del checkpoint anterior (logo oficial en las plantillas) sigue
      pendiente, sin cambios.
      Trabajo en rama `feature/contracts-w9-engine-integration` (misma rama,
      reutilizada tras el merge — commits nuevos siguen ahí, sin PR nuevo
      abierto todavía).
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
- [x] Constitución de Autoridad e Identidad M1–M5 (PR #241, fusionado)
      — 2026-08-23 (Hilo Maestro): 5 migraciones auditadas y fusionadas juntas
      como bloque único por su cadena de dependencia real — M1
      (`mdj_profile_id_inmutable`) → M2 (`audit_log` + `mdj_profile_de_usuario`,
      la función que resuelve identidad de perfil desde `auth.uid()`) → M3
      (`permission_grants`) → M4 (auditoría de dispositivos) → M5
      (`fenix_puede()`, autoridad única). Única dependencia externa,
      verificada por `git grep`: `fenix_can()`, ya sellado en PRUEBA+PROD
      desde el 17-ago (cimentación 2A). Las 5 migraciones estaban sin
      trackear en git desde el inicio de la sesión — se aislaron y
      commitearon limpias, sin arrastrar nada más. Cabecera de entorno:
      **PRUEBA** en las 5 — aplicarlas en producción sigue pendiente de
      autorización expresa del PO.
- [x] Libro de Operaciones — Fase 1 (esquema) + Fase 4 (reconciliación EBO)
      + RPC `get_my_cashflow_ledger` (PR #242, fusionado)
      — 2026-08-23 (Hilo Maestro): versión limpia de lo que traía el PR #240
      (cerrado, ver bitácora). Fase 1: tabla `libro_operaciones` (mismo
      candado RLS+cero-políticas que `platform_incidents`), única entrada
      `libro_operaciones_reportar()`, única salida la vista
      `libro_operaciones_staff`. Fase 4: columna `event_builder_order_id`
      (nullable), `libro_operaciones_reportar()` reemplazada para validar
      que la orden enlazada pertenezca a quien reporta, vista
      `libro_operaciones_reconciliacion_staff` (contrasta autorreporte vs.
      total oficial, sin corregir ni borrar nada). RPC
      `get_my_cashflow_ledger(p_since)`: única fuente de monto es
      `dj_ledger` (ya liberado al artista); `event_builder_orders`/`leads`
      solo aportan `event_label`; nunca expone `total_usd`/
      `amount_paid_usd` (margen de la empresa). Dependencia real
      (`mdj_profile_de_usuario`, de M2) resuelta al fusionar el PR #241
      justo antes. Cabecera de entorno: **PRUEBA** en las 3 migraciones.

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
- [2026-08-23] Dominio #5 ejecutó el sprint de cabecera remitido arriba: `.header-top` desbordaba en banda portátil 1001-1439px (buscador cortado, wordmark inalcanzable fuera del viewport) — cerrado con scroll contenido + aire de margen del logo, sin tocar slots fijos ni el carrusel de `#mainNav`. Mismo PR sumó el fix de la card "Create Your Account" del Hero de `index.html` (recortaba el botón REGISTER en altura reducida — 13"/split-view). Verificado en vivo antes de commitear (Regla 7), aprobado por el PO, fusionado en `main` (PR #237).
- [2026-08-23] Modal de reporte de incidentes fusionado (PR #238, dominio #5) — consume `platform_incidents_reportar()` (núcleo de arriba). Botón + modal montados en `initStaff()` de `staff.html`, visibles para cualquier rol de staff, ocultos para no-staff por el candado ya existente de la página. `dominio`/`severidad` quedaron como texto libre (con sugerencias, no `<select>` fijo) porque el propio SQL deja ese catálogo pendiente del Capitán. Sin credenciales reales de staff en la sesión de build, no se pudo verificar el flujo autenticado completo (abrir → enviar → fila nueva) — quedó marcado explícitamente en el PR; el PO lo fusionó tras su propia revisión.
- [2026-08-23] **PR #240 cerrado sin fusionar.** El PO reportó inicialmente que ya estaba integrado a `main`; verificado de forma independiente (`gh pr view`) que seguía `OPEN`. Auditoría posterior encontró que la rama de origen estaba contaminada — 14 archivos, incluyendo `CLAUDE.md` y este mismo `ESTADO_MAESTRO.md` en versión vieja, que se habrían arrastrado a `main` de fusionarse tal cual. Se aisló lo real (2 migraciones nuevas de Libro de Operaciones) sobre `origin/main` limpio; en el camino se descubrió que dependían de `mdj_profile_de_usuario()`, una función que solo existía en 5 archivos M1-M5 sin trackear localmente — bloqueando el aislamiento hasta resolver esa cadena (ver M1-M5 arriba).
- [2026-08-23] M1–M5 (Constitución de Autoridad e Identidad) auditados, aislados en rama propia y fusionados (PR #241, ver arriba) — desbloquea la dependencia que detenía el aislamiento limpio del Libro de Operaciones.
- [2026-08-23] Motor de Contratos y W-9 completado (ver arriba): el W-9 se rehizo como visor del PDF real (nunca una réplica en HTML) con dropzone de subida firmada, "Legal" se movió del top-nav (rompía el header) al sidebar de Staff, y se corrigieron dos bugs reales de producción — la firma de parámetros de `guardar_contrato_firmado` y el `CHECK` de `contract_type` que bloqueaba el guardado de los 5 templates. PR abierto en `feature/contracts-w9-engine-integration`, pendiente de aprobación del PO.
- [2026-08-23] Libro de Operaciones Fase 1 + Fase 4 + RPC `get_my_cashflow_ledger` re-aislados sobre `origin/main` (ya con M1-M5 integrado) y fusionados como PR #242 (ver arriba) — versión limpia que reemplaza al PR #240, cerrado con nota explicando el reemplazo.
- [2026-08-24] **Bóveda Legal / W-9 + doble custodia — commit nuevo en `feature/contracts-w9-engine-integration`, PR aún sin abrir.** Sobre lo ya fusionado en PR #244 (23-ago), sesión larga de pulido + reingeniería real del W-9 + arquitectura de "doble custodia" (contratos visibles también en el panel personal del cliente/artista):
  - **Visor del W-9**: pasó por 3 arquitecturas el mismo día — réplica HTML (rechazada, ley "nunca recrear el W-9") → visor custom `pdf.js` (canvas + miniaturas + overlay de los 23 campos reales del AcroForm, funcionando, abandonado por decisión propia del PO, quería el motor nativo del navegador) → **arquitectura final: `<object>`/`<iframe>` nativo sobre `web/assets/docs/fw9.pdf`** (copia real, verificada byte a byte — SHA-256 `2d420cbb...` — contra el original del PO). `pdf.js`/`pdf-lib` y ~190KB de base64 muerto, removidos. Panel izquierdo purgado de 8 campos que nunca se guardaban (vestigios de arquitecturas descartadas) — estructura final: Descargar → Dropzone (SHA-256) → "Nombre Legal / Razón Social" → Guardar.
  - **Flujo de envío/recepción cableado end-to-end para W-9**: Staff genera enlace (nombre + contacto, sin canvas de firma — no aplica al W-9); el Firmante ve un panel gemelo del de Staff (descargar → subir → nombre → enviar); al completarse pasa a un estado local nuevo, `COMPLETADO_EXTERNO` (solo UI, no toca la DB — el `status` real de `signed_contracts` lo pone la función siempre en `SIGNED`). Bug corregido en el camino: el sello de auditoría solo reconocía `status==='SIGNED'` literal.
  - **Doble custodia (contratos visibles desde la cuenta del propio cliente/artista)**: forense completo de `signed_contracts` (16 columnas, vía `pg_get_functiondef` de `guardar_contrato_firmado`) — decisión final **sin `ALTER TABLE`**: se cruza por `artist_profile_id`→`dj_profiles.user_id` (artistas) o `signer_email`→`auth.users.email` (todos los demás, insensible a mayúsculas), ambas columnas YA existían. Dos funciones RPC nuevas y aditivas, creadas en producción: `obtener_mis_contratos()` (lista liviana) y `obtener_mi_contrato_detalle(p_id)` (con el archivo) — mismo patrón de seguridad que `get_my_cashflow_ledger`: `SECURITY DEFINER`, nunca reciben un usuario como parámetro, siempre `auth.uid()`/`auth.email()` de quien llama. Sección nueva "Documentos Legales" en `web/account-settings.html` (mismo patrón `acct-side-link`/`showPanel` que las otras 11 secciones) consume `obtener_mis_contratos()`; el botón "Descargar Copia Oficial" abre `contracts-engine.html?view_record=<id>`, que reutiliza `openRecordView()` sin duplicar nada del visor. **Probado end-to-end con un registro real** (W-9 firmado y asociado a `miamidjbeat@gmail.com`, `id` real en producción `7439d9a3-0d01-43ef-a78e-31932455d8b3`) — apareció en Bóveda Legal (Staff) y en Documentos Legales (cuenta del cliente); se encontró y corrigió un bug real en el camino (`contract_type` llega de la DB en mayúsculas — `"W9"` — pero `TEMPLATES` usa minúsculas — `"w9"` — sin el mapeo inverso `openRecordView()` truena).
  - **Pendiente para la próxima sesión (ver entrada siguiente para el cierre)**: integración de badges de compliance (Contrato/W-9) en el Directorio Global CRM de `staff.html` (`#sc2-crm`) — ticket ya registrado por el PO, cruzando por los mismos campos (`artist_profile_id`/`signer_email`), sin tocar la DB. También sigue sin resolverse la píldora nativa "Bóveda Legal" que a veces se ve flotando sobre el visor (se descartaron todos los `title=` como causa; sin una captura con la posición exacta del cursor no hay más pistas que seguir — **sigue sin resolverse**).
- [2026-08-24] **Segunda mitad de la misma sesión — APROBADA por el PO, lista para commit.** Continúa sobre la entrada anterior (mismo día, misma rama `feature/contracts-w9-engine-integration`, aún sin PR abierto):
  - **Badges de compliance en las 10 tablas del Directorio Global CRM** (`web/staff-admin.html`, `loadCRM()`/`renderCRM()`): cierra el pendiente de la entrada anterior. Cada contacto muestra 2 pastillas (Contrato + W-9) — verde con enlace real si ya existe el registro (`?view_record=<id>`), gris/naranja y clicable si falta (`?open_send=<template>&name=&contact=`, prellenado). Verificado en vivo dentro del contenedor real.
  - **Búsqueda real de personas** reemplaza el selector de perfiles simulados en `contracts-engine.html`: busca en `dj_profiles`+`client_profiles` en vivo (nombre/email/uuid exacto), Enter autorrellena el primer resultado. `MOCK_PROFILES` se queda solo para el botón demo "Simular Elixis", ya no para el flujo real.
  - **Patrón "?" en círculo** generalizado a TODAS las notas fijas del archivo (búsqueda, envíos, Elixis, bandeja, firma, W-9 del firmante, descripción de plantilla) — un solo manejador delegado, cero espacio de trabajo perdido. Deliberadamente sin convertir: notas dentro de modales y el paso estructural "Paso 2" del W-9.
  - **Catálogo de contratos especializados** (antes: todo lo que no era dj/venue/w9 cargaba en "staff", genérico): 4 plantillas nuevas — `live_band` (stage plot/input list/soundcheck), `solo_artist` (pistas/playback, microfonía), `subcontractor_show` (B2B, seguro COI obligatorio, cláusula Hold Harmless — Hora Loca/zanqueros/MCs), `private_event` (bodas/15s, depósito, horas extra, cláusula climática). `venue` ganó 3 campos aditivos (load-in/out, límite de dB, tomas eléctricas) sin tocar su contenido de residencia existente. `corporate` y `staff` se conservaron intactos (no en el catálogo nuevo, pero sin borrar — contratos legacy siguen viéndose). Mapeo del CRM actualizado por categoría real (incluye nueva categoría "Solista", separada de "Músicos en Vivo").
  - **Cláusulas nuevas en `dj`**: exclusividad y no-negociación, no-circunvención y protección de plazas, conducta profesional/jurisdicción, requerimientos técnicos adicionales — texto exacto pedido por el PO.
  - **Selector de régimen de exclusividad** (Exclusivo / No-Exclusivo-Libre) en `dj`/`live_band`/`solo_artist`, con cláusula que cambia según la selección (default No-Exclusivo — nunca restringe por omisión). Se guarda solo dentro del `form_payload` existente, sin cambio de esquema.
  - **CHECK constraint de producción ampliado**: `signed_contracts.contract_type` solo aceptaba 5 valores — el PO corrió `supabase/scripts/ampliar_tipos_contrato_signed_contracts.sql` (aditivo, sin tocar registros existentes) para sumar los 4 nuevos (`LIVE_BAND_AGREEMENT`, `SOLO_ARTIST_AGREEMENT`, `SUBCONTRACTOR_SHOW_AGREEMENT`, `PRIVATE_EVENT_AGREEMENT`). Confirmado "Success. No rows returned" antes de dar el guardado real por funcional.
  - **Autocompletado real de venue** contra `public.financial_venues` (tabla real de producción, 3 filas confirmadas: El Valle Restaurante, Sundowner Key Largo, Mojitos Calle 8) — nombre+dirección+contacto se autorrellenan si existen; sin coincidencia, el campo sigue 100% manual. **Dato pendiente, no bug**: las 3 filas tienen `address`/`contact_*` en NULL — falta cargarlos para que ese autocompletado se vea completo. "Requerimientos técnicos por venue" pedido por el PO **no se construyó**: no existe columna para eso en `financial_venues`, y no se fabricó dato falso.
  - **Puente Elixir AI con confirmación humana (Voice-HITL)**, `applyElixirContractPayload()` + `postMessage({type:"mdjb:elixir-contract"})`: se detectó un despachador de Elixis previo (`ELIXIS_TEMPLATE_MAP`/`handleElixisDispatch`, sesión anterior) que auto-despachaba sin clic humano — choca con la ley ya establecida (`feedback_elixis_action_tools_hitl_pattern`, ver `enviar_sms`). El PO resolvió con un diseño intermedio, no binario: Elixir prepara y arma un resumen hablable ("He preparado el contrato de X para Y en Z por $M. ¿Confirmas el envío a W?"); el despacho real solo ocurre si el payload trae `user_confirmed:true` — eso solo debe llegar después de que una persona real confirmó por voz o botón (decisión del flujo conversacional de Elixir, no de este archivo). Candado de seguridad verificado en vivo: campos faltantes bloquean el despacho **aunque venga `user_confirmed:true`**. El despachador legado no se tocó — sistema nuevo y separado.
  - **Trazabilidad real del emisor**: `_meta.issuedBy`/`_meta.authorizedBy` dentro de `form_payload` (JSONB existente, sin `ALTER TABLE`). `resolveCurrentStaffIdentity()` replica el mismo patrón de `staff.html` (`auth.getSession()` → `dj_profiles` por `user_id` → rol+nombre) dentro del propio iframe de `contracts-engine.html`; verificado en vivo resolviendo el nombre real de la sesión (`"Gerardo A Valle (Owner)"`) sin que Elixir tuviera que pasarlo. Envío manual cae al mismo mecanismo; si no hay sesión resuelta, cae a "Staff Manual" — nunca bloquea.
  - **Bug de capas encontrado y corregido en vivo** (reportado por el PO con captura): el dropdown de búsqueda de personas y el de venue quedaban pintados DETRÁS del panel del formulario de abajo — ambos `.panel` usan `backdrop-filter` (contexto de apilamiento propio) y ninguno tenía `z-index` propio para ganarle al panel siguiente. Corregido elevando `#contextSimPanel`/`#fieldsPanel` (`position:relative;z-index`), verificado con `elementFromPoint()` en el punto exacto de solapamiento.
  - **Todo aprobado por el PO tras revisión visual real** (screenshots del recorrido + de la consola SQL de producción) — este commit es el primero de esta sub-sesión, con autorización explícita ("APROBADO: COMMIT Y FINALIZACIÓN DE EMISOR DE SESIÓN").
  - **Siguiente paso ya anunciado por el PO**: vincular acceso/descarga del contrato de responsabilidades dentro de la Cabina de DJ / Perfil de Artista — no arrancado todavía.
- [2026-08-24] **Bóveda Legal en la Cabina DJ (`web/dj-profile.html`) — commit nuevo, aprobado y aplicado sobre la misma rama.** Continúa el paso anunciado arriba:
  - **Hallazgo real: ya existía una pestaña "Mis Documentos" (`#tab-documentos`) desde el commit original del motor de contratos (73f6c6c, 23-ago) — y estaba mal.** Incrustaba `contracts-engine.html` completo en un iframe: el motor de STAFF (buscador de personas, generador de envíos, CRM), no una vista personal del artista. Reemplazado por una lista real (misma RPC `obtener_mis_contratos()`, mismo patrón que `account-settings.html#legal`, sin duplicar lógica): tipo, fecha, badge verde FIRMADO + botón Descargar; sin registros, mensaje de "Pendiente" honesto (sin botón de "completar" falso — el artista no puede autogenerarse un enlace de firma desde su propia vista). Slot renombrado "Mis Documentos" → "Bóveda Legal" en `MDJ_NAV_SLOTS_ARTISTA` (`mdjb-shared-header.js`) — solo texto, cero riesgo de layout.
  - **Widget de compliance compacto** en la tarjeta "Economía · SoundForTips" del sidebar (zona ya owner-only, `isOwner && !isPublicQrView`): 2 badges (Contrato/W-9) + enlace a `account-settings.html#legal` (se agregó `legal` al whitelist de hashes deep-link, antes no abría nada).
  - **Carrusel continuo de especialidades**: `#pub-role-label` ahora pinta el texto DOS veces en una pista (`.dj-hero-role-track`) animada con `@keyframes` (16s, loop infinito, pausa al hover/tap), máscara de desvanecido en los bordes; respeta `prefers-reduced-motion` (cae al scroll manual). Verificado en vivo con datos reales inyectados — el perfil de prueba (djmago305) no tiene `artist_specialty`/`roles`/`city` cargados, así que en su estado real no hay nada que animar (no es un bug, es un hueco de datos).
  - **Avatar más pequeño en portrait móvil**: `.dj-hero-inset` 112px→84px solo bajo `@media (orientation: portrait)` anidado dentro del breakpoint ya existente de ≤900px — landscape y escritorio confirmados sin cambio (112px).
  - **Ítem cancelado a propósito, invocando la propia condición de seguridad del PO** ("si algo rompe cualquier configuración... se cancela este cambio"): NO se agregó "Fénix AI" como slot nuevo del artista ni un segundo slot separado de "Bóveda Legal". `MDJ_NAV_SLOTS_ARTISTA` alimenta AL MISMO TIEMPO el `#mainNav` de escritorio Y (indirectamente) el panel móvil — el historial de este nav documenta desbordes reales de la barra por exceso de ítems (banda 1001-1439px, PR #237), y no hay forma de verificarlo sin una sesión real de DJ. Primer intento (parchar el HTML estático del menú hamburguesa) resultó ser trabajo muerto: se descubrió que `mdjb-shared-header.js` reconstruye el panel móvil en tiempo real leyendo `#mainNav` — revertido limpio, cero rastro.
  - **Aprobado por el PO** ("Los ajustes son totalmente acertados, especialmente el reemplazo del iframe de Staff") con mensaje de commit explícito.
- [2026-08-24] **CIERRE DE SESIÓN — checklist de entrega para el despliegue a producción.** Rama `feature/contracts-w9-engine-integration`, remoto `origin` sincronizado (`git rev-list` 0/0, push confirmado). **PR todavía sin abrir** — sigue pendiente por Regla 1 (cero PRs automáticos) hasta que el PO lo pida explícitamente.
  - **Comiteado y empujado (7 commits desde el merge de PR #244):**
    1. `4401acf` — W-9 con visor nativo real + doble custodia de contratos.
    2. `81664aa` — Catálogo de contratos especializados (live_band/solo_artist/subcontractor_show/private_event), selector de exclusividad, autocompletado de venue (`financial_venues`), puente Elixir Voice-HITL, badges de compliance en las 10 tablas del CRM.
    3. `b605c14` — Reemplazo del iframe de Staff en la Bóveda Legal del perfil de DJ por una vista propia del artista, widget de compliance, carrusel de especialidades, escalado de avatar en portrait, rename "Mis Documentos"→"Bóveda Legal".
  - **Migraciones de producción ya corridas por el PO (confirmadas "Success"):** ampliación del `CHECK` de `signed_contracts.contract_type` (9 valores) y las 2 RPCs de doble custodia (`obtener_mis_contratos`/`obtener_mi_contrato_detalle`) — ver commits 1-2 arriba.
  - **Pendiente, NO bloqueante para desplegar, pero anotado:**
    - Datos: `financial_venues` tiene 3 filas reales sin `address`/`contact_*` — cargarlos para que el autocompletado de venue se vea completo.
    - Verificación con sesión real de DJ: el widget de compliance, "Bóveda Legal" en la Cabina DJ, y el menú móvil (ítem cancelado por seguridad, ver arriba) — nadie los ha visto todavía con una cuenta de artista real logueada; toda la verificación de este bloque se hizo con datos reales pero sesión de invitado o de owner, nunca de DJ.
    - "Fénix AI" para artistas: decisión de producto pendiente del PO (ver arriba, item cancelado).
  - **Árbol de trabajo:** limpio para todo lo de esta sesión (contratos/W-9/perfil de DJ). Quedan sin trackear 6 elementos ajenos (`.claude/`, `MiamiDJBeat-MigracionV2/`, `docs/constitucion-plan-produccion-m1-m5.md`, 5 scripts `constitucion_*.sql`) — con fecha 16-23 de agosto, de OTRO hilo (dominio Constitución/migraciones), presentes desde antes de que esta sesión empezara. No se tocaron: protocolo de colisión entre sesiones paralelas prohíbe tocar trabajo ajeno sin confirmación explícita del PO.
- [2026-08-29] **CIERRE DE SESIÓN — ELIXIS Core & UI, workspace nativo de `staff.html` (panel FÉNIX AI).** Rama `fix/mobile-ui-cleanup` (worktree compartido con el hilo de avatar/voz), **todo sin comitear** — el PO pidió explícitamente no comitear todavía ("todavía no"). Nada de esto se ha empujado a `origin` ni tocado en producción; todo verificado en local (`localhost:8124`).
  - **Acordeón de escritorio (3 paneles: Modo Enfoque / Avatar / Hilos)**: reescrito de CSS Grid a posicionamiento absoluto independiente — el centro (avatar) queda fijo al 50% del ancho SIEMPRE, los laterales son overlays propios que topan justo en su borde sin invadirlo ni desplazarlo (directiva explícita del PO: "el avatar siempre es protagonista"). Encontrado y corregido un bug real de especificidad CSS en el camino (`.ew-col{position:relative}` empataba con `.ew-pantalla{position:absolute}` y ganaba por orden de archivo — resuelto subiendo especificidad, no reordenando).
  - **Simulador energético HUD** (`web/js/elixis-hud-transmision.js`, nuevo): sobre/carga/haz/receptor en SVG+CSS keyframes + canvas para la rejilla de fondo, conectado a `onTranscript`/`onTool` reales. Honesto: hoy `onTool` es el mejor proxy disponible de "orden lanzada" porque `elixis-realtime-session` todavía no tiene una tool real de envío.
  - **Barra de escritura flotante + `enviarTexto()`** en `elixis-voice-session.js` (mezcla texto/voz real de la Realtime API). **Bug de seguridad real encontrado y corregido**: escribir texto sin sesión activa disparaba `getUserMedia()` por primera vez en la pestaña — causó un corte real de audio en Serato con el PO tocando en vivo. Revertido: ya no arranca la sesión sola, exige voz activa primero y avisa visiblemente en la propia barra si no la hay.
  - **Bug de caché real encontrado**: `elixis-voice-session.js` se servía con un `?v=` desactualizado desde antes de esta sesión — el navegador corría JS viejo sin `enviarTexto()` durante varias pruebas. Corregido.
  - **Avatar de DJMago con chroma key real conectado** (mismo mecanismo de `mdj-commander.html`: `avatar-heygen-chromakey.js` + canvas, video oculto por `visibility` no `display`). Video correcto identificado y usado: `djmago-idle-boomerang.mp4`. Carpeta renombrada `web/assets/Elixis IA/` → `web/assets/DJMago IA/` (el contenido real es DJMago, no ELIXIS — nombrado corregido en 3 archivos: `staff.html`, `mdj-commander.html`, `.gitignore`). 2 videos de prueba descartados eliminados del disco (confirmados sin referencia en código activo antes de borrar).
  - **Sistema de visemas de boca eliminado por completo** (`avatar-viseme-sprites.js`, `MDB_AVATAR_VISEMES`): los `elixis-boca-*.webp` resultaron ser fotos completas de DJMago con fondo BLANCO sólido, no recortes de boca transparentes — tapaban el video con chroma key cada vez que había audio real ("qué horror", reporte en vivo del PO). No es un ajuste posible, el tipo de asset es el equivocado.
  - **Avatar agrandado**: caja de 230×220px fija → 420×745px con `flex:1`, llenando el alto real disponible. El anclaje al fondo del canvas (ya existente en `avatar-heygen-chromakey.js`) revela más torso solo por tener más alto real, sin tocar el zoom.
  - **Foto rota eliminada**: `elixis-avatar.webp` nunca existió en Supabase Storage (confirmado por SQL) — el `<img>` se quitó por completo. Aclarado con el PO: ELIXIS nunca fue una foto, es el streaming en vivo de HeyGen — pendiente de construir (ver abajo).
  - **Aviso de seguridad de Supabase resuelto**: política RLS `"Public read avatars"` en `storage.objects` (`qual:true`, sin filtro de bucket) daba listado público sobre TODOS los buckets, no solo `assets` — el PO la eliminó desde el dashboard; la política específica de `avatars` (`bucket_id='avatars'`) sigue intacta, sin afectar avatares reales.
  - **Pendiente, no bloqueante — Prioridad 3 (sistema de 2 avatares real)**: `HEYGEN_API_KEY` según el PO ya está configurada (no verificable por SQL desde este hilo). Dato de arquitectura nuevo, importante: la VOZ de OpenAI Realtime se fija solo al conectar (URL inicial) — cambiar de persona a mitad de llamada cambia las instrucciones (`session.update`, ya soporta esto) pero NO el timbre de voz sin reiniciar la conexión. Nombrado interno de todo el workspace (`elixis-voice-session.js`, `view-elixis`, variables `ew*`) sigue asumiendo "ELIXIS por defecto, DJMago invitado" — decisión de producto pendiente del PO, no resuelta.
  - **Pendiente — Prioridad 1/2**: confirmación del PO de que el "avatar nervioso" no vuelve a aparecer (se sospecha caché, no código); prueba real de audio bidireccional + CPU móvil durante chroma key; subir `djmago-idle-boomerang.mp4` a Supabase Storage (bucket `assets`) para que cargue fuera de este entorno local.
  - **Sin commitear a propósito** — el PO pidió explícitamente esperar. Próxima sesión continúa desde aquí con otros tickets.
- [2026-08-30] **Music Hunter (identidad ELIXIS/DjMago + ACRCloud) — 4 commits en `fix/mobile-ui-cleanup`, comiteado local, sin push. Deploy de Edge Functions ya corrido por el PO manualmente y verificado en vivo.**
  - **Fork de identidad server-side** (`elixis-realtime-session/index.ts`): `?identidad=elixis|djmago` (whitelist, default `elixis`, no rompe sesiones existentes). Hasta este cambio las dos caras del avatar (ELIXIS/HeyGen vs DjMago/chroma-key) hablaban con el MISMO prompt fijo "Eres ELIXIS" — la separación de especialistas no existía más allá del video. Ahora hay dos bloques reales de prompt (ELIXIS=operaciones/legal/agenda/ventas, DjMago=música/producción/eventos/setlists); memoria, límites de ejecución y honestidad siguen compartidos a propósito (política de sistema, no de personalidad).
  - **Edge Function nueva `music-fingerprint`**: recibe PCM float32 + sample rate (mismo formato que expone el ring buffer), arma WAV 16-bit real, firma HMAC-SHA1 y llama a ACRCloud. BPM/tonalidad quedan `null` a propósito — la identificación básica de ACRCloud no los da, e inventarlos violaría la regla de "nunca inventes datos" del prompt de DjMago. `isrc` sí se puebla cuando ACRCloud lo trae.
  - **Ring buffer de audio** (`web/js/music-hunter-ring-buffer.js`, nuevo): AudioWorklet real (no ScriptProcessorNode) de 6s circulares, conectado al MISMO stream de mic que ya usa la conversación — cero permisos nuevos.
  - **Cazador Musical completo en `staff.html`**: modo nuevo en el panel izquierdo (fija identidad DjMago + `vad=estricto` para la próxima sesión), Modo A "bajo demanda" (tool-calling real) y Modo B "continuo" (ciclo de 18s que llama `identificar_track` DIRECTO, sin pasar por el modelo de voz, para no interrumpir la cabina con anuncios no pedidos — anti-duplicado por isrc/artista+título). Tabla "Live Setlist" nueva en el panel derecho.
  - **Verificado en vivo contra el backend YA desplegado** (no solo localmente): llamada autenticada real a `elixis-realtime-session?action=identificar_track` con 0.3s de silencio → `acrcloud_fallo` (esperado, sin señal real que fingerprintear); la MISMA llamada con 3s de tono real de 440Hz → `ok:true, mock:false, artist:"Sahil Hansda", title:"Cascading Hues Waltz", confidence:0.28` — prueba definitiva de que la firma HMAC, las credenciales de ACRCloud y la cadena completa (cliente→elixis-realtime-session→music-fingerprint→ACRCloud→de vuelta) funcionan de verdad en producción, no solo en teoría.
  - **Nota real de deploy**: el primer `supabase functions deploy elixis-realtime-session` del PO salió con `verify_jwt:true` (default del CLI sin `--no-verify-jwt`, distinto del `false` que tenía antes) — verificado que no rompe nada porque el cliente ya manda un JWT/anon-key válido en cada llamada; queda anotado por si alguien lo nota raro comparando con el historial de la función.
  - **Pendiente, no autorizado todavía**: exportar/persistir el Live Setlist a base de datos (hoy vive solo en DOM, se pierde al recargar) — tabla `live_setlist_tracks` sigue como propuesta sin aplicar. Nadie ha probado el flujo con un mic real ni con Serato sonando de verdad en la sala (el entorno de build no tiene micrófono) — falta esa confirmación en vivo del PO.
- [2026-08-30] **BACKLOG (no bloqueante) — TICKET-UI-04**: eliminar el flash de pantalla blanca (FOUC) en la carga inicial aplicando un `background` oscuro inline en el HTML base. Pospuesto explícitamente por el PO hasta después de cerrar Music Hunter — no arrancar sin señal suya.
- [2026-08-30] **Corrección en vivo — DjMago se ponía a narrar en inglés durante Cazador Musical (reportado con capturas reales).** Diagnóstico real, no el que asumía el ticket original: la narración NO vino del ciclo de fondo "Modo B" (`iniciarCazadorMusical()` en `elixis-voice-session.js`, re-verificado que nunca toca el DataChannel) — vino de Modo A real: el VAD normal (0.72 estricto) confundió letras/voces de la música de fondo con el DJ hablándole al avatar, el modelo pensó que le habían preguntado, llamó `identificar_track` por su cuenta y narró el resultado en inglés. Corrección (commit `fe9a248`, ya redesplegado y confirmado por el PO — versión 33 verificada byte a byte contra el archivo local):
  - Umbral de VAD forzado a 0.85 SIEMPRE que `identidad==='djmago'` (no depende de que el cliente mande `?vad=estricto`).
  - Regla dura de silencio movida al bloque de IDENTIDAD de DjMago (no al "modo de enfoque", que este mismo archivo documenta como sugerencia débil, "no una jaula" — ahí es donde vivía la instrucción que se ignoró la primera vez).
  - `audio.input.transcription:{language:'es'}` agregado para djmago como pista de transcripción — best-effort, no se pudo confirmar el nombre exacto del campo contra la documentación oficial de OpenAI (bloqueada por su propio WAF al intentar verificarlo).
  - **No se pudo completar una prueba de negociación de sesión real contra OpenAI** (SDP completo) porque el entorno de build bloquea salidas `fetch` con `Content-Type: application/sdp`/`text/plain` (confirmado: la misma llamada con `application/json` sí llega al servidor y responde real) — limitación del entorno de prueba, no del código. Si OpenAI llegara a rechazar la configuración nueva, `elixis-voice-session.js` ya tiene manejo de error existente (`onError` limpio, no rompe la página) — falta que el PO confirme con una sesión de voz real que DjMago se queda callado durante el muestreo pasivo y responde solo en español.
- [2026-08-30] **Nota de arquitectura — portabilidad a app móvil nativa (futuro, sin ticket activo todavía).** El fork de identidad (`elixis-realtime-session`) y `music-fingerprint` son agnósticos de plataforma: ambos son Edge Functions HTTP puras, sin nada específico de navegador. Lo que SÍ es específico de web es el capturador de audio continuo (`web/js/music-hunter-ring-buffer.js`, AudioWorklet) — se está aislando primero en `staff.html` a propósito, como entorno de pruebas. Portarlo a una futura app nativa (iOS/Android) requerirá un módulo de captura de audio de fondo propio de cada sistema operativo (`AVAudioEngine`/background audio en iOS, `AudioRecord`/foreground service en Android — ninguno de los dos existe todavía, ni se ha empezado), pero ese módulo nativo consumiría la MISMA `music-fingerprint` sin cambios en el backend.
- [2026-08-30] **Mapa de arquitectura — "DJMago Core" ampliado (visión del PO, diagrama recibido, documentación pura, cero código nuevo salvo lo ya anotado abajo).** El PO mandó un diagrama mostrando `DJMago Core (Realtime API)` ramificando hacia 4 destinos. Estado real de cada uno, verificado contra lo que existe hoy en el repo:
  - **ACRCloud Engine → Identificación Acústica en Vivo**: CONSTRUIDO Y VERIFICADO EN VIVO (ver entradas de arriba, Music Hunter). Esta rama ya es real.
  - **Local Indexer / SQLite → Base de Datos Serato & Discos Duros**: NO EXISTE, ni un archivo. Esto sería leer la base de datos real de Serato (su carpeta `_Serato_` / crates) desde el disco del DJ — requiere acceso a archivos locales que un navegador no tiene por defecto (File System Access API con permiso explícito del usuario, o un helper nativo de escritorio). Arquitectura completamente distinta a todo lo construido hoy (que es 100% Edge Functions + navegador). Sin ticket todavía.
  - **Proyecto Fénix / Agentes → Curaduría, Legal, Distribución, Agenda**: esto es el sistema de identidad ELIXIS (ya construido hoy, no DjMago) — `buildInstructions()` en `elixis-realtime-session` ya cubre legal/agenda/correspondencia/ventas bajo identidad `elixis`. La pieza de "curaduría" (musical, presumiblemente vía DjMago) no tiene home claro todavía. La visión más amplia de "Proyecto Fénix" como ecosistema de agentes (SIF/AI Manager/EIA/EKG/TIE) sigue **pausada por directiva explícita del PO — no retomar sin su señal** (ver nota de arquitectura anterior en este mismo documento).
  - **Live Setlist Logger → Exportación M3U / Crates / Historial**: PARCIAL. El logger en sí (detección continua + tabla en `staff.html`) ya existe. Hoy mismo se agregó exportación a **.m3u** (formato estándar que Serato y la mayoría de software de DJ importan de verdad) — botón ".m3u" en el panel de Live Setlist, descarga client-side, sin tocar disco. NO se construyó el formato binario propio `.crate` de Serato (sería reingeniería de un formato propietario, pieza aparte) ni persistencia de "Historial" en base de datos (el setlist vive solo en memoria del navegador, se pierde al recargar — sigue como propuesta sin aplicar, ver la nota de `live_setlist_tracks` en la entrada original de Music Hunter).
- [2026-08-30] **DECISIÓN DE ARQUITECTURA (PO) — fuente de audio de Music Hunter.** Tras el reporte real de identificaciones incorrectas, se planteó la disyuntiva: mantener el micrófono ambiente (protege a Serato/CoreAudio, pero es una fuente de baja fidelidad para fingerprinting) vs. una fuente de audio más directa. **Decisión: se mantiene el micrófono ambiente** con el piso de confianza (0.50, commit `6f98f3f`) como mitigación — la integración profunda con Serato (leer metadatos/historial real desde el disco, la rama "Local Indexer/SQLite" del mapa de arquitectura de arriba) queda explícitamente para una **Fase 2**, sin ticket ni fecha todavía. No construir esa fase sin nueva señal del PO.
- [2026-08-30] **Redeploy confirmado y verificado — `elixis-realtime-session` v36** (commit `6f98f3f`, contenido idéntico verificado byte a byte): `create_response:false` para identidad djmago activo, piso de confianza 0.50 activo en el cliente. Pendiente: el PO va a correr la prueba en vivo de Cazador Musical con este redeploy — resultado todavía no reportado en este documento.
