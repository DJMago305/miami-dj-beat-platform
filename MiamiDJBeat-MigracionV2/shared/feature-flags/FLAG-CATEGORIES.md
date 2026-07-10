# FLAG-CATEGORIES.md

**TICKET-V2-SHARED-CORE-015 — Feature Flags Specification**

**Módulo:** MOD-013 · Tipos y categorías  
**Versión:** 1.0

---

## Tipos de Feature Flags

| Tipo | Propósito | Owner | Default | Ejemplo key |
|------|-----------|-------|---------|-------------|
| **Release Flags** | Gradual enable módulo post-spec | PO | `false` | `flag.mod-101.client-shell` |
| **Experimental Flags** | Prototipos no productivos | PO + Architect | `false` | `flag.mod-202.artist-nav-beta` |
| **Development Flags** | Solo lab local/dev | Architect | env-gated | `flag.dev.verbose-boot` |
| **Emergency Flags** | Kill-switch incidente | PO | `false` | `flag.emergency.checkout-off` |
| **Portal Flags** | Feature por portal shell | PO | per portal | `flag.portal.artist.academia-strip` |
| **Module Flags** | Boundary MOD-xxx completo | PO | `false` | `flag.mod-013.flags-v2-runtime` |
| **Infrastructure Flags** | Core infra behavior | Architect | conservador | `flag.infra.event-bus-strict` |
| **Maintenance Flags** | Modo mantenimiento UX | PO | `false` | `flag.global.maintenance-banner` |

---

## Matriz tipo × categoría

| Tipo ↓ / Categoría → | Global | Portal | Module | Feature | Experiment | Environment | User Pref | Emergency |
|----------------------|--------|--------|--------|---------|------------|-------------|-----------|-----------|
| Release | ✅ | ✅ | ✅ | ✅ | ○ | ✅ | ○ | ○ |
| Experimental | ○ | ✅ | ✅ | ✅ | ✅ | ✅ | ○ | ○ |
| Development | ✅ | ○ | ○ | ✅ | ○ | ✅ | ○ | ○ |
| Emergency | ✅ | ✅ | ✅ | ✅ | ○ | ✅ | ○ | ✅ |
| Portal | ○ | ✅ | ○ | ✅ | ○ | ○ | ○ | ○ |
| Module | ○ | ○ | ✅ | ○ | ○ | ○ | ○ | ○ |
| Infrastructure | ✅ | ○ | ✅ | ○ | ○ | ✅ | ○ | ○ |
| Maintenance | ✅ | ✅ | ○ | ○ | ○ | ○ | ○ | ✅ |

✅ = combinación permitida · ○ = raro — requiere ADR

---

## Categorías de resolución

### Global

Afecta todo MiamiDJBeat-MigracionV2 lab. Resolución sin `portal` context.

→ Ejemplo: `flag.global.maintenance-banner`

### Portal

Scope `client` | `artist` | `staff`. Requiere portal context en resolve.

→ Ejemplo: `flag.portal.staff.crm-v2`

### Module

Atado a MOD-xxx del Module Catalog. Cutover unitario.

→ Ejemplo: `flag.mod-108.shop-buyer`

### Feature

Sub-capacidad dentro de un módulo ya enabled. Depende often de Module Release flag true.

→ Ejemplo: `flag.mod-104.orders-export-csv`

### Experiment

Cohort / A-B futuro. **No** sustituye Permissions. Default `false` prod.

→ Ejemplo: `flag.experiment.checkout-flow-b`

### Environment

Locked por env rules — dev/staging/prod matrix en FLAG-CONTRACT.

→ Ejemplo: `flag.env.supabase-mock`

### User Preference

Opt-in usuario futuro (UI settings). **No** eleva permisos. Storage optional ADR.

→ Ejemplo: `flag.pref.beta-dashboard-opt-in`

### Emergency

Override PO — audit log CRITICAL. Puede force false aunque config true.

→ Ejemplo: `flag.emergency.payments-pause`

---

## Prioridad de categoría en conflicto

```
Emergency > Environment lock > Module > Portal > Feature > Global default
```

Capability check **siempre** después de flag resolution.

---

## Registro en catálogo

Nueva flag requiere:

1. Entrada en registry documentado (futuro JSON/YAML ADR)
2. Ticket PO
3. Entrada Module Catalog si nuevo MOD boundary
4. Sin duplicar en portal-local constants

---

*FLAG-CATEGORIES v1.0 — TICKET-V2-SHARED-CORE-015*
