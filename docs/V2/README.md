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
**MOD-002:** TICKET-MOD-002-SESSION-CLOSEOUT-DOCS-001 (2026-07-06) — **LOCAL BASELINE APPROVED** · DECISION-V2-005 (LOCKED LOCAL).  
**MOD-003:** TICKET-MOD-003-LOCAL-CHECKPOINT-DOCS-001 (2026-07-06) — **LOCAL CHECKPOINT APPROVED** · DECISION-V2-006 (LOCKED LOCAL) — Fases 1–2 completadas.

Estado actual:

- ✅ **Scaffold operativo** — Vite en puerto 5173; tres portales (Client · Artist · Staff) responden HTTP 200.
- ✅ **Boot validado** — Config loaded · Bus ready · Logging ready · Error Handler ready · Session ready.
- ✅ **MOD-002 Session Manager — cierre funcional local** — 6 fases implementadas y commiteadas en `main` local (**sin push / sin PR**). Baseline **congelada** para Permissions.
- ✅ **MOD-003 Permissions — checkpoint local Fases 1–2** — Capability Registry + Profile/Role Matrix Bridge commiteados localmente (**sin push / sin PR**).
- ✅ **Tests aprobados** — **131/131** unitarios · **3/3** e2e Playwright (post MOD-003 Fase 2).
- ✅ **Validación visual PO** — los tres portales mantienen `Session: ready` y `Business logic: false` (sin cambio visual).
- ✅ **Business Logic deshabilitada** — `businessLogic: false` en los tres portales.
- ✅ **Sin integración Supabase** — sin egress API funcional ni auth real en runtime V2.

Detalle MOD-002: `SESSION-SUMMARIES/2026-07-05.md` § MOD-002 Session Manager — Closeout Local (2026-07-06).  
Detalle MOD-003: `SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Permissions — Local Checkpoint (2026-07-06).  
Detalle boot scaffold: § Validación Localhost — 2026-07-06.

---

## Jerarquía documental

| Nivel | Documento | Rol |
|-------|-----------|-----|
| 1 — Máxima | `MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Constitución del proyecto |
| 2 — Decisiones | `../DECISIONS.md` | Registro oficial DECISION-V2-001 … 006 |
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
| `PROFILE-TAXONOMY.md` | Taxonomía perfiles recuperables Client · Artist · Staff (pre MOD-003) |

---

## Documentos en raíz `docs/` (relacionados)

| Archivo | Relación con V2 |
|---------|-----------------|
| `DECISIONS.md` | Registro oficial de DECISION-V2-001 … 006 |
| `NOTA-DIARIA-2026-07-05.md` | Cabecera operativa del día (cierre fase fundacional). Detalle → `SESSION-SUMMARIES/2026-07-05.md` |
| `NOTA-DIARIA-2026-07-06.md` | Nota V1 (Invoice / Cash Flow / Nav) — **en `main`**, fuera de baseline V2 |

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

**Congelado (no modificado en MOD-002 ni MOD-003 Fases 1–2):** `bootstrap/boot.ts` · Config · Event Bus · Logging · Error Handler · Session runtime · portales · Vite routing.

**Próximo paso documental:** **MOD-003 Fase 3 — Permission Resolver** — **PENDIENTE DE APROBACIÓN PO**.

**Deploy:** sin push · sin PR · sin producción.

---

## MOD-003 Permissions — resumen checkpoint local (Fases 1–2)

| Fase | Entregable | Commit local (`main`) |
|------|------------|------------------------|
| 1 | Capability Registry — 51 capabilities, deny-default, portal binding, tests | `5f3547d` |
| 2 | Profile Matrix + Role Matrix Bridge — taxonomía oficial → roles documentados | `24339a1` |

**Baseline MOD-002 congelada:** Session Manager permanece intacto; Permissions **no** conectado a boot, session ni portales.

**Explicitamente fuera de MOD-003 Fases 1–2:**

- `hasCapability()` · Permission Resolver · guards UI
- Wiring Session · Event Bus · Supabase · business logic

**Tests aprobados (post Fase 2):** **131/131** unit · **3/3** e2e · visual localhost PO en client / artist / staff.

---

## Fuera de alcance de este baseline

| Item | Motivo |
|------|--------|
| `web/` | Producción V1 — congelada salvo ticket |
| `MiamiDJBeat-MigracionV2/` (runtime) | MOD-002 + MOD-003 Fases 1–2 commiteados localmente; push bajo `APROBADO PUSH` |
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
