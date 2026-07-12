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
