# FINANCIAL / PAYMENTS V2 — Cycle Closure (Pasos 1–5)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/FINANCIAL-CYCLE-CLOSURE.md` |
| **Fase** | Dominio Finanzas & Pagos V2 — **Paso 6** (documentación + cierre de ciclo) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Tipo** | Auditoría documental — **sin SQL** · **sin commit** · **sin deploy** · **sin writers** |
| **Jerarquía** | Constitución + Protocolo PO · matriz [FINANCIAL-V1-V2-MAPPING-MATRIX.md](./FINANCIAL-V1-V2-MAPPING-MATRIX.md) · prerrequisitos [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) · [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) |
| **Suite consolidada (Vitest)** | **133/133 PASS** (Perfiles 55 + Agenda 38 + Finanzas 40) |
| **Typecheck** | `tsc --noEmit` exit 0 (lab) |
| **Portales** | `/client/` · `/artist/` · `/staff/` → HTTP **200** |

---

## 1. Veredicto

El ciclo de **Read Model de Finanzas & Pagos V2** (discovery → contratos → servicio → UI Financial Slice en tres portales) queda **cerrado en laboratorio** bajo gobernanza read-only.

| Criterio | Estado |
|----------|--------|
| Matriz DTO canónica (Paso 1) | ✅ |
| Types + FinancialService read-only (Paso 2) | ✅ |
| MOD-301 Financial — Staff Master Ledger UI (Paso 3) | ✅ |
| MOD-204 Financial — Artist Wallet & Earnings UI (Paso 4) | ✅ |
| MOD-103 Financial — Client Payment Receipts UI (Paso 5) | ✅ |
| Documentación + índices (Paso 6) | ✅ (este documento) |
| Writers / SQL / RLS / commit / deploy | ❌ Fuera de alcance (prohibido) |
| OFTL `shared/services/finance/` | ✅ **Intacto** (north-star paralelo; no mezclado) |

---

## 2. Arquitectura Read Model (resumen)

```text
public.leads (balance_paid · payment_status)
public.dj_ledger (wallet releases)
mdj_staff_manual_invoices (link opcional)
        │
        ├─ map → PaymentReceiptReadDTO     ──► comprobantes / recibos
        ├─ map → TransactionHistoryDTO     ──► historial (CFMovement-style)
        └─ map → FinancialBalanceReadDTO   ──► saldos agregados por rol
                    │
                    ├─ fetchMasterFinancialLedger ──► staff/finance/   (MOD-301 FIN)
                    ├─ fetchArtistWalletBalance   ──► artist/finance/  (MOD-204 FIN)
                    └─ fetchOwnPaymentReceipts    ──► client/finance/  (MOD-103 FIN)
```

### 2.1 DTOs canónicos

| DTO | Origen V1 (proyección) | Consumo lab | Notas |
|-----|------------------------|-------------|-------|
| **PaymentReceiptReadDTO** | `leads` money fields (+ invoice link) | Client receipts · Staff ledger | IDs sintéticos `lead-pay:{id}` (G1) |
| **TransactionHistoryDTO** | Lead cobro deltas + `dj_ledger` rows | Staff · Artist · Client history | Ortogonal a OFTL writers |
| **FinancialBalanceReadDTO** | Aggregates by audience | Wallet card · master totals · client due/paid | **Nunca** mezcla `balance_paid` cliente con wallet DJ sin release |

**Estados canónicos:** `Pending` · `Verified` · `Rejected` · `Refunded` · `Completed`  
**Métodos (read):** `Zelle` · `Cash` · `BankTransfer` · `StripeCard` · `Check` · `Unknown` · `Other`

**Regla producto:** cobro cliente (`leads.balance_paid`) ≠ earning DJ (`dj_ledger` tras `staff_release_event_dj_payout`).

**Barrel / spec lab:** `MiamiDJBeat-MigracionV2/shared/services/financial/` · `FINANCIAL-SPEC.md` · types `shared/types/financial.types.ts`  
**≠ OFTL:** `shared/services/finance/` (OwnerFinancialTransaction contracts) — frontera documentada; no tocada en este ciclo.

### 2.2 Servicio (Paso 2) — solo lectura

| Método | Audiencia |
|--------|-----------|
| `fetchOwnPaymentReceipts({ clientUserId })` | Cliente — recibos + txs + balance due/paid |
| `fetchArtistWalletBalance({ artistUserId })` | Artista — wallet + pending release + ledger txs |
| `fetchMasterFinancialLedger({ audience })` | Staff — libro maestro (+ redact seller) |

**Prohibido:** charge · record payment · approve · refund · release payout · insert/update/delete.

### 2.3 Gaps heredados (no “cerrados” por magia)

Documentados en la matriz §8 — siguen abiertos a ticket futuro: receipts/cf_movements virtuales (G1), sin `payment_method` en leads (G2), Cash/Wire/ACH sin RPC (G3), cobro≠wallet (G4), EBO vs leads (G5), refunds (G6), Rejected aspiracional (G7), OFTL bridge (G8).

---

## 3. Integración portales (`localhost:5173`)

| Portal | Módulo | Slot dashboard | Artefactos UI |
|--------|--------|----------------|---------------|
| **Staff** `/staff/` | MOD-301 Financial | `data-mdj-staff-section="master-finance"` | `staff/finance/*` |
| **Artist** `/artist/` | MOD-204 Financial | `data-mdj-artist-section="artist-wallet"` | `artist/finance/*` |
| **Client** `/client/` | MOD-103 Financial | `data-mdj-client-section="client-payments"` | `client/finance/*` |

Patrón común (paridad Perfiles/Agenda):

1. ViewModel puro (DTO → display)
2. Renderer DOM read-only (filtros display-only; cero forms / pay / refund / upload)
3. Mount sync (lab mock) + async opcional (`FinancialService`)
4. Spec Vitest dedicado

| Portal | Filtros UI |
|--------|------------|
| Staff master | Status: Pending…Completed · Method: Zelle/Stripe/… |
| Artist wallet | Pending · Completed · Released |
| Client receipts | Pending · Verified · Refunded · Completed |

---

## 4. Cobertura de pruebas (suite consolidada 133/133)

### 4.1 Ciclos prerrequisito (sellados)

| Ciclo | Tests | Cierre |
|-------|------:|--------|
| Perfiles V2 | 55 | [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) |
| Agenda / Bookings V2 | 38 | [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) |

### 4.2 Ciclo Finanzas — +40

| Bloque | Archivo(s) | Tests |
|--------|------------|------:|
| Paso 2 service | `tests/unit/financial.service.spec.ts` | 15 |
| Paso 3 staff finance UI | `tests/unit/staff-financial-read-view.spec.ts` | 9 |
| Paso 4 artist wallet UI | `tests/unit/artist-financial-read-view.spec.ts` | 8 |
| Paso 5 client receipts UI | `tests/unit/client-financial-read-view.spec.ts` | 8 |
| **Subtotal Finanzas** | | **40** |
| **Total consolidado** | | **133** |

Comando de verificación (lab):

```bash
cd MiamiDJBeat-MigracionV2
npx vitest run \
  tests/unit/profiles.spec.ts \
  tests/unit/profiles.service.spec.ts \
  tests/unit/profiles.identity-map.spec.ts \
  tests/unit/artist-profile-read-view.spec.ts \
  tests/unit/artist-dashboard-mvp.test.ts \
  tests/unit/artist-schedule-read-view.spec.ts \
  tests/unit/artist-financial-read-view.spec.ts \
  tests/unit/client-profile-read-view.spec.ts \
  tests/unit/client-dashboard-mvp.test.ts \
  tests/unit/client-bookings-read-view.spec.ts \
  tests/unit/client-financial-read-view.spec.ts \
  tests/unit/staff-identity-read-view.spec.ts \
  tests/unit/staff-dashboard-mvp.test.ts \
  tests/unit/staff-calendar-read-view.spec.ts \
  tests/unit/staff-financial-read-view.spec.ts \
  tests/unit/bookings.service.spec.ts \
  tests/unit/financial.service.spec.ts
npx tsc --noEmit
# curl localhost:5173/{client,artist,staff}/ → 200
```

---

## 5. Gobernanza respetada

| Barrera | Cumplimiento |
|---------|--------------|
| Read-only UI + service | ✅ |
| Cero DDL/DML / RLS | ✅ |
| Cero commit / push / deploy | ✅ (artefactos `M` / `??` locales) |
| V1 `web/` · Weather · OFTL `finance/` | ✅ Intactos |
| Ciclos Perfiles + Agenda sellados | ✅ |
| Portales cruzados no regresivos | ✅ `/client/` `/artist/` `/staff/` 200 |

---

## 6. Inventario de rutas clave

| Área | Ruta |
|------|------|
| Matriz discovery | `docs/V2/FINANCIAL-V1-V2-MAPPING-MATRIX.md` |
| Este cierre | `docs/V2/FINANCIAL-CYCLE-CLOSURE.md` |
| Spec servicio | `MiamiDJBeat-MigracionV2/shared/services/financial/FINANCIAL-SPEC.md` |
| Types | `…/shared/types/financial.types.ts` |
| Service / mappers / mocks | `…/financial.service.ts` · `financial.map-rows.ts` · `financial.mocks.ts` |
| Staff UI | `MiamiDJBeat-MigracionV2/staff/finance/` |
| Artist UI | `MiamiDJBeat-MigracionV2/artist/finance/` |
| Client UI | `MiamiDJBeat-MigracionV2/client/finance/` |
| OFTL (no tocado) | `MiamiDJBeat-MigracionV2/shared/services/finance/` |
| CFMovement V1 spec | `docs/architecture/CFMOVEMENT-READ-MAP-SPEC-V1.md` |

---

## 7. Fuera de alcance (post-ciclo)

Requieren **ticket + OK PO** explícito:

- Writers (registrar cobro offline, aprobar comprobante, refund, release payout, Mark as Paid)
- Persistencia `cf_movements` / `payment_receipts` / `order_ledger`
- Columna `payment_method` en leads + RPC cash/check/wire/ACH
- Mezclar o reescribir OFTL DC contracts
- Wiring productivo de `FinancialService` a sesión auth real
- Weather Engine / reabrir Perfiles o Agenda
- Commit / push / merge / deploy
- Cambio MODULE-CATALOG PLANIFICADO → PRODUCCIÓN (producto)

---

## 8. Hoja de ruta Pasos 1–6

| Paso | Entregable | Estado |
|------|------------|--------|
| 1 | Discovery matrix + types DTO | ✅ |
| 2 | FinancialService read-only + Vitest | ✅ 15 tests |
| 3 | MOD-301 Staff Master Ledger UI | ✅ +9 |
| 4 | MOD-204 Artist Wallet UI | ✅ +8 |
| 5 | MOD-103 Client Receipts UI | ✅ +8 |
| 6 | Documentación cierre | ✅ |

**Suite consolidada al cierre:** **133/133 PASS**.

---

*Paso 6 — cierre documental ciclo Finanzas & Pagos V2 — 2026-08-11 — documentation only — no commit*
