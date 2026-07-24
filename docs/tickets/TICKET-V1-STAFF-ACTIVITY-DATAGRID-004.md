# TICKET-V1-STAFF-ACTIVITY-DATAGRID-004

**Estado:** COMMIT LOCAL — PENDIENTE REVISIÓN PO (sin push)  
**Serie:** [Staff Activity Operations Center](./TICKET-V1-STAFF-ACTIVITY-OPERATIONS-CENTER-INDEX.md) · DATAGRID-004  
**Modo:** Sin backend · commit local agrupado 001–006

---

## Objetivo

Corregir bleed-through y ghosting del header sticky del Data Grid en **Staff → Actividad operativa**. El encabezado debe comportarse como tabla profesional tipo Excel: fondo **100% sólido**, sin transparencia.

---

## Archivo modificado

| Archivo | Cambio |
|---------|--------|
| `web/admin-dashboard.html` | CSS scoped `#actividad .owner-ops-grid thead` |

---

## Correcciones aplicadas

### #1 — Fondo sólido

| Antes | Después |
|-------|---------|
| `background: rgba(197, 160, 89, 0.50)` | `background: #B8923A` |
| Bordes `rgba(...)` | `#8F7028` sólido |
| Hover `rgba(197, 160, 89, 0.62)` | `#A68232` sólido |

### #2 — Eliminación de alpha en header

Removido del bloque header:

- `rgba(...)` en `background` y `border`
- `opacity` en `.owner-ops-sort-ind` → reemplazado por `color: #3d3018`

Sin `backdrop-filter`, `filter`, ni `mix-blend-mode` en thead/th.

### #3 — Color institucional

Dorado MDJ sólido: **`#B8923A`** (texto header `#12101a`, separador `#8F7028`).

### #4 — Stacking

| Propiedad | Valor |
|-----------|--------|
| `.owner-ops-grid-wrap` | `isolation: isolate` |
| `thead` | `position: sticky; top: 0; z-index: 30` |
| `thead th` | `position: sticky; top: 0; z-index: 31` |
| `tbody` | `z-index: 1` |
| Tabla | `border-collapse: separate; border-spacing: 0` (mejor sticky sin bleed) |

### #5 — Separación header / filas

- `border-bottom: 2px solid #8F7028` en cada `th`
- `box-shadow: 0 2px 0 #8F7028` bajo el header sticky

---

## Sin cambios

Columnas, filtros, búsqueda, ordenamiento, drawer, acciones, fuentes de datos, backend.

---

## Validación localhost

| Check | Resultado |
|-------|-----------|
| HTTP 200 `admin-dashboard.html` | ✅ |
| CSS `#B8923A` en thead servido | ✅ |
| Sin `rgba` en background thead | ✅ |
| Scroll + sticky visual con sesión Staff | **PENDIENTE PO** |

---

## Rollback

Revertir bloque CSS `/* Header sólido — TICKET-V1-STAFF-ACTIVITY-DATAGRID-004 */` y restaurar `border-collapse: collapse` previo.

---

*DATAGRID-004 · sin push*
