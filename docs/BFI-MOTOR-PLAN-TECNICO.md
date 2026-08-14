# Motor BFI — Plan Técnico
**Business Financial Intelligence · Miami DJ Beat LLC**

> **Estado:** BLUEPRINT. No implementa nada — es el plan para arrancar cuando el PO lo
> autorice. La maqueta declara `IMPLEMENTATION AUTHORIZED: NO`.
> **Fecha:** 2026-08-14 · **Rev. 2** (tras analizar `MiamiDJBeat-V1-offline-payment`).

> **⚡ Cambio clave de la Rev. 2:** el motor transaccional/contable **NO se construye de
> cero** — ya existe, construido y probado, en el worktree `MiamiDJBeat-V1-offline-payment`
> (línea T009). Lo que falta es traerlo aquí, aplicar su persistencia, y ponerle encima
> el **cerebro corporativo** y la **capa de agente ELIXIS**.

---

## 0. Qué es el motor (no es solo tubería de datos)

El motor BFI es un **agente financiero inteligente** — un "profesor de matemáticas +
ciencias contables". Recibe **órdenes financieras**, las **filtra**, las **procesa con
inteligencia financiera** (cálculos, mediciones, contabilidad) y devuelve resultados.

**ELIXIS lo orquesta.** ELIXIS recibe la petición del usuario, la **clasifica por
filtración**, y las del sector financiero se las **delega a este agente** para que las
procese. Trabajan **en equipo** (multi-agente).

```
Usuario ─▶ ELIXIS (clasifica/filtra) ─▶ ¿es financiero? ─▶ Agente Financiero (motor)
                 ▲                                                    │
                 └──────────────── resultado ◀───────────────────────┘
```

---

## 1. Dónde estamos hoy (Rev. 2)

| Capa | Estado real |
|---|---|
| **UI / Matrix** (maqueta) | 🟢 Lista — con números quemados (demo). Ya integrada en CASH FLOW del owner (switch PFS ⇄ Owner Financial IA, día/noche, pantalla completa). |
| **Motor transaccional / contable** (ledger, pagos, allocations, reconciliación, accounting runtime) | 🟢 **Construido + probado** — `mdj-financial-local-services.js` (1.225 líneas) + familia, con self-tests. **Local/in-memory**, en el worktree offline. |
| **Persistencia canónica** (13 tablas) | 🟡 **DDL diseñada** (`canonical_financial_architecture_v1_ddl`, 330 líneas) — no aplicada a remoto → *el gate*. |
| **Read-layer por rol** (recibos/wallet/ledger para client/artist/staff) | 🟡 V2 `shared/services/financial` — contratos + tests, pero mocks/sin SQL. |
| **Cerebro corporativo BFI** (Matrix: BU, márgenes, health, proyección, fiscal) | 🔴 **Net-new.** |
| **Capa de agente ELIXIS** (recibe, filtra, delega, responde en equipo) | 🔴 **Net-new.** |

---

## 2. Qué reusar / traer (regla de una sola dirección)

> **Gobernanza:** solo se traen ideas **buenas y válidas** de los repos viejos **HACIA
> este proyecto** (`miami-dj-beat-platform`). **Nunca se lleva nada a los repos viejos.**
> El análisis es solo lectura; traer = cherry-pick deliberado, con su ticket.

### A. De `MiamiDJBeat-V1-offline-payment` (worktree, línea T009) — el núcleo del motor
| Pieza | Qué es | Acción |
|---|---|---|
| `web/js/mdj-financial-local-services.js` (1.225 líneas) | **Motor**: comandos idempotentes, event-sourced, allocations, balances, reconciliación | ♻ **Traer** (es el cerebro contable) |
| `mdj-accounting-financial-runtime` + `-domain-events` + `-projection-sync` + `-canonical-shadow-writer` (+ self-tests `.mjs`) | Runtime contable, eventos de dominio, proyecciones, escritura canónica | ♻ **Traer** con sus tests |
| `20260804230000_canonical_financial_architecture_v1_ddl.sql` (13 tablas) | Esquema canónico (venues, agreements, receivables, payables, payments, allocations, owner ledger, reconciliations, domain events, command receipts) | ♻ **Traer** + aplicar (gate) |
| `docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md` | Contrato exacto de entidades (fuente de verdad del diseño) | ♻ **Traer** como referencia |
| `canonical_talent_taxonomy_v1` | Categorías de talento (DJ/Banda/MC/Músico/Bailarín/Talento) del Artist Matrix | ♻ **Traer** |

### B. De `MiamiDJBeat-MigracionV2` — el read-layer por rol
DTOs `PaymentReceiptReadDTO` · `TransactionHistoryDTO` · `FinancialBalanceReadDTO` + mappers +
tests (read-only, mocks). ♻ **Reusar contratos**, cablear a la persistencia canónica.

### C. Construir nuevo (no existe)
- **Cerebro corporativo BFI**: agregación → KPIs corporativos, Health Score, proyección, alertas, fiscal.
- **Capa de agente ELIXIS**: clasificación/enrutado + protocolo de equipo con el motor.

---

## 3. Contrato de datos (KPIs del Matrix ← modelo canónico)

Las 13 tablas canónicas son la **verdad transaccional**; los KPIs del Matrix son
**agregaciones** encima. Cada KPI: fuente → fórmula → quién lo ve → estado.

| KPI | Fuente (modelo canónico + real) | Fórmula | Ve | Dato hoy |
|---|---|---|---|---|
| **Ingresos totales** | `financial_venue_receivables` · `financial_payments` | Σ inflows del período | Owner | 🟡 tras aplicar DDL |
| **Margen neto** | ingresos − costos (`financial_payables`) | (ingr − costos) / ingr | Owner | 🟡 el modelo ya separa payables |
| **Caja disponible** | `financial_owner_ledger_entries` | Σ neto liquidado | Owner | 🟡 |
| **Días de caja** | caja ÷ burn diario | caja / (gastos ÷ 30) | Owner | 🟡 |
| **Health Score** | compuesto (liquidez, margen, morosidad, diversificación) | modelo ponderado | Owner | 🔴 nuevo |
| **Proyección de caja** | `financial_occurrences` (agendados) + recurrencias | forecast | Owner | 🟡 |
| **Alertas** | reglas sobre lo anterior | motor de reglas | Owner | 🔴 nuevo |
| **Wallet artista** | `residency_schedule_secure.dj_pay_usd` + `tips` | Σ dj_pay + tips − retiros | **Solo ese artista** | 🟢 RLS hecho |

**Confidencialidad (ya construido):** `residency_schedule_secure` (SECURITY DEFINER) +
`is_staff(auth.uid())`. La DDL canónica difiere RLS a su propio ticket — al traerla,
aplicar el mismo patrón por parte.

---

## 4. Orden de las Business Units (por disponibilidad de datos)

Las 8: Production · Accounting · Venues · Academy · Equipment Rentals · Memberships · Marketing · Operations.

- **Ola 1 (hay datos):** 1) **Venues** (`financial_venues`/`residency_schedule`) · 2) **Production/Events** (`financial_occurrences` + leads) · 3) **Academy** *(verificar registro de matrículas)*.
- **Ola 2 (parcial):** 4) **Memberships** (`plan`/tier en `dj_profiles`) · 5) **Marketing** (`referral` + `tips`).
- **Ola 3 (captura nueva):** 6) **Equipment Rentals** (definir modelo) · 7) **Operations** (costos/nómina) · 8) **Accounting** (consolidador fiscal — al final; el `accounting-financial-runtime` de T009 es el punto de partida).

---

## 5. Arquitectura por capas

```
┌─ Agente ELIXIS (NUEVO) ──────────────────────────┐
│ clasifica/filtra la petición → delega lo financiero│
├─ UI — Maqueta Matrix ─────────────────────────────┤
│ cablear KPIs · quitar banner DEMO                  │
├─ Cerebro corporativo BFI (NUEVO) ─────────────────┤
│ agregación → KPIs corp + health + proyección       │
├─ Motor transaccional/contable (TRAER T009) ───────┤
│ mdj-financial-local-services + accounting-runtime  │
│ + domain-events + projection-sync (event-sourced)  │
├─ Read-layer por rol (REUSAR V2) ──────────────────┤
│ DTOs + mappers → persistencia canónica             │
├─ Persistencia (TRAER + APLICAR DDL) ──────────────┤
│ 13 tablas financial_* + RLS por parte              │
└───────────────────────────────────────────────────┘
```

---

## 6. Fases (Rev. 2 — con head-start)

| Fase | Qué | Esfuerzo | Depende de |
|---|---|---|---|
| **0 · Inventario + contrato** | Confirmar qué traer de offline; validar §3 con el PO | Chico | Este documento |
| **🔑 GATE** | **Traer + aplicar la DDL canónica a PRODUCCIÓN** (hoy solo diseño/local) | — | Decisión + deploy |
| **1 · Transaccional** | Portar el motor T009 + cablearlo a la persistencia (ya existe `canonical-shadow-writer`) | **Reducido** (motor ya hecho + testeado) | Gate |
| **2 · Corporativo** | Cerebro BFI: agregación + Business Units ola por ola | **Semanas** | Fase 1 + fuente por BU |
| **3 · Agente ELIXIS** | Clasificación/enrutado + protocolo de equipo motor↔ELIXIS | Dedicado | `elixis-chat` ya desplegado |
| **4 · Accounting / Fiscal** | Consolidación + inteligencia de impuestos (sobre `accounting-runtime`) | Proyecto propio | Fase 2 + ledger en prod |

**El cuello de botella sigue siendo el GATE** (persistencia en producción). Pero la Fase 1
es mucho más corta que en la Rev. 1: **el motor ya está construido y probado.**

---

## 7. Confidencialidad, «hecho» y riesgos

**Confidencialidad (no negociable):** Artist Matrix = burbuja aislada (solo sus pagos/tips/
eventos; nunca corporativo ni otros artistas). Reusar `is_staff()` + vistas SECURITY DEFINER.
Owner ve todo; manager/vendedor con permiso explícito.

**«Hecho» por KPI:** (1) trazado a fuente canónica real, (2) fórmula documentada, (3) test
con fixture, (4) confidencialidad verificada, (5) cero números quemados.

**Riesgos:**
- **Gobernanza:** arrancar requiere autorización explícita del PO + ticket. La DDL dice
  `NOT AUTHORIZED for remote apply`.
- **Una sola dirección:** traer de los repos viejos hacia aquí; nunca al revés.
- **Datos faltantes (Ola 3):** no inventar; marcar "sin fuente".
- **El motor T009 es in-memory/local:** traerlo implica cablear su persistencia (el
  `canonical-shadow-writer` es el puente diseñado para eso).
