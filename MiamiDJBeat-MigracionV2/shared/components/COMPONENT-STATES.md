# COMPONENT-STATES.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Estados  
**Versión:** 1.0

> Mapeo a `../design-system/INTERACTION-STATES.md` — aplicación **por componente** en runtime.

---

## Estados comunes (inventario)

| Estado | Descripción | DS ref |
|--------|-------------|--------|
| **Default** | Resting | INTERACTION-STATES Default |
| **Hover** | Pointer over | Hover |
| **Focus** | Keyboard focus | Focus |
| **Pressed** | Active press | Pressed |
| **Selected** | Toggle/list selection | Active variant |
| **Disabled** | Non-interactive | Disabled |
| **Loading** | Async pending | Loading |
| **Empty** | No content | Empty |
| **Success** | Positive feedback | Success |
| **Warning** | Caution | Warning |
| **Error** | Failure/validation | Error |
| **Offline** | Network unavailable | Info + icon ADR |
| **Skeleton** | Placeholder load | Loading skeleton |

---

## Aplicabilidad por categoría

| Categoría | Estados típicos |
|-----------|-----------------|
| Buttons | Default, Hover, Focus, Pressed, Disabled, Loading |
| Inputs | Default, Focus, Disabled, Error, Success |
| Cards | Default, Hover (if clickable), Selected |
| Tables | Default, Loading, Empty, Error |
| Modals/Dialogs | Default, Loading (content) |
| Lists | Default, Empty, Loading, Skeleton |
| Alerts | Success, Warning, Error, Info |
| Media | Loading, Error, Default |
| Uploads | Default, Loading, Success, Error |

---

## Selected vs Pressed

| State | Uso |
|-------|-----|
| **Pressed** | Momentary click |
| **Selected** | Persistent — tabs, list item, toggle |

---

## Offline

| Element | Rule |
|---------|------|
| Indicator | Banner or inline — `MdjOfflineBanner` |
| Actions | Disable network-dependent with tooltip key ADR |
| Not a substitute | Connection logic in API Client — UI only |

---

## Skeleton

| Rule | Detail |
|------|--------|
| SK-01 | Use surface.elevated pulse |
| SK-02 | Respect reduced motion — static skeleton ADR |
| SK-03 | Match layout dimensions — anti layout shift |

---

## State precedence

```
Disabled > Loading > Error > Default
Focus visible concurrent with Hover
```

---

*COMPONENT-STATES v1.0 — TICKET-V2-SHARED-CORE-017*
