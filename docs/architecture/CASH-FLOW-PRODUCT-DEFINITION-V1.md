# Cash Flow — Definición oficial del producto (V1)

**Ticket:** TICKET-V1-CASH-FLOW-PRODUCT-DEFINITION-002  
**Persistencia:** TICKET-V1-CASH-FLOW-PERSIST-PRODUCT-DEFINITION-003  
**Estado:** APROBADO PO — 2026-07-06  
**Modo:** Documentación de producto — sin implementación en este ticket

**Base:** Auditoría `TICKET-V1-CASH-FLOW-ARCHITECTURE-AUDIT-001` + Decision Brief + respuesta PO.

---

## 0. Propósito

Fijar **qué es Cash Flow en Miami DJ Beat**, qué **no es**, cómo evoluciona **por fases** (V1 → V1.5 → V2), y qué queda **congelado** hasta tickets futuros. Referencia obligatoria antes de cualquier implementación Cash Flow.

---

## 1. Glosario oficial

| Término | Definición aprobada |
|---------|---------------------|
| **Cash Flow Artista** | Producto del DJ: wallet + salud operativa MDJ + eventos + tips + reputación interna. Tab `?tab=flow` / perfil owner. |
| **Cash Flow Empresa** | Producto Owner/Manager: P&L operativo del negocio. **Separado** del tab artista. Prioridad **P1**. |
| **Cobro al cliente** | Dinero que paga el cliente (Stripe, Zelle, etc.). Vive en `leads.balance_paid`. **No es wallet DJ.** |
| **Wallet / Earning DJ** | Dinero reconocido al artista tras `staff_release_event_dj_payout` → `dj_ledger`. |
| **Movimiento canónico (CFMovement)** | Registro append-only de hecho financiero para audit + reportes. Fase 1 = read-map / audit log (**Opción 3B**). |
| **Estrellas públicas** | Reviews de clientes/fans → `dj_public_reviews` → rating visible en perfil fan. |
| **Salud MDJ (interna)** | Índice compuesto: eventos, ingresos, cumplimiento, tips, residencia, reputación, cancelaciones, performance. **No pública** por defecto. |
| **Ranking marketplace** | Ticket **separado**, futuro. PRO mantiene prioridad comercial; performance entra después. |
| **North star financiero** | TICKET-004 (5 capas + ledger unificado), alcanzado **por fases**, no big-bang. |

---

## 2. Cash Flow Artista — Opción 1D (aprobada)

### 2.1 Qué es

Centro operativo de **salud económica y profesional del DJ**. Combina:

| Pilar | Contenido | Fuente V1 actual |
|-------|-----------|------------------|
| **Wallet DJ** | Ingresos liberados, disponible, pagado, payouts | `dj_ledger` |
| **Eventos** | Completados, pendientes, asignados | `leads` (assigned) |
| **Tips** | SoundForTips aceptados | RPC SFT + merge UI |
| **Salud MDJ** | Estrellas internas compuestas | `computeCompositeHealthScore` (browser) |
| **Reputación interna** | Peso de reviews + señales operativas | `dj_profiles.rating` + ecosistema |
| **Residencia / agenda** | Turnos residente, venues | `weekly_schedule`, `is_resident` |
| **Reportes** | KPIs, gráficas, export statement | RPC rollups + `flow-handler.js` |

### 2.2 Qué NO es

- **No** es el cobro al cliente.
- **No** es el P&L de la empresa.
- **No** es el ranking del marketplace.
- **No** implica que cobro en Invoice = dinero en wallet DJ.

### 2.3 Reglas de negocio aprobadas

1. **Cobro al cliente ≠ dinero disponible del DJ.** Cliente paga → `leads.balance_paid`. DJ ve wallet tras release staff.
2. **Release de payout** = acción staff explícita (`staff_release_event_dj_payout`). Gate: depósito cobrado + `dj_agreed_payout_usd` + DJ asignado.
3. **Estrellas internas MDJ ≠ reviews públicas.**
4. **Off-platform / cheque** cuenta en salud si el DJ lo refleja en leads o ledger (filosofía `flow-handler.js`).

### 2.4 Usuarios

| Usuario | Acceso |
|---------|--------|
| Artista LITE/PRO | Tab Cash Flow en dashboard / perfil owner |
| Cliente puro | Sin tab Cash Flow |
| Owner (perfil propio) | Flow + salud MDJ |

---

## 3. Cash Flow Empresa — Producto separado (P1)

### 3.1 Qué es

Vista **Owner/Manager** del flujo financiero de la empresa. **No** vive en el tab artista.

### 3.2 Alcance aprobado

- Ingresos brutos por evento
- Depósitos cobrados y pagos finales
- Canales: Stripe, Zelle, (futuro cheque/efectivo manual)
- Payouts DJ
- Margen empresa (calculado)
- Comisiones (seller, manager, referidos, plataforma SFT)
- Cancelaciones / refunds (cuando existan movimientos)

### 3.3 Prioridad

**P1** — antes de V2 completa. Consume movimientos canónicos (fase 1 read-map primero).

---

## 4. Movimiento canónico — CFMovement (Opción 3B)

### 4.1 Pipeline aprobado

```
Invoice (staff) → Lead (comercial)
  → Cobro cliente (Stripe / Zelle)
  → CFMovement (audit / read-map)     ← FASE 1
  → Payout DJ (staff release)         ← sin auto-release
  → Reportes Artista + Empresa
```

### 4.2 Modelo conceptual CFMovement (documentación — no schema en este ticket)

| Campo conceptual | Descripción |
|------------------|-------------|
| `id` | UUID |
| `occurred_at` | Timestamp del hecho |
| `lead_id` | FK opcional |
| `staff_invoice_id` | FK opcional |
| `movement_type` | `client_deposit`, `client_payment`, `client_refund`, `dj_payout`, `platform_fee`, `tip_gross`, `tip_net`, `subscription`, `adjustment`, … |
| `channel` | `stripe`, `zelle`, `manual`, `internal` |
| `amount_usd` | Monto con signo |
| `counterparty_role` | `client`, `artist`, `company`, `seller`, `manager` |
| `status` | `posted`, `pending`, `reversed` |
| `source_system` | `stripe_webhook`, `zelle_rpc`, `release_rpc`, `staff_manual` |
| `idempotency_key` | Evita duplicados |

### 4.3 Fases

| Fase | Entrega | Toca Invoice V1 |
|------|---------|-----------------|
| **0** | Definición producto (este doc) | No |
| **1** | Read-map / audit log derivado de fuentes existentes | No — observador |
| **2** | Writers paralelos aditivos | Ticket PO explícito |
| **3** | Cash Flow Empresa UI | Ticket separado |
| **4** | Reconciliación + refunds | Ticket separado |
| **5** | TICKET-004 capas completas | North star |

**PO:** No aprobar auto-release de payout.

---

## 5. Estrellas — Dos capas permanentes

### 5.1 Capa pública — Reviews

- Fuente: `dj_public_reviews` → `dj_profiles.rating`
- Audiencia: fans, visitantes
- **Hero perfil público = solo reviews públicas**

### 5.2 Capa interna — Salud MDJ

- Fórmula compuesta: eventos, ledger, tips, comisiones, residencia, reviews (input), cancelaciones, performance
- Audiencia: owner en dashboard / tab Flow
- **Índice MDJ no se muestra al público** sin decisión futura

### 5.3 Deuda V1 documentada

Hoy el owner puede pintar hero con índice MDJ (`mdjPaintProfileHeroStarsFromHealth`). Producto aprobado: corregir en ticket futuro — hero público = reviews.

---

## 6. Marketplace / Ranking — Ticket separado

- **No implementar ranking ahora.**
- V1 congelado: PRO/LITE domina (`searchRankScore`).
- Futuro: reviews, eventos completados, cancelaciones, disponibilidad, certificaciones, salud MDJ, ingresos (GBV).
- Ticket sugerido: `TICKET-V1-MARKETPLACE-RANKING-POLICY-005`.

---

## 7. TICKET-004 — North star por fases

| Capa TICKET-004 | Relación producto aprobado |
|-----------------|----------------------------|
| A. Client financials | `leads` hasta migración |
| B. Talent compensation | `dj_agreed_payout_usd` + release |
| C. Company financials | → Cash Flow Empresa P1 |
| D/E. Seller/Manager commission | Fase 5 |
| F. Ledger audit | → CFMovement fases 1–5 |

No big-bang. CFMovement fase 1 = primer escalón hacia F.

---

## 8. Mapa de productos

```
┌─────────────────────────────────────────────────────────────┐
│                    MIAMI DJ BEAT — FINANZAS                  │
├──────────────────────────┬──────────────────────────────────┤
│  CASH FLOW ARTISTA (1D)    │  CASH FLOW EMPRESA (P1)          │
│  Tab DJ dashboard          │  Admin Owner/Manager             │
│  Wallet + Salud MDJ        │  P&L + canales + margen          │
├──────────────────────────┴──────────────────────────────────┤
│              CFMovement (read-map → writers → ledger)        │
├─────────────────────────────────────────────────────────────┤
│  CONGELADO V1: Invoice, Stripe link, webhook, release RPC     │
├─────────────────────────────────────────────────────────────┤
│  FUTURO: Ranking V2 (ticket separado)                         │
│  NORTH STAR: TICKET-004 completo                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Restricciones congeladas (PO)

**Prohibido modificar sin ticket PO explícito:**

| Componente |
|------------|
| Manual Invoice V1 (`production-module.js`, Producción) |
| Stripe Payment Link / Checkout UX |
| Print Invoice |
| Depósito / Pago Total selector |
| Header / Nav |
| `create-event-payment` Edge |
| `stripe-webhook` (rama event deposit) |
| `staff_release_event_dj_payout` RPC |

Writers CFMovement fase 2+ deben ser **aditivos** hasta PO autorice cambio de semántica.

---

## 10. Roadmap documental

| Orden | Ticket | Estado |
|-------|--------|--------|
| 1 | TICKET-V1-CASH-FLOW-ARCHITECTURE-AUDIT-001 | Completado (solo lectura) |
| 2 | TICKET-V1-CASH-FLOW-DECISION-BRIEF-001 | Completado (análisis) |
| 3 | TICKET-V1-CASH-FLOW-PRODUCT-DEFINITION-002 | Aprobado PO |
| 4 | TICKET-V1-CASH-FLOW-PERSIST-PRODUCT-DEFINITION-003 | Este archivo |
| ⏳ | CFMovement read-map spec | Pendiente PO |
| ⏳ | CFMovement fase 1 implement | Pendiente PO |
| ⏳ | Cash Flow Empresa UI P1 | Pendiente PO |
| ⏳ | Hero público = reviews only | Pendiente PO |
| ⏳ | MARKETPLACE-RANKING-POLICY-005 | Pendiente PO |
| ⏳ | TICKET-004 fases 4–5 | North star |

---

## 11. Decisiones PO registradas (acta 2026-07-06)

| # | Decisión | Respuesta PO |
|---|----------|--------------|
| 1 | Cash Flow Artista | **1D** — wallet + salud + eventos + tips + reputación interna |
| 2 | Cobro ≠ wallet DJ | **Confirmado** |
| 3 | Cash Flow Empresa | **Sí, separado, P1** |
| 4 | Movimiento canónico | **3B primero** — read-map/audit; **no auto-release** |
| 5 | Estrellas | **Dos capas**; hero público = reviews; MDJ interno = dashboard/owner |
| 6 | Ranking | **Ticket separado**; PRO + performance futuro; **no ahora** |
| 7 | TICKET-004 | **North star phased** |
| 8 | Invoice V1 + webhook + release | **Congelado** |

---

*Documento canónico de producto Cash Flow V1. Cambios requieren aprobación PO + ticket explícito.*
