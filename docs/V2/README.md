# Miami DJ Beat — Documentación V2 (Baseline)

**Ticket:** TICKET-DOCS-V2-BASELINE-001  
**Estado:** Baseline indexado en repo  
**Fecha:** 2026-07-06  
**Alcance:** Solo documentación — **cero** cambios en `web/`, Supabase, Invoice, Cash Flow, Stripe o Header/Nav.

---

## Propósito

Este directorio es la **fuente documental oficial del laboratorio V2** (`MiamiDJBeat-MigracionV2`), aislado de producción V1.

La Constitución (`MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`) manda sobre cualquier documento inferior. El runtime V2 vive en la carpeta hermana `MiamiDJBeat-MigracionV2/` (scaffold local; **no** incluido en este commit salvo ticket explícito).

---

## Estado del Laboratorio

**Baseline:** TICKET-V2-BOOTLINE-BASELINE-001 (2026-07-06) — validación visual PO aprobada.  
**Cierre jornada V2:** TICKET-V2-END-OF-DAY-DOCUMENTATION-2026-07-06 — tres dashboards MVP · suite verde.
**Continuidad Fase 6:** TICKET-V2-PHASE-6-POST-RPC-DOCUMENTATION-001 (2026-07-12) — documentación sincronizada al HEAD `50fa2f5`.

### Continuidad operativa — MOD-005 API Client (2026-07-12)

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD** | `50fa2f5c54f864187dda80bb6a9c2a8753cf0460` — `feat(v2-api): add rpc facade` |
| **Tests unitarios (suite oficial)** | **559/559 PASS** · **48/48 files** (`npm test`) |
| **Localhost** | `http://localhost:5173` — Client · Artist · Staff HTTP 200 |
| **Push / PR / deploy** | NO |

| Superficie MOD-005 | Estado |
|--------------------|--------|
| `request` / verbos HTTP | ✅ Operativo en boot |
| `invokeEdge()` | ✅ + Edge Header Policy (`d4d9803`) |
| `rpc()` | ✅ (`50fa2f5`) |
| `FetchTransport` | ✅ implementado — **inactivo por defecto** (`api.transportMode` = `memory`) |
| Supabase adapter | ⏳ Pendiente |
| MOD-014 Error Bridge | ⏳ Pendiente |

Detalle: `NOTA-DIARIA-LAB-001.md` § Continuidad documental — 2026-07-12 · `SESSION-SUMMARIES/2026-07-11-PHASE-6-END-OF-DAY.md` § Actualización posterior al cierre — 2026-07-12.

### Continuidad — 2026-07-12 (cierre de sesión / ausencia PO)

| Campo | Valor |
|-------|-------|
| **HEAD committeado** | `671e0c0` — Session permissions wiring (`feat(v2-session): wire access permissions resolution`) |
| **Typecheck remediation** | ⏳ En working tree — `exit 0` — sin commit |
| **Phase 9 Staff Operations Preview** | ⏳ En working tree — validación visual PO pendiente |
| **Localhost** | `http://localhost:5173` — PID 99921 activo al cierre |
| **Suite** | 747/747 PASS (`npm test`) |
| **Próxima apertura** | Auditoría solo lectura obligatoria — ver `SESSION-SUMMARIES/2026-07-12-PHASE-8-9-END-OF-SESSION.md` |
| **Push / deploy** | ❌ No |

Handoff: `TICKET-V2-END-OF-SESSION-HANDOFF-2026-07-12-001.md`

### Continuidad — 2026-07-20

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD actual** | `577cb4a8d82ea789b5a2ec6ec9cf834be931de2` — `feat(v2-staff): add provider factory` |
| **Commit Phase 10** | `c897fc5a8eddc09b6871458335aa592d34a2baa0` — `feat(v2-staff): add dashboard data contracts` |
| **Commit Phase 11-A** | `577cb4a8d82ea789b5a2ec6ec9cf834be931de2` — `feat(v2-staff): add provider factory` |
| **Phase 8 typecheck remediation** | ✅ `77e969d` — committeada |
| **Phase 9 Operations Preview** | ✅ `5825681` · preview permissions corregidas · **VALIDADO VISUALMENTE POR EL PRODUCT OWNER** |
| **Suite** | **776/776 PASS** · **57/57 files** · typecheck exit 0 |
| **Vite** | PID 88949 · `http://localhost:5173` |
| **Working tree** | ✅ Limpio |
| **Push / PR / merge / deploy** | ❌ NO |

#### Estado del dashboard Staff

| Área | Fuente de datos | Estado |
|------|-----------------|--------|
| Operations Preview — métricas · eventos | `StaffDashboardDataProvider` vía factory | ✅ Unificado (Phase 10–11-A) |
| Operations Preview — capability cards | `hasSessionCapability()` / preview role | ✅ Independiente del provider |
| KPIs · profile · leads · invoices · production · matching · CRM · reports · activity · notifications | `dashboard-mvp-data.ts` directo | ⏳ Pendiente unificación Phase 11-B |

#### Qué quedó desacoplado (Phase 11-A)

- `staff/main.ts` resuelve el provider **una vez** con `resolveStaffDashboardDataProvider()`.
- `renderStaffDashboardMvp()` recibe `StaffDashboardDataProvider` — no conoce transporte (ApiClient · Supabase · RPC · fetch · Session).
- Permisos y preview roles permanecen en `staff-preview-role.ts` — **sin mezcla** con el data layer.

#### Qué permanece en `dashboard-mvp-data.ts`

`STAFF_DASHBOARD_KPIS` · `STAFF_PROFILE` · `STAFF_QUICK_ACTIONS` · `STAFF_LEADS` · `STAFF_INVOICES` · `STAFF_PRODUCTION` · `STAFF_MATCHING` · `STAFF_CRM` · `STAFF_REPORTS` · `STAFF_ACTIVITY` · `STAFF_NOTIFICATIONS` — consumidos directamente por `render-staff-dashboard-mvp.ts` fuera de Operations Preview.

#### Próxima fase recomendada (sin abrir)

`TICKET-V2-PHASE-11C-STAFF-RUNTIME-ADAPTER-LAB-001` (o equivalente PO) — adapter lab stub sobre `StaffDashboardDataProvider`; sin Supabase producción · sin RPC · sin Session changes.

Detalle: `NOTA-DIARIA-LAB-001.md` § Cierre de jornada — 2026-07-20 · `SESSION-SUMMARIES/2026-07-20-PHASE-10-11A-END-OF-SESSION.md`.

> La sección «Continuidad — 2026-07-12» arriba conserva el handoff histórico al cierre de sesión del 12 de julio.

### Phase 11-B — Staff dashboard provider unification (2026-07-20)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ **Completada** · **VALIDADA VISUALMENTE POR EL PRODUCT OWNER** |
| **HEAD base (pre-commit 11-B)** | `577cb4a8d82ea789b5a2ec6ec9cf834be931de2` — `feat(v2-staff): add provider factory` |
| **Suite** | **786/786 PASS** · **58/58 files** · typecheck exit 0 |
| **StaffDashboardDataProvider** | Consolidado — Operations Preview + MVP dashboard vía `getMvpView()` |
| **Renderer** | Desacoplado de `dashboard-mvp-data.ts` — inyección obligatoria desde `main.ts` |
| **Fixtures** | `dashboard-mvp-data.ts` permanece como mock interno del provider |
| **Futuro** | Dashboard preparado para fuentes reales sin tocar renderer |
| **Commit / push** | ⏳ Pendiente autorización PO |

Detalle: `NOTA-DIARIA-LAB-001.md` § Cierre técnico — Phase 11-B · `SESSION-SUMMARIES/2026-07-20-PHASE-11B-CLOSURE.md` · `TICKETS/TICKET-V2-PHASE-11B-STAFF-DASHBOARD-PROVIDER-UNIFICATION-001.md`.

### Estado actual (módulos operativos local)

| Módulo | Estado |
|--------|--------|
| ✅ **MOD-002** Sessions | LOCKED LOCAL (DECISION-V2-005) |
| ✅ **MOD-003** Permissions | LOCKED LOCAL — completo Fases 1–5C (DECISION-V2-009) |
| ✅ **MOD-007** Theme Manager | Operativo local — registry · resolver · runtime · boot integration |
| ✅ **MOD-008** Portal Shell | Operativo visual localhost |
| ✅ **MOD-009** Components Foundation | Descriptores MVP commiteados (`c0f94eb`) |
| ✅ **MOD-010** Client Dashboard MVP | Commiteado (`abdf3d2`) |
| ✅ **MOD-011** Artist Dashboard MVP | Commiteado (`5ef4362`) |
| ✅ **MOD-012** Staff Dashboard MVP | Commiteado (`51e0b4c`) |
| ✅ **MOD-005** API Client | Operativo en boot — `invokeEdge()` · `rpc()` · headers Supabase · ver continuidad 2026-07-12 arriba |

### Métricas al cierre 2026-07-06

| Métrica | Resultado |
|---------|-----------|
| **Tests unitarios** | **297/297** PASS |
| **E2E Playwright** | **3/3** PASS |
| **Localhost** | Client · Artist · Staff dashboards operativos |
| **Git HEAD** | `f73f9bb` — `fix(v2-theme): restore public theme exports` |
| **Push / PR** | NO |

Detalle jornada: `SESSION-SUMMARIES/2026-07-06.md` · nota operativa: `../NOTA-DIARIA-2026-07-06.md` § CIERRE DE JORNADA.

---

### MOD-002 (histórico baseline)

| Campo | Valor |
|-------|-------|
| **Módulo** | Session Manager |
| **Estado** | ✅ **LOCKED LOCAL** (DECISION-V2-005) |

### MOD-003

| Fase | Entregable | Commit |
|------|------------|--------|
| **Fase 1** | Capability Registry | `5f3547d` |
| **Fase 2** | Profile Matrix + Role Matrix Bridge | `24339a1` |
| **Fase 3A** | Permission Resolver | `aa702ff` |
| **Fase 3B** | Session Permission Snapshot | `fb78b1e` |
| **Fase 4** | Route Guards — `canActivateRoute()` · 47 rutas | `eb8372d` |
| **Fase 5A** | Component Map — 52 componentes | `aa6d9e4` |
| **Fase 5B** | Component Guards — `canRenderComponent()` / `canEnableComponent()` / `canUseAction()` | `abe188c` |
| **Fase 5C** | Portal Wires — client 12 · artist 14 · staff 26 | `fdc69fa` · `3ba23d8` · `f6451e5` |

| Métrica | Resultado |
|---------|-----------|
| **Tests** | **234/234** unitarios |
| **E2E** | **3/3** Playwright |
| **Visual** | PO aprobado — client · artist · staff |
| **Estado** | **LOCKED LOCAL** (DECISION-V2-009) |

Estado actual (histórico 2026-07-06 — conservado):

- ✅ **Scaffold operativo** — Vite en puerto 5173; tres portales (Client · Artist · Staff) responden HTTP 200.
- ✅ **Boot validado** — Config loaded · Bus ready · Logging ready · Error Handler ready · Session ready.
- ✅ **MOD-002 Session Manager** — **LOCKED LOCAL** — 6 fases commiteadas (**sin push / sin PR**).
- ✅ **MOD-003 Permissions** — **completo** — Fases 1–5C commiteadas; wires resolve-only (**sin push / sin PR**).
- ✅ **Tests aprobados (2026-07-06)** — **234/234** unitarios · **3/3** e2e Playwright.
- ✅ **Validación visual PO** — `Session: ready` · `Business logic: false` — sin cambio visual.
- ✅ **Sin integración Supabase (2026-07-06)** — sin egress API funcional ni auth real en runtime V2.

Estado actual (continuidad 2026-07-12 — ver sección MOD-005 arriba):

- ✅ **MOD-005 API Client** — boot `API_READY` · `invokeEdge()` · `rpc()` · Edge Header Policy · **559/559** tests.
- ✅ **FetchTransport** — disponible; boot default **memory** (sin egress).
- ⏳ **Supabase adapter** · **MOD-014 bridge** · consumidores dominio — pendientes.
- ❌ **Push / deploy** — no autorizado.

Detalle MOD-002: `SESSION-SUMMARIES/2026-07-05.md` § MOD-002 Session Manager — Closeout Local (2026-07-06).  
Detalle MOD-003: `SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Permissions Complete Local Baseline (2026-07-06).  
Detalle boot scaffold: § Validación Localhost — 2026-07-06.

---

## Jerarquía documental

| Nivel | Documento | Rol |
|-------|-----------|-----|
| 1 — Máxima | `MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Constitución del proyecto |
| 2 — Decisiones | `../DECISIONS.md` | Registro oficial DECISION-V2-001 … 012 |
| 3 — Gobernanza | `GOVERNANCE/` | Pipeline agentes, gates, autorización |
| 4 — Operación | `NOTA-DIARIA-OPERACION-PERMANENTE.md` | Guía operativa diaria |
| 5 — Arquitectura | `ARCHITECTURE/` | Handbook + mapas (boot, deps, events, errors) |
| 6 — Diseño | `MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` · `MiamiDJBeat-V2-MODULE-CATALOG.md` · `MiamiDJBeat-V2-ARQUITECTURA-VIVA.md` | Blueprint y catálogo MOD |
| 7 — Lab fundacional | `../V2-LAB/` | Visión, reglas, roadmap del laboratorio |
| 8 — Progreso | `SHARED-CORE-PROGRESS.md` · `MiamiDJBeat-MigracionV2-MEMORIA.md` | Tablero y memoria ejecutiva |
| 9 — Sesiones | `SESSION-SUMMARIES/` | Resúmenes técnicos por jornada |

---

## Mapa de archivos (`docs/V2/`)

### Raíz

| Archivo | Descripción |
|---------|-------------|
| `MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Constitución V2 — separación permanente V1/V2 |
| `MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Governance Baseline PO (v3.1) |
| `MiamiDJBeat-V2-ARQUITECTURA-VIVA.md` | Arquitectura viva — capas y portales |
| `MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` | Blueprint sistema |
| `MiamiDJBeat-V2-MODULE-CATALOG.md` | Catálogo MOD-xxx Shared Core |
| `MiamiDJBeat-MigracionV2-MEMORIA.md` | Memoria ejecutiva migración |
| `PROFILE-TAXONOMY.md` | Client Profile Types · Staff Roles · Artist Categories |
| `SHARED-CORE-PROGRESS.md` | Tablero documental Shared Core (16 MOD) |
| `NOTA-DIARIA-LAB-001.md` | Nota fundacional del laboratorio |
| `NOTA-DIARIA-OPERACION-PERMANENTE.md` | Operation Guide permanente |

### `ARCHITECTURE/`

| Archivo | Descripción |
|---------|-------------|
| `ARCHITECTURE-HANDBOOK.md` | Puerta de navegación documental |
| `MODULE-INDEX.md` | Índice de módulos |
| `BOOT-SEQUENCE.md` | Secuencia de arranque |
| `DEPENDENCY-MAP.md` | Grafo de dependencias |
| `EVENT-MAP.md` | Mapa de eventos |
| `ERROR-MAP.md` | Mapa de errores |
| `CONTRACT-INDEX.md` | Índice de contratos |
| `DECISION-INDEX.md` | Índice ADR / decisiones técnicas |
| `GLOSSARY.md` | Glosario |

### `GOVERNANCE/`

Ver `GOVERNANCE/README.md` — pipeline agente, checklist violaciones, formulario autorización, startup gate.

### `SESSION-SUMMARIES/`

| Archivo | Descripción |
|---------|-------------|
| `2026-07-05.md` | Resumen técnico extendido — jornada fundacional Shared Core |
| `2026-07-06.md` | Cierre jornada — MOD-007 · dashboards MVP · gobernanza · suite verde |
| `PROFILE-TAXONOMY.md` | Taxonomía perfiles recuperables Client · Artist · Staff (pre MOD-003) |

---

## Documentos en raíz `docs/` (relacionados)

| Archivo | Relación con V2 |
|---------|-----------------|
| `DECISIONS.md` | Registro oficial de DECISION-V2-001 … 009 |
| `NOTA-DIARIA-2026-07-05.md` | Cabecera operativa del día (cierre fase fundacional). Detalle → `SESSION-SUMMARIES/2026-07-05.md` |
| `NOTA-DIARIA-2026-07-06.md` | Nota operativa del día — V1 Invoice/Cash Flow + **§ CIERRE DE JORNADA V2** |

---

## Laboratorio (`docs/V2-LAB/`)

Índice completo: [`../V2-LAB/README.md`](../V2-LAB/README.md)

Ocho documentos fundacionales (01–08): visión, arquitectura, reglas, migración, estructura, prohibiciones, quality gates, roadmap.

---

## V1 crossover — Owner strip (traceabilidad)

Tickets P0 de **runtime V1** (`web/mdj-shared-header.js`, `dj-profile.html`). Documentados aquí por trazabilidad con el contrato V2 `OWNER_STRIP_READY`; **no** son specs del laboratorio V2.

| Ticket | Estado al baseline | Notas |
|--------|-------------------|-------|
| `../tickets/TICKET-P0-OWNER-STRIP-CONTRACT-V2-001.md` | Implementado — QA visual PO pendiente | Contrato `OWNER_STRIP_READY` en dj-profile |
| `../tickets/TICKET-P0-OWNER-STRIP-LIFECYCLE-INVESTIGATION-001.md` | Abierto — solo investigación | Sin parches autorizados en header |
| `../tickets/TICKET-P0-OWNER-STRIP-STAFF-LOCAL-PROD-PARITY-001.md` | Abierto — paridad STAFF/orden | Distinto de fix Mi Perfil (PR #116 `f69b66e`) |

---

## Decisiones selladas (resumen)

| ID | Título | Doc |
|----|--------|-----|
| DECISION-V2-001 | Constitución oficial | `MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` |
| DECISION-V2-002 | Documentation First | `SHARED-CORE-PROGRESS.md` |
| DECISION-V2-003 | Runtime stack (TS/Vite/Vitest) | `MiamiDJBeat-MigracionV2/docs/adr/ADR-DECISION-V2-003-RUNTIME-STACK.md` |
| DECISION-V2-004 | Bootline baseline localhost | `SESSION-SUMMARIES/2026-07-05.md` § Validación Localhost — 2026-07-06 |
| DECISION-V2-005 | MOD-002 Session Manager local baseline | `SESSION-SUMMARIES/2026-07-05.md` § MOD-002 Closeout — 2026-07-06 |
| DECISION-V2-006 | MOD-003 Permissions local checkpoint (Fases 1–2) | `SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Local Checkpoint — 2026-07-06 |
| DECISION-V2-007 | MOD-003 Permissions Core local baseline (Fases 1–3B) | `SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Closeout Local — 2026-07-06 |
| DECISION-V2-008 | MOD-003 Route Guards local baseline (Fase 4) | `SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Route Guards Closeout Local — 2026-07-06 |
| DECISION-V2-009 | MOD-003 Permissions complete local baseline (Fases 1–5C) | `SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Permissions Complete Local Baseline — 2026-07-06 |
| DECISION-V2-010 | Gobernanza prevalece sobre criterio técnico | `../DECISIONS.md` · `SESSION-SUMMARIES/2026-07-06.md` |
| DECISION-V2-011 | Prohibición alcance fuera de ticket sin Informe Técnico | `../DECISIONS.md` · Regla 11/12 |
| DECISION-V2-012 | Integridad mensajes commit — sin trailers no autorizados | `../DECISIONS.md` · Regla 13 |

Detalle completo: [`../DECISIONS.md`](../DECISIONS.md).

---

## MOD-002 Session Manager — resumen closeout (local)

| Fase | Entregable | Commit local (`main`) |
|------|------------|------------------------|
| 1 | State Machine (9 estados, tabla de transiciones, tests) | `0a0a556` |
| 2 | SessionProvider + SessionStore (facade, snapshot inmutable) | `c14c3d0` |
| 3 | Event Bus wiring (listeners idempotentes, eventos SESSION_*) | `9878ffc` |
| 4 | Hydration + Restore (`PersistencePort` noop/in-memory) | `131fba9` |
| 5 | Auth Handoff Boundary (`AuthSessionBoundary`, `deliverAuthHandoff`) | `263f437` |
| 6 | Refresh + Expiry (`REFRESHING`, single-flight, `SESSION_EXPIRED`) | `ec4090c` |

**Congelado (no modificado sin ticket PO):** `bootstrap/boot.ts` · Config · Event Bus · Logging · Error Handler · Session Core · Permission Core · portales · Vite routing.

**Próximo paso documental:** siguiente ticket funcional **solo tras validación PO** al inicio de sesión (auditoría solo lectura). Infra MOD-008 pendiente de commit dedicado para durabilidad Git.

**Deploy:** sin push · sin PR · sin producción.

---

## MOD-003 Permissions — resumen closeout local (completo)

| Fase | Entregable | Commit local (`main`) |
|------|------------|------------------------|
| 1 | Capability Registry — 51 capabilities, deny-default, portal binding | `5f3547d` |
| 2 | Profile Matrix + Role Matrix Bridge | `24339a1` |
| 3A | Permission Resolver — `resolvePermissionSnapshot()`, `hasCapability()` | `aa702ff` |
| 3B | Session Permission Snapshot wire | `fb78b1e` |
| 4 | Route Guards — `ROUTE_CAPABILITY_MAP` (47 rutas) · `canActivateRoute()` | `eb8372d` |
| 5A | Component Map — `COMPONENT_CAPABILITY_MAP` (52 componentes) | `aa6d9e4` |
| 5B | Component Guards — `canRenderComponent()` · `canEnableComponent()` · `canUseAction()` | `abe188c` |
| 5C Client | Portal wire — 12 componentes resolve-only | `fdc69fa` |
| 5C Artist | Portal wire — 14 componentes resolve-only | `3ba23d8` |
| 5C Staff | Portal wire — 26 componentes resolve-only | `f6451e5` |

**Núcleo congelado:** Capability Registry · Role Matrix · Profile Matrix · Permission Resolver · Session Permission Wire · Route Guards · Component Map · Component Guards · Client/Artist/Staff wires.

**Explicitamente fuera de MOD-003 (post-closeout):**

- Router real · redirect · nav hide · Supabase snapshot · business logic en portales · guard UX (hide/disable) sin ticket

**Tests aprobados (post Fase 5C):** **234/234** unit · **3/3** e2e · visual localhost PO en client / artist / staff.

---

## Legal Center V2 — LC-10 Discovery (2026-07-21)

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD baseline** | `519f9ae` — `feat(v2-legal): add legal audit trail foundation` |
| **Ticket** | LC-10 Persistence Adapter Discovery — **aprobado PO** |
| **Estado** | LC-10 CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER |
| **Suite** | **958/958 PASS** · typecheck exit 0 · cero cambios runtime |
| **Próxima fase** | LC-11 — Persistence Schema & Read-Only Adapters (**pendiente ticket**) |
| **Push / deploy** | ❌ NO |

Detalle: [`TICKETS/TICKET-V2-LEGAL-CENTER-LC-10-PERSISTENCE-ADAPTER-DISCOVERY-001.md`](TICKETS/TICKET-V2-LEGAL-CENTER-LC-10-PERSISTENCE-ADAPTER-DISCOVERY-001.md)

---

## Legal Center V2 — LC-12 / LC-13A / LC-13B-0 (2026-07-21)

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD actual** | `c66a839d773baf75e169e0568864e528fb0ce98c` |
| **Working tree** | ✅ Limpio |
| **Suite** | **1029/1029 PASS** · typecheck exit 0 · HTTP 200 × 5 |
| **Migration LC-12** | Versionada localmente — **NO aplicada** |
| **Supabase remoto** | ❌ NO |
| **Push / deploy** | ❌ NO |

### Tickets cerrados (sesión 2026-07-21)

| Ticket | Estado PO |
|--------|-----------|
| LC-12 — Local Persistence Schema Foundation | ✅ CERRADO — APROBADO TÉCNICAMENTE PO |
| LC-13A — Read Security & RPC Discovery | ✅ CERRADO — DISCOVERY APROBADO PO |
| LC-13B-0 — Identity Bridge Discovery | ✅ CERRADO — DISCOVERY APROBADO PO |

### Commits (Legal Center)

| Hash | Mensaje |
|------|---------|
| `40ff9c8` | `feat(v2-legal): add local persistence schema foundation` |
| `fdbcba5` | `docs(v2-legal): approve read security and rpc discovery` |
| `c66a839` | `docs(v2-legal): approve identity bridge discovery` |

### Próximo trabajo

**LC-13B — Identity Bridge & Legal Profile Lookup Implementation** (autorizado tras LC-13B-0; **no** RLS · **no** RPC SQL · **no** migration apply · **no** Supabase remoto · **no** deploy).

Handoff: [`SESSION-SUMMARIES/2026-07-21-LEGAL-CENTER-END-OF-SESSION.md`](SESSION-SUMMARIES/2026-07-21-LEGAL-CENTER-END-OF-SESSION.md)

---

## Legal Center V2 — LC-13B Implementation (2026-07-22)

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD base** | `c66a839d773baf75e169e0568864e528fb0ce98c` |
| **Ticket** | LC-13B — Identity Bridge & Legal Profile Lookup Implementation |
| **Estado PO** | ✅ **APROBADO TÉCNICAMENTE POR PRODUCT OWNER** |
| **Suite** | **1046/1046 PASS** · typecheck exit 0 · HTTP **5/5** |
| **Identity bridge** | ✅ Activo localmente (`resolveLegalReadAccessContextFromSession`) |
| **Profile lookup** | ✅ In-memory adapter (`LegalProfileLookupPort`) |
| **Staff wire** | ✅ Session/PermissionSnapshot — **`previewRole` sin autoridad** · fail-closed `staff_seller` |
| **Backend remoto** | ❌ NO Supabase · ❌ NO SQL · ❌ NO RLS/RPC aplicados |
| **Push / deploy** | ❌ NO · cambios **sin commit** |

### Entregables LC-13B

- Módulo `shared/services/legal/persistence/identity/` (bridge + lookup port + memory adapter + role mapper)
- `staff/legal/staff-legal-provider-wire.ts` — bridge de sesión
- 14 tests unitarios + integración wire + 3 casos hardening fail-closed

### Seguridad confirmada

Guest/anónimo → `staff_seller` · `previewRole=owner` no eleva · `clearSession()` no conserva owner · `portal_mismatch` fail-closed · `actorId` = `STAFF-*` / `ART-*` / `CLI-*` (nunca UUID auth crudo).

### Nota forense

Excepción `SyntaxError: Unexpected token '%'` al importar `legal-template-asset-urls.ts` con **tsx/Node bare** — contrato Vite `?url` (LC-5). **No** regresión pipeline.

Handoff: [`SESSION-SUMMARIES/2026-07-22-LEGAL-CENTER-LC-13B-END-OF-SESSION.md`](SESSION-SUMMARIES/2026-07-22-LEGAL-CENTER-LC-13B-END-OF-SESSION.md)

### Próximo trabajo (discovery LC-13B-0 §19)

**LC-13B RLS/RPC** — SQL policies + 7 read RPCs · gate: bridge live + LC-12 DDL aprobado · **no autorizado** hasta ticket PO explícito (cadena global bloqueada por bootstrap legacy).

---

## Legal Center V2 — LC-12 Isolated Validation (2026-07-22)

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD docs** | `d26e896187314e1e10b59ab2c9ec751b8fe4a46e` |
| **LC-12 DDL** | ✅ **APPROVED_BY_PO_IN_ISOLATED_POSTGRES** |
| **Cadena 110 migraciones** | ❌ **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** |
| **LC-12 production apply** | ❌ **NOT_AUTHORIZED** |
| **LC-13 RLS/RPC** | ❌ **NOT_IMPLEMENTED / DEFERRED** |
| **Push / deploy** | ❌ **NOT_AUTHORIZED** |

### Fallo apply cadena Supabase (local)

`supabase start` falló en migración `20260302_flow_tab_implementation.sql` — SQLSTATE `42P01` — `public.dj_profiles` does not exist. LC-12 no alcanzada. Sin remoto.

Discovery: `TICKETS/TICKET-V2-SUPABASE-EMPTY-DB-BOOTSTRAP-DISCOVERY-001.md` — clasificación **MULTIPLE_CAUSES**.

### Validación aislada LC-12 (PASS PO)

PostgreSQL `postgres:16` temporal · sin puertos publicados · apply LC-12 exit 0 · 7 tablas · 1 secuencia · 12 FKs · append-only validado · `BEGIN/ROLLBACK` sintético · contenedor/volumen eliminados.

**Estado oficial:**

> **LC-12 DDL VALIDADO Y APROBADO EN POSTGRES AISLADO — APPLY MEDIANTE CADENA SUPABASE COMPLETA BLOQUEADO POR DEUDA LEGACY DE BOOTSTRAP.**

Handoff: [`SESSION-SUMMARIES/2026-07-22-LEGAL-CENTER-LC-12-ISOLATED-VALIDATION-CLOSEOUT.md`](SESSION-SUMMARIES/2026-07-22-LEGAL-CENTER-LC-12-ISOLATED-VALIDATION-CLOSEOUT.md)

---

## Legal Center V2 — LC-13 Discovery (2026-07-22)

| Campo | Valor |
|-------|-------|
| **Ticket** | LC-13 — Secure Access Architecture (discovery + planning) |
| **Estado** | **LC-13 DISCOVERY COMPLETADO — PENDIENTE DE REVISIÓN PO** |
| **LC-13A read** | Matrices existentes en `docs/V2/LEGAL/LC-13A-*` — base canónica read |
| **LC-13B bridge** | ✅ Runtime aprobado · identidad business IDs |
| **RLS / RPC SQL** | ❌ **NOT_IMPLEMENTED / DEFERRED** |
| **Bootstrap legacy** | ❌ **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** (no resuelto en LC-13) |
| **Implementación** | ❌ NO autorizada · commit docs pendiente PO |

### Alcance documentado

RLS conceptual · 7 read RPC (LC-13A) · extensiones propuestas (dashboard, public link) · matriz Owner/Manager/Seller · enlaces públicos · auditoría · e-sign compat · impacto bootstrap.

Handoff: [`SESSION-SUMMARIES/2026-07-22-LEGAL-CENTER-LC-13-DISCOVERY.md`](SESSION-SUMMARIES/2026-07-22-LEGAL-CENTER-LC-13-DISCOVERY.md) · [`TICKETS/TICKET-V2-LEGAL-CENTER-LC-13-DISCOVERY-AND-PLANNING-001.md`](TICKETS/TICKET-V2-LEGAL-CENTER-LC-13-DISCOVERY-AND-PLANNING-001.md)

---

## Legal Center V2 — LC-13A Read Security Isolated Validation (2026-07-22)

| Campo | Valor |
|-------|-------|
| **Ticket** | LC-13A — RLS + 7 read RPCs |
| **Estado** | **LC-13A READ SECURITY VALIDADA EN POSTGRES AISLADO — PENDIENTE DE REVISIÓN PO** |
| **Migración** | `supabase/migrations/20260722101300_legal_center_read_security_lc13a.sql` |
| **Apply cadena Supabase** | ❌ **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** |
| **Producción / deploy** | ❌ **NOT_AUTHORIZED** |
| **Commit** | ❌ NO autorizado en ticket de validación |

Validación: PostgreSQL `postgres:16` efímero · apply LC-12 + LC-13A · 22/22 pruebas PASS · RLS 15 policies · 7 RPC `SECURITY INVOKER` · contenedor/volumen eliminados.

Handoff: [`SESSION-SUMMARIES/2026-07-22-LC13A-READ-SECURITY-VALIDATION.md`](SESSION-SUMMARIES/2026-07-22-LC13A-READ-SECURITY-VALIDATION.md) · [`TICKETS/TICKET-V2-LEGAL-CENTER-LC-13A-ISOLATED-READ-SECURITY-VALIDATION-001.md`](TICKETS/TICKET-V2-LEGAL-CENTER-LC-13A-ISOLATED-READ-SECURITY-VALIDATION-001.md)

**Commit local:** `043f2cc` — `feat(v2-legal): add LC-13A isolated read security` (PO aprobado).

---

## Legal Center V2 — LC-13B Identity Integration Discovery (2026-07-22)

| Campo | Valor |
|-------|-------|
| **Ticket** | LC-13B — Identity Integration Discovery |
| **Estado** | **LC-13B IDENTITY INTEGRATION DISCOVERY COMPLETADO — PENDIENTE DE REVISIÓN PO** |
| **Runtime bridge** | ✅ Live (`resolveLegalReadAccessContextFromSession`) |
| **SQL identity stub LC-13A** | ❌ No productivo — reemplazo futuro |
| **Integración prod lookup** | ❌ **PENDIENTE** |
| **Bootstrap / cadena 110** | ❌ **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** |
| **Commit** | ❌ NO autorizado en este ticket |

Diseño: inventario identidades · mapa resolución auth→RLS→RPC · contrato `LegalIdentityContext` · compatibilidad KEEP/REPLACE/REMOVE · matriz portales · dependencias writes/links.

Handoff: [`SESSION-SUMMARIES/2026-07-22-LC13B-IDENTITY-DISCOVERY.md`](SESSION-SUMMARIES/2026-07-22-LC13B-IDENTITY-DISCOVERY.md) · [`TICKETS/TICKET-V2-LEGAL-CENTER-LC-13B-IDENTITY-INTEGRATION-DISCOVERY-001.md`](TICKETS/TICKET-V2-LEGAL-CENTER-LC-13B-IDENTITY-INTEGRATION-DISCOVERY-001.md)

---

## Fuera de alcance de este baseline

| Item | Motivo |
|------|--------|
| `web/` | Producción V1 — congelada salvo ticket |
| `MiamiDJBeat-MigracionV2/` (runtime) | MOD-002 + MOD-003 completo commiteados localmente; push bajo `APROBADO PUSH` |
| `MiamiDJBeat-MigracionV2/.env` | Secretos — nunca en git |
| Invoice · Cash Flow · Stripe · Header/Nav V1 | Baselines V1 en `docs/architecture/` y PR #116 |

---

## Arranque recomendado (agente / arquitecto)

1. `GOVERNANCE/AGENT-STARTUP-GATE.md`
2. `MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`
3. `MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md`
4. `ARCHITECTURE/ARCHITECTURE-HANDBOOK.md`
5. Ticket activo autorizado por PO

---

*TICKET-DOCS-V2-BASELINE-001 — Documentation only — 2026-07-06*