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
      **Recomendación (Hilo Road Master Map):** `leads` = fuente de verdad de la
      reserva (la leen las 3 pantallas del dominio); `artist_agenda` = proyección
      derivada, no fuente — ya alimentada de forma idempotente por R9b; `dj_events`
      = retirar directo, sin paso previo de desconexión — ya no está conectada a
      ningún código de aplicación. Decisión final de SSOT pendiente del PO.

## 2. Bitácora de Sincronización entre Cajas
- [2026-08-22] Inicialización del Hub Central de sincronización multi-hilo.
- [2026-08-22] Matriz de Jurisdicciones (`docs/JURISDICCIONES.md`) registrada + regla 6 en `CLAUDE.md`. Rename de marca `mdj-shared-header.js` → `mdjb-shared-header.js` fusionado en 61 archivos activos (PR #213).
- [2026-08-22] Hilo Elixis Voice Agent Blueprint reportó memoria persistente instalada (ver arriba) y detectó `dj_memory_facts` documentada como tabla en `JURISDICCIONES.md` cuando es una vista — corregido por el Hilo Maestro en el mismo commit.
- [2026-08-22] Camino de escritura de la memoria confirmado con datos reales (escribir/recordar/olvidar) — hito de memoria persistente ELIXIS cerrado.
- [2026-08-22] Hilo Business Financial Intelligence entregó diagnóstico de Stripe Connect (ver arriba) — sin infraestructura, con conflicto de dos ledgers sin reconciliar. Esperando decisión del PO antes de abrir ticket de construcción.
- [2026-08-22] SSOT de balance/payouts resuelto: `financial_payables` gana, `dj_ledger` a deprecar progresivamente. Stripe Connect queda diferido a sprint dedicado; el hilo BFI queda en espera de esa fase o de la siguiente tarea en su dominio.
- [2026-08-22] Hilo Road Master Map / Calendario BI auditó el encargo de agenda: las tablas nombradas (`events`, `agenda_locks`, `dj_assignments`) no existen; las reales son `artist_agenda` (16-ago, R9a/R9b), `leads` y `dj_events` (legacy). Decisión de SSOT de agenda pendiente del PO (ver arriba).
- [2026-08-22] CORRECCIÓN: el hallazgo del write-path paralelo en `dj-dashboard.html` es del Hilo Maestro, no del hilo Road Master Map (atribución errónea en la entrada anterior). Ese hilo ya rebasó con autorización del PO y su reconciliación completa (`V11`, `V12`, `R14`…`R21`, `cap-estacion-nav`, `cap-avisos-push`) está dentro de `main` — la rama NO sigue aparcada. Queda un commit local sin subir (`c4e1398`, arregla 3 referencias muertas al rename del PR #213 en `docs/roadmap/master-map.json`).
- [2026-08-22] `dj_events` refinado a tabla sin ningún consumidor de código (ver arriba) y recomendación de SSOT de agenda entregada por el hilo Road Master Map: `leads` fuente de verdad, `artist_agenda` proyección derivada, `dj_events` a retirar.
