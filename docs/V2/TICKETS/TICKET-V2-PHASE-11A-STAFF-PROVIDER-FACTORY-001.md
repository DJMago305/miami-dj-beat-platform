# TICKET-V2-PHASE-11A-STAFF-PROVIDER-FACTORY-001

## Estado

**IMPLEMENTADO, PROBADO, VALIDADO VISUALMENTE POR PRODUCT OWNER Y COMMITTEADO LOCALMENTE**

| Campo | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| Commit | `577cb4a8d82ea789b5a2ec6ec9cf834be931de2` |
| Mensaje commit | `feat(v2-staff): add provider factory` |
| HEAD pre-implementación | `c897fc5a8eddc09b6871458335aa592d34a2baa0` — `feat(v2-staff): add dashboard data contracts` |
| Discovery previo | `TICKET-V2-PHASE-11-STAFF-RUNTIME-ADAPTER-DISCOVERY-001` (read-only) |
| Suite final | **776/776 PASS** · **57/57 files** |
| Typecheck | exit 0 |
| Validación visual Safari | ✅ Aprobada PO |
| Push / PR / merge / deploy | ❌ NO AUTORIZADO |

---

## Problema arquitectónico resuelto

Phase 10 introdujo `StaffDashboardDataProvider`, pero el portal lo resolvía de forma **implícita** dentro del renderer (`getDefaultStaffDashboardDataProvider()`). No existía un punto único de entrada portal-local.

Phase 11-A cierra el gap:

| Antes | Después |
|-------|---------|
| Renderer conoce resolución default | Factory única en `staff/data/` |
| Sin inyección desde entry point | `main.ts` resuelve una vez e inyecta |
| Acoplamiento futuro a transporte posible en renderer | Renderer recibe interface — sin ApiClient/Supabase/RPC/fetch/Session |

---

## Factory

**Archivo:** `MiamiDJBeat-MigracionV2/staff/data/staff-dashboard-provider-factory.ts`

### API pública

```typescript
resolveStaffDashboardDataProvider(): StaffDashboardDataProvider
setStaffDashboardDataProviderForTests(provider: StaffDashboardDataProvider): void
resetStaffDashboardDataProviderForTests(): void
```

### Reglas Phase 11-A

1. Devuelve `StaffDashboardDataProvider`.
2. Implementación activa: **mock/default únicamente**.
3. No inspecciona Session ni permisos.
4. No llama API · no lee env productivo.
5. Delega al singleton existente en `staff-dashboard-data-provider.ts` — sin duplicar estado.
6. Determinístico — dos resoluciones normales retornan la misma instancia.
7. Override/reset explícitos para tests.

---

## Integración `main.ts`

```typescript
const boot = bootScaffold(undefined, 'staff');
if (boot.ok) {
  applyStaffPreviewRoleForDev();
}
const staffDataProvider = resolveStaffDashboardDataProvider();
// ...
renderStaffDashboardMvp(mainRegion, staffDataProvider);
```

Secuencia preservada: `bootScaffold()` → `applyStaffPreviewRoleForDev()` → render. Permisos y provider **independientes**.

---

## Integración `render-staff-dashboard-mvp.ts`

```typescript
export function renderStaffDashboardMvp(
  mainRegion: HTMLElement,
  dataProvider: StaffDashboardDataProvider = resolveStaffDashboardDataProvider(),
): void {
  // ...
  createOperationsPreviewSection(themeBinding, dataProvider),
}
```

Default vía factory mantiene compatibilidad con tests existentes; producción inyecta desde `main.ts`.

---

## Alcance explícitamente NO modificado

| Área | Estado |
|------|--------|
| Runtime real · Supabase · RPC · fetch | ❌ Sin integración |
| Session · Permissions · Bootstrap | ❌ Sin cambio |
| `dashboard-mvp-data.ts` | ❌ Sin unificación — Phase 11-B |
| DOM/CSS · mock data values | ❌ Sin cambio visual |
| Asincronía · loading states | ❌ No introducidos |
| `web/` · V1 | ❌ Intacto |

---

## Tests

**Archivo:** `MiamiDJBeat-MigracionV2/tests/unit/staff-dashboard-provider-factory.test.ts` — **10 tests**

| # | Escenario |
|---|-----------|
| 1 | Factory devuelve mock por defecto |
| 2 | Dos resoluciones determinísticas (misma instancia) |
| 3 | No depende de Session |
| 4 | No depende de permisos/preview roles |
| 5 | Provider sustituido llega al renderer |
| 6 | Reset restaura mock |
| 7 | Provider vacío → 0 métricas · 0 eventos · 6 capability cards |
| 8 | Owner 6/6 · Manager 6/6 · Seller 1/6 con provider vacío |
| 9 | Mock default intacto en renderer (4 métricas · 4 eventos) |
| 10 | Sin llamadas `fetch` al resolver |

---

## Validación Safari (Product Owner)

| Rol | Lifecycle | Capabilities ON |
|-----|-----------|-----------------|
| Guest | `SESSION_READY` | 0/6 |
| Owner | `SESSION_READY` | 6/6 |
| Manager | `SESSION_READY` | 6/6 |
| Seller | `SESSION_READY` | 1/6 |

Mock metrics (4) · mock events (4) · layout intacto · sin overflow.

---

## Archivos del commit

| Acción | Archivo |
|--------|---------|
| Creado | `staff/data/staff-dashboard-provider-factory.ts` (+26) |
| Creado | `tests/unit/staff-dashboard-provider-factory.test.ts` (+271) |
| Modificado | `staff/main.ts` (+4/−1) |
| Modificado | `staff/render-staff-dashboard-mvp.ts` (+9/−2) |

**Total:** 4 archivos · +307 / −3 líneas.

---

## Commit

```
577cb4a8d82ea789b5a2ec6ec9cf834be931de2
feat(v2-staff): add provider factory
```

Commit ejecutado manualmente por Product Owner — entorno Cursor bloqueó `git commit` por inyección automática de `Co-authored-by` (Regla 13 / DECISION-V2-012).

---

## Riesgos residuales

| Riesgo | Fase futura |
|--------|-------------|
| Dual data source (`dashboard-mvp-data.ts`) | 11-B unification |
| Default implícito en `createOperationsPreviewSection` | 11-B |
| Runtime adapter Supabase/RPC | 11-C+ — ticket PO |

---

## Próximo paso recomendado

**`TICKET-V2-PHASE-11B-STAFF-DASHBOARD-PROVIDER-UNIFICATION-001`**

Migrar resto de secciones MVP dashboard desde `dashboard-mvp-data.ts` hacia `StaffDashboardDataProvider` — mock-only; sin Session · Permissions · Bootstrap · Supabase · RPC · producción.

*Ticket histórico — documentación TICKET-V2-END-OF-DAY-DOCUMENTATION-2026-07-20-001*