# TICKET-V2-PHASE-11B-STAFF-DASHBOARD-PROVIDER-UNIFICATION-001

## Estado

**IMPLEMENTADO · VALIDADO VISUALMENTE POR EL PRODUCT OWNER · PENDIENTE COMMIT LOCAL**

| Campo | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| HEAD base (Phase 11-A) | `577cb4a8d82ea789b5a2ec6ec9cf834be931de2` — `feat(v2-staff): add provider factory` |
| Cierre documental | `TICKET-V2-PHASE-11B-CLOSURE-DOCUMENTATION-001` |
| Suite final | **786/786 PASS** · **58/58 files** |
| Typecheck | exit 0 |
| Localhost | `http://localhost:5173/staff/` |
| Push / PR / merge / deploy | ❌ NO AUTORIZADO |

---

## Objetivo

Completar la unificación del dashboard MVP Staff para que **toda** la fuente de datos operativa sea `StaffDashboardDataProvider`, eliminando imports directos de `dashboard-mvp-data.ts` en el renderer, sin conectar infraestructura externa ni alterar la apariencia aprobada.

---

## Alcance

| Incluido | Excluido |
|----------|----------|
| Extender provider con `getMvpView()` | Supabase · RPC · Edge · fetch |
| Migrar renderer a consumo vía provider | Session · Permissions · Bootstrap |
| Inyección obligatoria desde `main.ts` | CSS · HTML · cambios visuales |
| Tests de unificación + roles | Phase 11-C |
| Corrección inyección explícita (sin default en renderer) | Eliminación de `dashboard-mvp-data.ts` |

---

## Restricciones respetadas

- Mock-only · determinístico · síncrono.
- Permisos vía `hasSessionCapability()` — independientes del provider.
- `dashboard-mvp-data.ts` permanece como fixture detrás del provider.
- Sin service locator global · sin factory en renderer.
- Documentación histórica Phase 10/11-A no alterada.

---

## Baseline

| Gate | Pre-implementación |
|------|-------------------|
| HEAD | `577cb4a8d82ea789b5a2ec6ec9cf834be931de2` |
| Typecheck | exit 0 |
| Tests | 776/776 · 57/57 files |

---

## Archivos modificados (implementación)

| Archivo | Cambio |
|---------|--------|
| `MiamiDJBeat-MigracionV2/staff/data/staff-dashboard-data-provider.ts` | Tipos `StaffDashboardMvpView` · `getMvpView()` · fixture desde `dashboard-mvp-data.ts` |
| `MiamiDJBeat-MigracionV2/staff/render-staff-dashboard-mvp.ts` | Elimina import `dashboard-mvp-data` · consume `getMvpView()` · parámetro `dataProvider` obligatorio |
| `MiamiDJBeat-MigracionV2/tests/unit/staff-dashboard-data-provider.test.ts` | +1 test `getMvpView()` |
| `MiamiDJBeat-MigracionV2/tests/unit/staff-dashboard-provider-factory.test.ts` | Ajuste `createTestProvider` + provider explícito en render |
| `MiamiDJBeat-MigracionV2/tests/unit/staff-dashboard-mvp.test.ts` | Provider explícito en render |
| `MiamiDJBeat-MigracionV2/tests/unit/staff-preview-role.test.ts` | Provider explícito en render |
| `MiamiDJBeat-MigracionV2/tests/unit/staff-dashboard-provider-unification.test.ts` | **Nuevo** — 9 tests Phase 11-B |

**Sin cambio funcional:** `staff/main.ts` · `staff-dashboard-provider-factory.ts` · `dashboard-mvp-data.ts` (contenido fixture).

---

## Decisión arquitectónica

### Problema

Post Phase 11-A persistía **dual data source**: Operations Preview vía provider; resto del MVP vía import directo de `dashboard-mvp-data.ts` en el renderer.

### Solución

1. Extender `StaffDashboardDataProvider` con `getMvpView()` — encapsula KPIs · profile · quick actions · leads · invoices · CRM · production · matching · reports · notifications · activity.
2. `staff-dashboard-data-provider.ts` importa fixtures de `dashboard-mvp-data.ts` — único punto de acoplamiento al mock físico.
3. `main.ts` resuelve provider vía factory e inyecta al renderer.
4. Renderer **no** resuelve dependencias — firma obligatoria:

```typescript
renderStaffDashboardMvp(mainRegion: HTMLElement, dataProvider: StaffDashboardDataProvider): void
```

### Flujo final

```
main.ts → resolveStaffDashboardDataProvider()
       → renderStaffDashboardMvp(main, provider)
       → provider.getMetrics() / getEvents() / getMvpView()
       → dashboard-mvp-data.ts (fixture interno del provider)
```

---

## Tests agregados

| Suite | Tests | Cobertura |
|-------|-------|-----------|
| `staff-dashboard-provider-unification.test.ts` | 9 | main→factory · renderer sin fixture/factory/default · mock content · Guest/Owner/Manager/Seller · contrato estable |
| `staff-dashboard-data-provider.test.ts` | +1 | `getMvpView()` mock aprobado |

**Total suite:** 786/786 PASS (+10 vs baseline 776).

---

## Matriz de capabilities (validación PO)

| Rol | Lifecycle | Capabilities ON | Veredicto PO |
|-----|-----------|-----------------|--------------|
| Guest | `SESSION_READY` | **0/6** | ✅ |
| Owner | `SESSION_READY` | **6/6** | ✅ |
| Manager | `SESSION_READY` | **6/6** | ✅ |
| Seller | `SESSION_READY` | **1/6** | ✅ |

Mock metrics (4) · mock events (4) · layout · textos · orden de secciones — intactos.

---

## Validación visual Product Owner

**COMPLETADA** — Safari · `http://localhost:5173/staff/` · preview roles owner/manager/seller.

Sin overflow · sin texto cortado · sin cambios visuales intencionales · Console/Network sin egress nuevo.

---

## Métricas finales

| Métrica | Valor |
|---------|-------|
| Typecheck | exit 0 |
| Test files | 58/58 PASS |
| Tests | 786/786 PASS |
| Archivos técnicos tocados | 7 (6 modificados + 1 nuevo test) |
| Commit Phase 11-B | ⏳ Pendiente PO |
| Push / deploy | ❌ NO |

---

## Próximos pasos sugeridos (sin abrir)

1. **Commit local Phase 11-B** — mensaje propuesto: `feat(v2-staff): unify dashboard provider` — solo con autorización PO.
2. **Phase 11-C** — runtime adapter lab stub implementando `StaffDashboardDataProvider` — sin Supabase producción · sin RPC · sin Session.
3. Push solo con **`APROBADO PUSH`** · deploy solo con **`APROBADO DEPLOY PRODUCCIÓN`**.

*Ticket histórico — cierre documental TICKET-V2-PHASE-11B-CLOSURE-DOCUMENTATION-001*