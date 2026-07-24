# TICKET-V1-STAFF-ACTIVITY-DATAGRID-001

**Estado:** COMMIT LOCAL — PENDIENTE REVISIÓN PO (sin push)  
**Serie:** [Staff Activity Operations Center](./TICKET-V1-STAFF-ACTIVITY-OPERATIONS-CENTER-INDEX.md) · DATAGRID-001  
**Tipo:** V1 · UX/UI · Staff Portal  
**Modo:** Sin backend · sin Supabase · commit local agrupado 001–006

---

## Objetivo

Reemplazar la vista tipo feed/lista de **Actividad operativa** por un **Data Grid** estilo Excel/CRM, reutilizando el lenguaje visual del Staff Portal (dark, glass, gold accents), **sin cambiar fuentes de datos ni lógica de negocio**.

---

## Arquitectura anterior

```
Actividad operativa (#actividad)
  ↓
Filtros por categoría (Todos / Leads / Registros / Mensajes / Pagos)
  ↓
loadOwnerOpsFeed() — mismos SELECT Supabase
  ↓
renderOwnerOpsFeed() — cards verticales (.activity-item)
  ↓
Scroll largo · poca densidad · sin ordenamiento ni búsqueda
```

**Fuente de datos (sin cambios):** `leads`, `client_profiles`, `dj_profiles`, `portal_messages`, `platform_inbox_messages` + `platform_tickets`, `payments`.

---

## Arquitectura nueva

```
Actividad operativa (#actividad)
  ↓
Toolbar
  · Filtros categoría (existentes)
  · Buscar · Fecha · Estado · Tipo
  ↓
loadOwnerOpsFeed() — mismos SELECT (sin RPC/migraciones)
  ↓
Normalización enriquecida (colClient, colProduct, colStatus, …) — solo UI
  ↓
_ownerOpsApplyGridFilters() — filtro + orden client-side
  ↓
renderOwnerOpsFeed() — tabla .owner-ops-grid (sticky header, scroll horizontal)
  ↓
Click fila / botón Detalle → openOwnerOpsDetail() — drawer lateral solo lectura
  ↓
Acciones fila → navegación existente (Leads, Portal, CRM, Analytics)
```

**Reutilización visual:** patrón spreadsheet de `#leads-container .leads-table-wrap` adaptado scoped a `#actividad` (gold sticky header, glass, hover row).

No existe componente DataGrid compartido en repo; se evitó duplicar lógica de datos y se reutilizó el estilo leads-table + modal drawer (patrón `showEboDetail`).

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `web/admin-dashboard.html` | CSS grid scoped, toolbar HTML, `renderOwnerOpsFeed` → tabla, filtros/orden client-side, drawer detalle, navegación fila |

**Sin cambios:** migraciones, Edge, RPC, Stripe, `production-module.js`, V2.

---

## Columnas del grid

| Columna | Fuente |
|---------|--------|
| Fecha | `item.date` |
| Tipo | `item.kind` → pill (Lead, Registro, Mensaje, Ticket, Pago) |
| Cliente | Derivado de datos existentes (`name`, `full_name`, `from_name`, …) |
| Evento / Producto | `event_type`, plan, asunto ticket, etc. |
| Estado | `status`, `is_read`, ticket status, … |
| Pago | `payment_status` (leads) o monto plan (payments) |
| Responsable | `sender_role`, `from_name` donde existe |
| Origen | `item.source` |
| Última act. | `created_at` (único timestamp disponible en SELECTs) |
| Ref | Primeros 8 chars del id |
| Acciones | Detalle · Lead/Portal · CRM · Pagos (solo navegación) |

No se inventa información ausente en las fuentes — celdas `—` cuando no aplica.

---

## Filtros

| Control | Comportamiento |
|---------|----------------|
| Todos / Leads / Registros / Mensajes / Pagos | Igual que MVP — ahora filtra filas del grid |
| Buscar | Texto libre en título, desc, cliente, ref, origen |
| Fecha | Hoy · 7d · 30d · todas |
| Estado | Heurística sobre colStatus/colPayment/detail |
| Tipo | lead · registro · mensaje · ticket · pago |

---

## Ordenamiento

Columnas ordenables (click header): **Fecha**, **Tipo**, **Cliente**, **Estado**, **Pago**, **Responsable**, **Última act.**  
Toggle asc/desc por columna.

---

## Detalle (drawer)

- Panel lateral derecho · solo lectura  
- KV: fecha, tipo, cliente, producto, estado, pago, responsable, origen, ref  
- Raw fields de la fila (objeto fuente)  
- Timeline / observaciones (título + detalle + origen)  
- Botones: Ir a Leads · Portal lead · CRM · Analytics (según tipo)

---

## Responsive

| Viewport | Comportamiento |
|----------|----------------|
| Desktop | Tabla completa en `.owner-ops-grid-wrap` |
| Laptop / tablet | Scroll horizontal solo si necesario · `max-height: calc(100vh - 220px)` (ver DATAGRID-002) |

---

## Validaciones realizadas (localhost)

| Check | Resultado |
|-------|-----------|
| `http://localhost:8080/admin-dashboard.html` | HTTP **200** |
| Markup grid en HTML servido | `owner-ops-grid`, `setOwnerOpsGridSort`, `openOwnerOpsDetail` presentes |
| Backend / Supabase | **Sin cambios** |
| Commit local 001–006 | Ver [SESSION-LOG-2026-07-24.md](../sessions/SESSION-LOG-2026-07-24.md) |
| Push | Pendiente **`APROBADO PUSH`** |

**Pendiente PO con sesión staff:** render con datos reales, scroll, filtros, orden, drawer, consola sin errores.

---

## Rollback

Revertir cambios en `web/admin-dashboard.html` (sección `#actividad` CSS + JS `renderOwnerOpsFeed` / toolbar). Sin migraciones que deshacer.

---

## Refinamientos posteriores (misma serie)

| Ticket | Tema |
|--------|------|
| 002 | Layout panel y densidad |
| 003–005 | Buscador (ubicación, ancho, placeholder `Search`) |
| 004 | Header sticky sólido |
| 006 | Botones drawer |

---

*DATAGRID-001 · Staff Activity Operations Center · commit local sin push*
