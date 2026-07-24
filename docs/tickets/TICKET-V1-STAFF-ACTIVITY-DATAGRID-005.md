# TICKET-V1-STAFF-ACTIVITY-DATAGRID-005

**Estado:** COMMIT LOCAL — PENDIENTE REVISIÓN PO (sin push)  
**Serie:** [Staff Activity Operations Center](./TICKET-V1-STAFF-ACTIVITY-OPERATIONS-CENTER-INDEX.md) · DATAGRID-005  
**Modo:** Sin backend · commit local agrupado 001–006

---

## Objetivo

Refinar proporciones y presentación del buscador en **Staff → Actividad operativa**. Sin cambios de lógica ni comportamiento.

---

## Archivo modificado

| Archivo | Cambio |
|---------|--------|
| `web/admin-dashboard.html` | CSS `.owner-ops-search-wrap` + placeholder input |

---

## Correcciones

### #1 — Ancho ampliado

| Antes | Después |
|-------|---------|
| `flex: 1 1 280px` | `flex: 1 1 420px` |
| `max-width: 380px` | `max-width: 100%` (crece con el toolbar) |
| `min-width: min(100%, 280px)` | `min-width: min(100%, 420px)` |

### #2 — Placeholder simplificado

| Antes | Después |
|-------|---------|
| `Buscar cliente, evento o referencia…` | **`Search`** |

`aria-label="Search"` alineado con placeholder.

### #3 — Sin cambios funcionales

- Icono SVG integrado
- Foco dorado (`.owner-ops-search-input:focus`)
- Fondo oscuro
- `setOwnerOpsGridSearch()` / `_ownerOpsGridMatchesSearch()` intactos

### #4 — Control principal del toolbar

- `.owner-ops-feed-filters { width: 100% }`
- `.owner-ops-search-wrap { margin-left: auto; flex: 1 1 420px }` — filtros a la izquierda, buscador ocupa el espacio restante hacia la derecha

---

## Responsive

- Desktop: buscador crece entre ~420px y el ancho disponible del toolbar (típ. hasta ~520px+ según panel)
- Ancho reducido: `flex-wrap` + `min-width: min(100%, 420px)` evita overflow horizontal forzado

---

## Validación localhost

| Check | Resultado |
|-------|-----------|
| HTTP 200 | ✅ |
| `placeholder="Search"` servido | ✅ |
| `flex: 1 1 420px` + `margin-left: auto` | ✅ |
| Revisión visual PO | **PENDIENTE** |

---

## Rollback

Revertir CSS `.owner-ops-search-wrap` y placeholder del input en `admin-dashboard.html`.

---

*DATAGRID-005 · sin push*
