# TICKET-V1-INVOICE-UX-PANELS-001 — Manual invoice UX (Producción / Panel 5)

**Fecha de apertura:** 2026-07-06  
**Fecha de cierre local:** 2026-07-06  
**Estado:** **CERRADO LOCAL** — aprobado PO para cierre funcional  
**Prioridad:** Alta (staff Producción / cobro manual)  
**Alcance:** `admin-dashboard.html` → tab **STAFF → Producción** (`#production-module-host`)

---

## Decisión Product Owner

**APROBADO PARA CIERRE LOCAL.**

El diseño visual puede pulirse en ticket futuro; el flujo funcional queda aceptado para cerrar este ticket.

---

## Objetivo cumplido

Reorganizar la factura manual de staff en **paneles numerados 1–5**, con barra de acciones por iconos, impresión canónica, guardado de lead/invoice, cobro Stripe (depósito o total), sin tocar Header/Nav, V2, schema Supabase ni Stripe backend.

---

## Entregables documentados

| # | Entregable | Estado |
|---|------------|--------|
| 1 | Paneles 1–5 creados | ✅ |
| 2 | Panel 1 limpio (cliente / datos) | ✅ |
| 3 | Búsqueda cliente por cuenta / UUID | ✅ `resolveProdInvClientUserId()` + lookup |
| 4 | Cliente manual sin cuenta registrada | ✅ lead sin `client_user_id` |
| 5 | Email requerido para guardar / cobrar | ✅ validación `_saveInvoice` + `_upsertEventLead` |
| 6 | Print/PDF → `invoice-template-print.html` | ✅ `mdjOpenInvoicePrint()` / `mdj_invoice_sale_v1` |
| 7 | Barra de iconos Panel 5 | ✅ Print, Copy link (disabled), Crear cuenta, Guardar, Cobrar tarjeta |
| 8 | Cobrar tarjeta → Stripe Checkout | ✅ `create-event-payment` + apertura pestaña |
| 9 | Fix Safari `about:blank` | ✅ placeholder sin `noopener`; `stripeTab.location.href` |
| 10 | Selector Depósito / Total completo | ✅ radios Panel 5; `readProdCobroChargeMode()` |
| 11 | Copy link de pago | ⏳ pendiente (icono disabled) |
| 12 | Manager Discount | ⏳ pendiente (placeholder UI) |
| 13 | Sin cambios Header / Nav | ✅ |
| 14 | Sin V2 | ✅ |
| 15 | Sin Supabase schema | ✅ |
| 16 | Sin Stripe backend / webhook | ✅ |

---

## Archivos modificados (este ticket)

| Archivo | Cambio |
|---------|--------|
| `web/admin-dashboard.html` | CSS scoped `#production-module-host` — barra iconos Panel 5 |
| `web/js/production-module.js` | Paneles 1–5, guardado lead/invoice, print bridge, Stripe, charge mode |
| `web/translations.js` | Keys ES/EN paneles, acciones, cobro, email, charge mode |
| `web/i18n.js` | Soporte `data-i18n-title` (tooltips iconos) |

---

## Paneles (estructura)

1. **Panel 1 — Cliente:** lookup MDJB/UUID, datos comprador, mail, teléfono, direcciones.  
2. **Panel 2 — Líneas / cotización:** líneas, impuesto, plantillas.  
3. **Panel 3 — Cobro del evento:** tipo evento, DJ, payout, depósito auto (readonly).  
4. **Panel 4 — Totales:** resumen subtotal / tax / total.  
5. **Panel 5 — Acciones financieras:** status cobro, discount placeholder, **Monto a cobrar**, barra iconos.

---

## Flujos clave

### Guardar invoice

- Requiere email (`#prod-inv-client-email`).
- UUID válido → lead + `mdj_staff_manual_invoices`.
- Cliente manual → solo lead (sin fila invoice si schema exige `client_user_id`).

### Print / PDF

- **No** requiere email.
- `_pushInvoicePrint()` → `mdjOpenInvoicePrint()` → `invoice-template-print.html`.

### Cobrar tarjeta

- Requiere lead guardado + email.
- Placeholder `window.open('about:blank', '_blank')` → navega a `result.url` post-fetch.
- Clipboard + mensaje status en `#prod-cobro-status`.
- **Depósito (default):** `max(30% total, $150)`.
- **Total completo:** saldo pendiente `(total_amount - balance_paid)`; fallback total invoice.

---

## Sub-tickets absorbidos en esta línea de trabajo

| Ticket | Resumen |
|--------|---------|
| TICKET-V1-INVOICE-PRINT-REWIRE-CANONICAL-001 | Print canónico |
| TICKET-V1-INVOICE-MANUAL-CLIENT-LEAD-001 | Cliente manual + lead |
| TICKET-V1-INVOICE-MANUAL-LEAD-EMAIL-FIX-001 | Email obligatorio al guardar |
| TICKET-V1-INVOICE-STRIPE-OPEN-CHECKOUT-001 | Abrir Stripe (no solo copy) |
| TICKET-V1-INVOICE-STRIPE-POPUP-SAFE-FIX-001 | Placeholder pre-async |
| TICKET-V1-INVOICE-STRIPE-SAFARI-POPUP-REF-FIX-001 | Referencia Safari sin `noopener` |
| TICKET-V1-INVOICE-STRIPE-AMOUNT-MODE-FIX-001 | Selector depósito / total |

---

## Validación localhost

**URL:** `http://localhost:8080/admin-dashboard.html`  
**Ruta:** STAFF → Producción

| Caso | Resultado esperado |
|------|-------------------|
| Producción abre | ✅ módulo renderiza paneles |
| Print/PDF | ✅ `invoice-template-print.html` |
| Guardar con mail | ✅ lead (+ invoice si UUID) |
| Cliente manual | ✅ lead sin cuenta |
| Cobrar tarjeta | ✅ Stripe Checkout nueva pestaña |
| Depósito / Total | ✅ radios visibles; default depósito |
| Header/Nav | ✅ intactos |
| V2 | ✅ no modificado |

HTTP check documentación: `admin-dashboard.html` → **200** en localhost:8080.

---

## Pendientes (tickets futuros)

- **Copy link de pago** — icono `#prod-inv-action-copy-link` disabled.
- **Manager Discount** — bloque placeholder sin lógica.
- Pulido visual Panel 5 / iconografía.
- Hardening backend: `payment_mode` metadata, validación monto server-side (audit previo).

---

## Restricciones respetadas

- No Header / Nav layout changes.
- No MiamiDJBeat-MigracionV2 / docs/V2.
- No migraciones Supabase.
- No Edge Functions / webhook Stripe modificados.

---

## Commit local (sin push)

```
feat(invoice): complete manual invoice UX panels and payment flow
```

Solo archivos listados en este ticket. **NO PUSH. NO DEPLOY.**
