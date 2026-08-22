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

## 2. Bitácora de Sincronización entre Cajas
- [2026-08-22] Inicialización del Hub Central de sincronización multi-hilo.
- [2026-08-22] Matriz de Jurisdicciones (`docs/JURISDICCIONES.md`) registrada + regla 6 en `CLAUDE.md`. Rename de marca `mdj-shared-header.js` → `mdjb-shared-header.js` fusionado en 61 archivos activos (PR #213).
- [2026-08-22] Hilo Elixis Voice Agent Blueprint reportó memoria persistente instalada (ver arriba) y detectó `dj_memory_facts` documentada como tabla en `JURISDICCIONES.md` cuando es una vista — corregido por el Hilo Maestro en el mismo commit.
- [2026-08-22] Camino de escritura de la memoria confirmado con datos reales (escribir/recordar/olvidar) — hito de memoria persistente ELIXIS cerrado.
- [2026-08-22] Hilo Business Financial Intelligence entregó diagnóstico de Stripe Connect (ver arriba) — sin infraestructura, con conflicto de dos ledgers sin reconciliar. Esperando decisión del PO antes de abrir ticket de construcción.
- [2026-08-22] SSOT de balance/payouts resuelto: `financial_payables` gana, `dj_ledger` a deprecar progresivamente. Stripe Connect queda diferido a sprint dedicado; el hilo BFI queda en espera de esa fase o de la siguiente tarea en su dominio.
