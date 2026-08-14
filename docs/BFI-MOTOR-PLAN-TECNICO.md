# Motor BFI — Plan Técnico
**Business Financial Intelligence · Miami DJ Beat LLC**

> **Estado:** BLUEPRINT. Este documento **no implementa nada** — es el plan para
> arrancar el motor cuando el Product Owner lo autorice. La maqueta declara
> `IMPLEMENTATION AUTHORIZED: NO`; esto respeta esa gobernanza.
> **Fecha:** 2026-08-14 · **Autor:** sesión Claude Code con el Capitán.

---

## 0. Dónde estamos hoy

| Pieza | Estado |
|---|---|
| **UI / Matrix** (maqueta `web/business-financial-intelligence.html`) | ✅ Lista — Corporate · Business Units · Artist, KPIs, Health Score, Proyección, Alertas. **Números quemados (demo).** |
| **Integración** en CASH FLOW del owner | ✅ Switch `PFS ⇄ Owner Financial IA`, día/noche, pantalla completa. Owner-only. |
| **Read-layer transaccional** (V2 `shared/services/financial/`) | 🟡 Contratos tipados + tests, pero **mocks, sin SQL, sin writers**. |
| **Cerebro corporativo** (BU, márgenes, health, fiscal) | 🔴 **No existe.** |
| **Persistencia financiera canónica** | ⛔ Validada **solo en local** (no en producción) → *el gate real*. |

---

## 1. Objetivo

Convertir la maqueta en un **motor real**: cada número trazado a un dato canónico,
con **3 audiencias aisladas** (Corporate / Business Units / Artist) y
**confidencialidad por parte** — el artista nunca ve lo corporativo ni lo de otros.

---

## 2. Contrato de datos (el corazón del plan)

Cada KPI de la maqueta debe tener: **fuente canónica → fórmula → quién lo ve → estado del dato hoy.**

| KPI (maqueta) | Fuente canónica | Fórmula | Visible para | Dato hoy |
|---|---|---|---|---|
| **Ingresos totales** | `ledger` (inflow) · `residency_schedule.venue_pay_usd` | Σ inflows del período | Owner/Staff | 🟡 Parcial (residency sí; ledger parcial) |
| **Margen neto** | ingresos − costos (`dj_pay_usd` + gastos) | (ingresos − costos) / ingresos | Owner | 🔴 Falta capa de costos |
| **Caja disponible** | `ledger` (inflow − outflow liquidado) | Σ neto liquidado | Owner | 🟡 Parcial |
| **Días de caja** | caja disponible / burn diario | caja / (gastos ÷ 30) | Owner | 🔴 Falta burn/gastos |
| **Health Score** | compuesto: liquidez, margen, morosidad, diversificación | modelo ponderado (a definir) | Owner | 🔴 Nuevo (definir modelo) |
| **Proyección de caja** | eventos agendados + recurrencias | forecast sobre agenda | Owner | 🟡 Parcial (agenda existe) |
| **Alertas** | reglas sobre lo anterior | motor de reglas | Owner | 🔴 Nuevo |
| **Wallet artista** | `residency_schedule_secure.dj_pay_usd` + `tips` | Σ dj_pay del artista + tips − retiros | **Solo ese artista** | ✅ RLS ya construido |

**Fuentes canónicas reales que existen hoy** (migraciones Supabase):
`residency_schedule` (`venue_pay_usd`, `dj_pay_usd` — con **vista segura + RLS ya hechos**),
`ledger`, `leads` (funnel/ingresos), `referral` (comisiones), `tips`, `invoice`, `payout`,
`dj_profiles` (`plan`/tier).

**Confidencialidad — reusar lo ya construido:**
- `residency_schedule_secure` (SECURITY DEFINER) + `is_staff(auth.uid())` → el artista
  nunca ve `venue_pay_usd` ni datos corporativos.
- La **Artist Matrix** es un subconjunto aislado: solo SUS pagos, tips y eventos.

---

## 3. Qué reusar de V2 (no reinventar)

Módulo `MiamiDJBeat-MigracionV2/shared/services/financial/` (877 líneas, read-only, tipado, con tests):

| Pieza | Acción | Detalle |
|---|---|---|
| **DTOs** `PaymentReceiptReadDTO`, `TransactionHistoryDTO`, `FinancialBalanceReadDTO` + enums (inflow/outflow/internal, kinds, audiences, counterparty roles) | ♻️ **Reusar tal cual** | Es el lenguaje del dominio — sólido y probado. |
| **Mappers** `financial.map-rows.ts` (356 líneas) | ♻️ **Reusar adaptando** | Hoy comen mocks; cablearlos a **Supabase real** (los 3 métodos abajo). |
| **Servicio** `financial.service.ts` — `fetchOwnPaymentReceipts` (cliente), `fetchArtistWalletBalance` (artista), `fetchMasterFinancialLedger` (staff) | ♻️ **Reusar adaptando** | Read-only. Reemplazar la fuente mock por queries reales. |
| **Tests** (client/artist/staff read-view + `financial.service.spec`) | ♻️ **Reusar** | Arnés de regresión al portar. |
| **Agregación corporativa** (BU, márgenes, health, proyección, fiscal) | 🆕 **Construir nuevo** | El read-layer da transacciones/saldos por rol; el cerebro corporativo es net-new **encima**. |

**Traducción:** V2 nos da la **capa transaccional** (qué ve cada quién de recibos/wallet/ledger).
El **cerebro corporativo** se construye sobre ella. No arrancamos de cero en todo.

---

## 4. Orden de las Business Units (por disponibilidad de datos)

Taxonomía (8): Production · Accounting · Venues · Academy · Equipment Rentals · Memberships · Marketing · Operations.
Ordenadas por *"¿ya hay datos?"* para dar valor rápido:

### Ola 1 — datos ya existen (arrancar aquí)
1. **Venues** — `residency_schedule.venue_pay_usd` por local. Ingresos por venue, con vista segura.
2. **Production / Events** — `leads` + `residency` (eventos, tickets, completados/pendientes).
3. **Academy** — matrículas de academia *(verificar que `academia` registre inscripciones).*

### Ola 2 — datos parciales (adaptar)
4. **Memberships** — tiers/`plan` en `dj_profiles` (PRO/ELITE) → ingresos recurrentes.
5. **Marketing** — `referral` + `tips` → ROI de canales.

### Ola 3 — requiere captura nueva
6. **Equipment Rentals** — no hay tabla; definir modelo de alquiler.
7. **Operations** — costos internos/nómina; definir fuente.
8. **Accounting** — consolidador fiscal (retención 5 años, declaración). Va **al final**:
   depende de que todo lo anterior alimente el ledger canónico en producción.

---

## 5. Arquitectura por capas

```
┌─ UI ─────────────────────────────────────────────┐
│ Maqueta Matrix (cablear KPIs; quitar banner DEMO) │
├─ Motor de agregación (NUEVO) ────────────────────┤
│ Funciones puras: read-layer → KPIs corp + health  │
│ + proyección + alertas. Testeable con fixtures.   │
├─ Read-layer (REUSAR V2) ─────────────────────────┤
│ DTOs + mappers cableados a Supabase real          │
├─ Datos (Supabase) ───────────────────────────────┤
│ Tablas canónicas + vistas SECURITY DEFINER + RLS  │
│ por parte (patrón residency_schedule_secure)      │
└──────────────────────────────────────────────────┘
```

---

## 6. Fases (con el gate real)

| Fase | Qué | Esfuerzo | Depende de |
|---|---|---|---|
| **0. Contrato de datos** | Validar la tabla del §2 con el PO | Chico | Este documento |
| **🔑 GATE** | Subir la **persistencia financiera canónica a PRODUCCIÓN** (hoy solo local-test) | — | Decisión + deploy |
| **1. Transaccional** | Portar el read-layer de V2 a Supabase real → primeros KPIs (Venues, wallet artista) | **2–4 sesiones** | Gate + escoger métricas |
| **2. Corporativo** | Motor de agregación + Business Units ola por ola | **Semanas** | Que cada BU tenga fuente |
| **3. Accounting / Fiscal** | Consolidación + inteligencia de impuestos | Proyecto propio | Fase 2 + ledger en prod |

**El cuello de botella no es la UI — es el GATE.** Hasta que la persistencia esté en
producción, el motor no tiene de dónde leer.

---

## 7. Confidencialidad (no negociable)

- **Artist Matrix = burbuja aislada:** solo sus pagos/tips/eventos; **nunca** márgenes
  corporativos, ingresos de otros artistas, ni el total del venue.
- Reusar `is_staff()` + vistas SECURITY DEFINER (patrón ya verificado en vivo).
- Owner ve todo; manager/vendedor según **permiso explícito** del owner.

---

## 8. Definición de "Hecho" por KPI

Un KPI está **DONE** cuando:
1. Trazado a una fuente canónica real (no mock, no quemado).
2. Fórmula documentada en este contrato.
3. Test con fixture que verifica el cálculo.
4. Respeta confidencialidad (RLS verificada por parte).
5. Cero números quemados en la UI.

---

## 9. Riesgos

- **Datos faltantes (Ola 3):** no inventar. Marcar "sin fuente" hasta capturarlos.
- **Gobernanza:** la maqueta dice `IMPLEMENTATION AUTHORIZED: NO`. Arrancar requiere
  **autorización explícita del PO + ticket** propio, con reconciliación arquitectónica.
- **Divergencia V1/V2:** V2 es un lab de migración temporal; se reusan sus *contratos*,
  pero el motor vive en el stack de producción (V1), no se "importa" el proyecto V2.
