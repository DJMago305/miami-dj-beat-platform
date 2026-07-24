# TICKET-V1-STAFF-ACTIVITY-DATAGRID-006

**Estado:** COMMIT LOCAL — PENDIENTE REVISIÓN PO (sin push)  
**Serie:** [Staff Activity Operations Center](./TICKET-V1-STAFF-ACTIVITY-OPERATIONS-CENTER-INDEX.md) · DATAGRID-006  
**Modo:** Solo estilos · commit local agrupado 001–006

---

## Objetivo

Corregir contraste y visibilidad de los botones de acción al final del drawer de detalle (**Ir a Leads**, **Portal del evento**, **Ir al CRM**, etc.).

---

## Archivo modificado

| Archivo | Cambio |
|---------|--------|
| `web/admin-dashboard.html` | CSS `.owner-ops-drawer-action-btn` + markup en `openOwnerOpsDetail()` |

---

## Estilos anteriores detectados

Los botones usaban clases genéricas **`btn secondary small`** con estilos globales de bajo contraste sobre fondo oscuro del drawer:

- Texto apagado / similar al fondo
- Apariencia de controles deshabilitados
- Hover poco visible

---

## Nuevos estilos (estado normal)

| Propiedad | Valor |
|-----------|--------|
| Texto | `#F5F5F5` |
| Fondo | `#1C2230` (sólido) |
| Borde | `1px solid #4A4F5C` |
| Altura | `min-height: 36px` |
| Padding | `8px 14px` |
| Radio | `8px` |
| Tipografía | `12px`, `font-weight: 700` |

Clase dedicada: **`.owner-ops-drawer-action-btn`** (sin herencia de `.btn.secondary`).

Contenedor: **`.owner-ops-drawer-actions`** (flex, gap uniforme 8px).

---

## Hover

```css
background: #B8923A;
color: #111318;
border-color: #B8923A;
```

Efecto dorado claro, no sutil.

---

## Focus (teclado)

```css
:focus-visible {
  outline: 2px solid #D4AF5A;
  outline-offset: 2px;
}
```

---

## Disabled

```css
:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

Hover desactivado en disabled para no confundir con active.

---

## Lógica intacta

Sin cambios en:

- `onclick` handlers (`ownerOpsNavLeadsSection`, `ownerOpsNavLead`, `ownerOpsNavCrm`, `ownerOpsNavAnalytics`)
- Drawer content / datos
- Permisos / rutas

---

## Validación localhost

| Check | Resultado |
|-------|-----------|
| HTTP 200 | ✅ |
| `.owner-ops-drawer-action-btn` en CSS servido | ✅ |
| Markup sin `btn secondary` en drawer | ✅ |
| Revisión visual PO con sesión Staff | **PENDIENTE** |

---

## Rollback

Restaurar `btn secondary small` en `navBtns` y eliminar bloque CSS `.owner-ops-drawer-action-btn`.

---

*DATAGRID-006 · sin push*
