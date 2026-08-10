# TICKET-V1-ARTIST-FINANCIAL-STRIPE-CONNECT-BLUEPRINT-001 — Centro de Pagos & Cobros del Artista (Suscripciones + Payouts / Stripe Connect)

**Fecha de apertura:** 2026-08-10
**Última actualización:** 2026-08-10
**Prioridad:** Media (habilitador financiero futuro — Bloque 5 de `ARCH-REC-003`)
**Clasificación (directriz V1→V2):** **B) V2-prep** (diseño + maqueta ahora; construcción real diferida)
**Alcance actual:** Blueprint conceptual registrado + maqueta "verlo-ya" (UI-only mock) portada a la app. **Sin** Stripe Connect, **sin** backend, **sin** comunicación externa.

---

## Resumen ejecutivo

Consolida el diseño del futuro **Centro de Pagos & Cobros del artista**: la **Arquitectura de Dos Vías** que separa estrictamente el dinero entrante y saliente de la plataforma (estándar bancario / compliance). Este documento es el **hogar formal del blueprint** compartido por el PO y de la maqueta de prueba aprobada visualmente. **No autoriza construcción por sí solo** — el módulo real sigue condicionado al gate del Bloque 5.

**Arquitectura de Dos Vías:**
- **Flujo A — Ingresos de la App** (Clientes/Fans → Miami DJ Beat): suscripciones/apps vía **Stripe Checkout**. Ya existe hoy (`create-checkout` + `dj_profiles.stripe_customer_id`). Pieza real aún faltante: portal de billing del artista (espejo de `create-buyer-billing-portal`).
- **Flujo B — Salidas a Artistas** (Miami DJ Beat → DJs): payouts/tips vía **Stripe Connect Express** (KYC automatizado). **Nada construido** (verificado 2026-08-10: cero referencias `connect`/`payout`/`transfer` en `supabase/functions/`).

---

## Estado actual (Product Owner)

```
GATE DE CONSTRUCCIÓN (BLOQUE 5): NO CUMPLIDO
  - Package 5 · COMPLETE ............ NO MET
  - Autorización explícita del PO ... NO MET
BLUEPRINT: registrado como referencia conceptual (no especificación cerrada)
MAQUETA "VERLO-YA" (UI-only mock): APROBADA VISUALMENTE + PORTADA A LA APP — 2026-08-10
  - Decisión PO: tratar el paso a localhost como V2-prep visual, NO como apertura del Bloque 5
SIN Stripe Connect · SIN backend · SIN comunicación externa · SIN commit
PRÓXIMO: (bloqueado) construcción real — solo tras Package 5 COMPLETE + autorización explícita
```

**El blueprint/maqueta NO autoriza trabajo por sí solo.** La futura Fase 1 verificará este insumo contra el código real antes de darlo por válido.

---

## Artefactos y evidencia

| Artefacto | Ruta / URL | Naturaleza |
|-----------|------------|------------|
| Blueprint (recreado, publicado) | `docs/architecture/financial-intelligence/blueprint-payouts-suscripciones.html` · https://claude.ai/code/artifact/da8b5d22-e7fd-45ce-889b-3adff1cb9ceb | Referencia de diseño canónica |
| Maqueta de prueba (aprobación visual) | `docs/architecture/financial-intelligence/maqueta-centro-financiero-verlo-ya.html` · https://claude.ai/code/artifact/fac47654-2415-4ab4-ac25-703257ba7720 | Mock aprobado |
| Página de app (verlo-ya, localhost) | `web/centro-financiero-artista.html` | UI-only mock, datos estáticos, no funcional |
| Registro en índice maestro | `docs/MASTER-DOCUMENTATION-INDEX.md` §7.2 | Puntero canónico |
| Insumo previo (NO removido) | `docs/architecture/financial-intelligence/MIAMI-DJ-BEAT-BUSINESS-FINANCIAL-INTELLIGENCE-MAQUETA.md` | Maqueta previa, intacta (regla de no-remoción) |

**Nota de navegación:** la página se abre por **URL directa** (`/centro-financiero-artista.html`), sin entrada en el nav — **mismo patrón que el calendario** (`calendario-operacional-inteligente.html`, tampoco enlazado en `mdj-shared-header.js`).

---

## Reglas de seguridad y control (del blueprint)

1. **Cero almacenamiento sensible** — ningún dato de tarjetas/cuentas en la base local; todo en vaults de Stripe (PCI-DSS).
2. **Trazabilidad contable** — cada transferencia Connect produce un registro inmutable que une ID de factura ↔ ID de transferencia (Transfer ID).
3. **Validación de roles** — middleware impide que un usuario cliente acceda a los paneles de payouts del artista.
4. **Cumplimiento y KYC** — verificación de identidad dentro del flujo seguro de Stripe Connect Express.
5. **Registro inmutable** — todos los eventos financieros (entrantes/salientes) en un ledger corporativo para auditoría y reconciliación.

---

## Fuera de alcance (bloqueado hasta abrir gate)

- Stripe Connect Express (onboarding, KYC, payouts, webhooks).
- Portal de billing del artista (espejo de `create-buyer-billing-portal`).
- Tabla/campos de `billing_settings` para método preferido de cobro (Connect vs. Zelle).
- Ledger inmutable factura ↔ transfer.
- Cualquier comunicación con Stripe o backend real.

---

## Criterios de apertura (para pasar de V2-prep a construcción)

1. **Package 5 · COMPLETE** formalmente cerrado.
2. **Autorización explícita del PO** para abrir la Fase 1 del módulo financiero.
3. Verificación del blueprint contra el código real vigente antes de fijar la especificación.

---

## Documentos gobernantes

- `ARCH-REC-003-OWNER-FINANCIAL-MATRIX-CONSOLIDATION.md` (Bloque 5 = ancla de este módulo).
- `docs/MASTER-DOCUMENTATION-INDEX.md` §7.2 (registro del artefacto).
- Memoria de agente: `project_payouts_blueprint_bloque5`.

---

```
NO CODE MODIFIED (más allá de la maqueta UI-only ya portada)
NO STRIPE · NO BACKEND · NO COMMIT
GATE BLOQUE 5 INTACTO
```
