# TICKET-V1-STAFF-ACTIVITY-DATAGRID-003

**Estado:** COMMIT LOCAL — PENDIENTE REVISIÓN PO (sin push)  
**Serie:** [Staff Activity Operations Center](./TICKET-V1-STAFF-ACTIVITY-OPERATIONS-CENTER-INDEX.md) · DATAGRID-003  
**Modo:** Sin backend · commit local agrupado 001–006

---

## Objetivo

Reubicar el buscador a la barra principal de filtros (después de **Pagos / MDJPRO**) y rediseñarlo como barra de búsqueda moderna con lupa SVG integrada.

---

## Archivo modificado

| Archivo | Cambio |
|---------|--------|
| `web/admin-dashboard.html` | HTML + CSS scoped `#actividad` |

---

## Cambio de ubicación

**Antes:** input de búsqueda en fila `.owner-ops-grid-toolbar` junto a Fecha / Estado / Tipo.

**Después:**

```
Todos | Leads | Registros | Mensajes/Tickets | Pagos/MDJPRO | [🔍 Buscar…]
Fecha | Estado | Tipo   ← fila secundaria compacta (.owner-ops-secondary-filters)
```

El buscador forma parte de `.owner-ops-feed-filters` (misma barra flex con wrap).

---

## Icono de lupa

- **Componente:** SVG inline stroke (mismo patrón que iconos del sidebar admin: `circle` + `line`, `viewBox="0 0 24 24"`).
- **Clase:** `.owner-ops-search-icon` — `position: absolute`, `pointer-events: none`, alineado verticalmente.
- **Input:** `.owner-ops-search-input` — `padding-left: 36px` para no solapar texto.
- **Accesibilidad:** `aria-label="Buscar cliente, evento o referencia"` en el input; icono `aria-hidden="true"`.
- **NO emoji.**

Referencia visual: patrón `.header-search-wrap` de `styles.css` (lupa anclada izquierda), adaptado a tema oscuro Staff.

---

## Estilo Miami DJ Beat

| Propiedad | Valor |
|-----------|--------|
| Fondo | `rgba(10, 10, 18, 0.88)` |
| Borde | `rgba(255,255,255,0.14)` |
| Foco | borde dorado + `box-shadow` gold |
| Placeholder | gris `rgba(255,255,255,0.38)` |
| Forma | `border-radius: 999px` (pill, coherente con filtros) |
| Altura | `30px` — alineada con pills de filtro |

---

## Responsive

| Viewport | Comportamiento |
|----------|----------------|
| Desktop | Buscador `flex: 1 1 280px`, `max-width: 380px` |
| Laptop | `flex-wrap` en barra principal; buscador puede pasar a segunda línea ordenada |
| Tablet | Misma regla — wrap sin overflow horizontal forzado |

Filtros secundarios (Fecha / Estado / Tipo) permanecen en fila independiente compacta.

---

## Lógica de búsqueda

**Sin cambios:**

- Mismo `#owner-ops-grid-search`
- Mismo handler `oninput="setOwnerOpsGridSearch(this.value)"`
- Misma función `_ownerOpsGridMatchesSearch()` (cliente, evento, referencia, título, origen, etc.)
- Sin debounce añadido ni removido (no existía)

---

## Validación localhost

| Check | Resultado |
|-------|-----------|
| HTTP 200 `admin-dashboard.html` | ✅ |
| Buscador después de Pagos / MDJPRO | ✅ markup |
| Sin fila dedicada solo al buscador | ✅ |
| Lupa SVG dentro del campo | ✅ |
| Filtros secundarios en fila aparte | ✅ |
| Sesión Staff visual | **PENDIENTE PO** |

---

## Rollback

Revertir bloque HTML `.owner-ops-controls` y CSS `#actividad .owner-ops-search-*` en `admin-dashboard.html`.

---

*DATAGRID-003 · ver también DATAGRID-005 (ancho + placeholder `Search`) · sin push*
