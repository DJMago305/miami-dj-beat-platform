# Nota Diaria — 2026-07-06

Registro operativo del día.

---

## Cierre local — TICKET-V1-INVOICE-UX-PANELS-001

**Estado PO:** APROBADO PARA CIERRE LOCAL.

Factura manual en **Admin → STAFF → Producción** reorganizada en paneles 1–5 con barra de iconos (Panel 5), impresión canónica, guardado de lead/invoice, cobro Stripe con selector **Depósito / Total completo**, y fix Safari para apertura de Checkout.

### Archivos incluidos en commit local

- `web/admin-dashboard.html` — CSS scoped barra iconos
- `web/js/production-module.js` — paneles, print, save, Stripe, charge mode
- `web/translations.js` — i18n ES/EN
- `web/i18n.js` — `data-i18n-title` tooltips
- `docs/tickets/TICKET-V1-INVOICE-UX-PANELS-001.md`
- `docs/NOTA-DIARIA-2026-07-06.md`

### Validación

- Localhost: `http://localhost:8080/admin-dashboard.html` → HTTP 200
- Sin push / deploy en este cierre

### Pendiente próximo ticket

- Copy link de pago (icono disabled)
- Manager Discount (placeholder)
- Pulido visual opcional

### Sin tocar

- Header / Nav
- V2 / MigracionV2
- Supabase schema
- Stripe backend / webhook
