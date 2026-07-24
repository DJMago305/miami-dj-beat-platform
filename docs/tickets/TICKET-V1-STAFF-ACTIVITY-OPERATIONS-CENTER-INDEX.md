# Staff Activity Operations Center — Índice V1 (DATAGRID-001–006)

**Módulo:** Staff Portal → **Actividad operativa** (`#actividad` · `web/admin-dashboard.html`)  
**Predecesor:** [TICKET-V1-OWNER-OPS-FEED-MVP-001](./TICKET-V1-OWNER-OPS-FEED-MVP-001.md) (feed vertical MVP)  
**Última alineación:** 2026-07-24 — **sesión cerrada · PO aprobó visual localhost**
**Commit funcional:** `56b36209ff7d189e39d1e6c3eae09bfc017d0196`
**HEAD rama (referencia):** `314d6f8` — ver [SESSION-LOG-2026-07-24.md](../sessions/SESSION-LOG-2026-07-24.md)
**Push / prod:** pendiente **`APROBADO PUSH`** / **`APROBADO DEPLOY PRODUCCIÓN`**

---

## Resumen del módulo

Evolución UI-only del feed operativo a **Data Grid CRM** con:

- Mismas fuentes SELECT V1 (`leads`, `client_profiles`, `dj_profiles`, `portal_messages`, `platform_inbox`, `payments`)
- Filtros categoría + búsqueda + fecha/estado/tipo
- Ordenamiento por columnas
- Drawer detalle solo lectura
- Acciones de navegación (Leads, Portal, CRM, Analytics)

**Sin cambios:** backend, Supabase, RPC, Stripe, migraciones.

---

## Tickets de la serie

| Ticket | Título | Alcance |
|--------|--------|---------|
| [DATAGRID-001](./TICKET-V1-STAFF-ACTIVITY-DATAGRID-001.md) | Data Grid base | Feed → tabla, filtros, orden, drawer, acciones fila |
| [DATAGRID-002](./TICKET-V1-STAFF-ACTIVITY-DATAGRID-002.md) | Layout | Ancho panel, quitar copy dev, densidad vertical |
| [DATAGRID-003](./TICKET-V1-STAFF-ACTIVITY-DATAGRID-003.md) | Search relocation | Buscador en barra filtros + lupa SVG |
| [DATAGRID-004](./TICKET-V1-STAFF-ACTIVITY-DATAGRID-004.md) | Header sólido | Sticky sin bleed-through (`#B8923A`) |
| [DATAGRID-005](./TICKET-V1-STAFF-ACTIVITY-DATAGRID-005.md) | Search refinement | Ancho 420px+, placeholder `Search` |
| [DATAGRID-006](./TICKET-V1-STAFF-ACTIVITY-DATAGRID-006.md) | Drawer buttons | Contraste botones acción (`.owner-ops-drawer-action-btn`) |

---

## Archivos runtime

| Archivo | Rol |
|---------|-----|
| `web/admin-dashboard.html` | UI + JS `loadOwnerOpsFeed` / `renderOwnerOpsFeed` / drawer |

---

## Funciones JS (sin cambio de contrato de datos)

| Función | Rol |
|---------|-----|
| `loadOwnerOpsFeed()` | SELECT agregado (MVP) |
| `renderOwnerOpsFeed()` | Grid + filtros client-side |
| `_ownerOpsApplyGridFilters()` | Búsqueda, fecha, estado, tipo, sort |
| `openOwnerOpsDetail()` | Drawer solo lectura |
| `ownerOpsNavLead` / `ownerOpsNavLeadsSection` / `ownerOpsNavCrm` / `ownerOpsNavAnalytics` | Navegación |

---

## QA localhost

| URL | Check |
|-----|-------|
| `http://localhost:8080/admin-dashboard.html#actividad` | Grid, search, header sólido, drawer |

Sesión staff con datos reales: **PO aprobó visual** (2026-07-24).

---

## Próximo trabajo V1 (post-sesión)

**No** refinamiento UI del grid. Siguiente foco funcional: **Manual Offline Payments** — ver [CONTINUITY-AUDIT-001](./TICKET-V1-CONTINUITY-AUDIT-001.md).

---

## Rollback

Revertir commit local DATAGRID-001–006 en `web/admin-dashboard.html` (restaura feed MVP parcialmente — preferir checkout commit anterior + re-aplicar OWNER-OPS si necesario).

---

*V1 Staff Activity Operations Center · no V2 · no producción sin PO*
