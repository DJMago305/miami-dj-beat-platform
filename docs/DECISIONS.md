# Miami DJ Beat — Registro de Decisiones

Decisiones oficiales del proyecto. La jerarquía documental completa está definida en `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`.

> Índice baseline V2: `docs/V2/README.md` (TICKET-DOCS-V2-BASELINE-001)

---

## DECISION-V2-001

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-05 |
| **Título** | Constitución Oficial del Proyecto MiamiDJBeat-MigracionV2 |
| **Estado** | **APROBADA** |
| **Documento** | `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` |
| **Ticket cierre** | TICKET-V2-CONSTITUTION-CLOSE-001 |

### Descripción

Queda aprobada oficialmente la Constitución del Proyecto.

A partir de esta fecha la Constitución pasa a ser el documento de mayor jerarquía del proyecto.

Toda decisión futura deberá respetarla.

Toda modificación requerirá una ADR aprobada por el Product Owner.

### Decisiones incorporadas en la Constitución

- **DECISIÓN CONSTITUCIONAL-001** — Separación permanente entre V1 y V2
- **Regla Constitucional** — Evaluación V1 vs V2 documentada en ticket antes de implementación estratégica en V1

### Aprobación

Product Owner — TICKET-V2-CONSTITUTION-CLOSE-001 (2026-07-05)

---

## DECISION-V2-002

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-05 |
| **Título** | Shared Core Documentation First |
| **Estado** | **APROBADA** |
| **Ticket cierre** | TICKET-V2-END-OF-DAY-DOCUMENTATION-001 |
| **Referencia** | `docs/V2/SHARED-CORE-PROGRESS.md` |

### Descripción

Se aprueba oficialmente que **MiamiDJBeat-MigracionV2** continuará bajo la metodología:

**Documentation First.**

Ningún módulo podrá implementarse sin:

1. **Blueprint** — alineado con `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md`
2. **Contratos** — `MiamiDJBeat-MigracionV2/shared/CONTRACTS.md` y contratos de módulo
3. **Especificaciones** — carpeta spec del módulo en `shared/{module}/`
4. **Aprobación del Product Owner** — gate explícito por ticket antes del siguiente

### Alcance

| Permitido sin implementación | Prohibido sin spec + PO |
|------------------------------|-------------------------|
| Scaffold README | Runtime JS/TS |
| Specs Markdown | Supabase migrations |
| Tablero progreso | Portal shells |
| ADR draft | Cutover V1 |

### Permanencia

Esta decisión es **permanente** para el ciclo de vida de MiamiDJBeat-MigracionV2 salvo ADR aprobada por Product Owner que modifique la metodología.

### Evidencia jornada 2026-07-05

- 18 tickets documentales Shared Core (001–018)
- **100%** Shared Core con spec completa (16/16 MOD)
- 0 módulos implementados
- 0 cambios V1

> Métrica histórica parcial al cierre ticket 011 (62.5%) superseded por reconciliación **PHASE-DOC-RECONCILIATION-001** y tablero `SHARED-CORE-PROGRESS.md`.

### Aprobación

Product Owner — TICKET-V2-END-OF-DAY-DOCUMENTATION-001 (2026-07-05)

---

## DECISION-V2-003

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-05 |
| **Fecha ratificación PO** | 2026-07-05 |
| **Título** | Runtime Stack Oficial — MiamiDJBeat-MigracionV2 |
| **Estado** | **APROBADA** |
| **Ticket propuesta** | TICKET-V2-ADR-RUNTIME-STACK-001 |
| **Ticket ratificación** | TICKET-V2-ADR-RATIFICATION-001 |
| **Ticket cierre** | TICKET-V2-ADR-RATIFICATION-CLOSURE-001 |
| **ADR** | `MiamiDJBeat-MigracionV2/docs/adr/ADR-DECISION-V2-003-RUNTIME-STACK.md` |
| **Reglas implementación** | `MiamiDJBeat-MigracionV2/docs/RUNTIME-IMPLEMENTATION-RULES.md` |

### Descripción

Queda ratificada oficialmente la **DECISION-V2-003** — stack runtime del laboratorio V2:

- **TypeScript 5.x strict** · **Browser ESM ES2022**
- **Arquitectura modular** — `shared/` · `client/` · `artist/` · `staff/` · MOD-xxx · boot `BOOT-SEQUENCE.md`
- **Build:** Vite 6.x MPA (3 portales) · `tsc --noEmit`
- **Testing:** Vitest + Playwright
- **Subsistemas propios:** Configuration · Event Bus · Logging · Error Handler · Storage (facade)
- **UI MVP:** sin framework SPA global — Design System + Components
- **Backend client:** Supabase JS v2 vía MOD-005 API Client (ticket futuro)

### Alcance de la ratificación

| Autorizado tras esta decisión | No autorizado por esta decisión |
|-------------------------------|----------------------------------|
| Referencia oficial del stack en tickets runtime | Implementación de código |
| Apertura documental de **TICKET-V2-RUNTIME-SCAFFOLD-001** (pendiente PO) | `package.json`, Vite config, `src/`, scaffold físico |
| Sincronización Decision Index y ADR | Cutover V1 · modificaciones `web/` |

La ratificación **no** sustituye ticket explícito ni validación PO por archivo de implementación.

### Consecuencias

- Fase documental Runtime **cerrada** (ADR + expediente ratificación).
- Próxima fase recomendada: **TICKET-V2-RUNTIME-SCAFFOLD-001** — toolchain vacío, sin lógica de negocio.
- Implementación Shared Core runtime permanece **0%** hasta tickets autorizados.

### Aprobación

Product Owner — TICKET-V2-ADR-RATIFICATION-CLOSURE-001 (2026-07-05)

---

## DECISION-V2-004

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-06 |
| **Título** | Bootline Baseline — localhost validado antes de desarrollo funcional V2 |
| **Estado** | **LOCKED** |
| **Ticket cierre** | TICKET-V2-BOOTLINE-BASELINE-001 |
| **Evidencia** | `docs/V2/SESSION-SUMMARIES/2026-07-05.md` § Validación Localhost — 2026-07-06 |

### Descripción

**El desarrollo funcional de V2 no comenzará hasta disponer de una baseline visual validada en localhost.**

Queda sellada la baseline operativa del laboratorio tras validación PO (2026-07-06):

- Vite ejecutándose en puerto **5173**
- Tres portales (**Client** · **Artist** · **Staff**) con HTTP **200**
- Boot scaffold completo: Config · Bus · Logging · Error Handler · Session ready
- **Business logic = false**
- **Sin integración Supabase** funcional
- **Sin cambios de código** en el acto de validación/baseline

### Consecuencias

| Autorizado tras LOCKED | No autorizado sin ticket + PO |
|------------------------|-------------------------------|
| Apertura **MOD-002 Session Manager** (desarrollo funcional) | Lógica de negocio en portales |
| Tickets runtime acotados al módulo autorizado | Cutover V1 · cambios `web/` |
| Referencia a esta baseline en tickets V2 | Modificar DECISION-V2-004 sin ADR PO |

### Aprobación

Product Owner — TICKET-V2-BOOTLINE-BASELINE-001 (2026-07-06)

---

## DECISION-V2-005

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-06 |
| **Título** | MOD-002 Session Manager Local Baseline Approved |
| **Estado** | **LOCKED LOCAL** |
| **Ticket cierre** | TICKET-MOD-002-SESSION-CLOSEOUT-DOCS-001 |
| **Evidencia** | `docs/V2/SESSION-SUMMARIES/2026-07-05.md` § MOD-002 Session Manager — Closeout Local (2026-07-06) |

### Descripción

Queda documentado el **cierre funcional local** de **MOD-002 Session Manager** tras seis fases de implementación controlada en el laboratorio `MiamiDJBeat-MigracionV2/`:

1. **State Machine** — máquina de 9 estados y tests de transición (`0a0a556`)
2. **Provider + Store** — orquestación, snapshot inmutable, facade de servicio (`c14c3d0`)
3. **Event Bus Wiring** — listeners idempotentes y emisión de eventos SESSION (`9878ffc`)
4. **Hydration + Restore** — fase de hidratación, `PersistencePort` interno mock/noop (`131fba9`)
5. **Auth Handoff Boundary** — contrato MOD-001 ↔ MOD-002 sin Auth real (`263f437`)
6. **Refresh + Expiry** — `REFRESHING`, guard single-flight, `SESSION_EXPIRED` (`ec4090c`)

Baseline operativa preservada:

- Boot scaffold intacto (`boot.ts` congelado)
- Tres portales en `:5173` con **Session: ready** y **Business logic: false**
- **112/112** tests unitarios · **3/3** e2e aprobados (corrida pre-closeout)
- Validación visual PO en localhost confirmada
- **Sin push · sin PR · sin Supabase · sin login real**

### Consecuencias

| Autorizado tras LOCKED LOCAL | No autorizado sin ticket + PO |
|------------------------------|-------------------------------|
| Apertura documental/implementación **MOD-003 Permissions** | Push/merge/deploy producción |
| Tickets runtime acotados a MOD-003+ | Cambios `web/` · Supabase prod |
| Referencia a commits MOD-002 en tickets V2 | Modificar DECISION-V2-005 sin ADR PO |
| Continuar lab local sobre baseline MOD-002 | Business logic en portales |

### Aprobación

Product Owner — TICKET-MOD-002-SESSION-CLOSEOUT-DOCS-001 (2026-07-06) — **PENDIENTE DE APROBACIÓN PO PARA INICIAR MOD-003 PERMISSIONS**

---

## DECISION-V2-006

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-06 |
| **Título** | MOD-003 Permissions Local Checkpoint Approved |
| **Estado** | **LOCKED LOCAL** |
| **Ticket cierre** | TICKET-MOD-003-LOCAL-CHECKPOINT-DOCS-001 |
| **Evidencia** | `docs/V2/SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Permissions — Local Checkpoint (2026-07-06) |

### Descripción

Queda documentado el **checkpoint local** de **MOD-003 Permissions** tras completar y validar las **Fases 1 y 2** en el laboratorio `MiamiDJBeat-MigracionV2/`:

1. **Fase 1 — Capability Registry** — catálogo in-memory inmutable de **51 capabilities**; deny-default; portal binding; tests unitarios (`5f3547d`)
2. **Fase 2 — Profile Matrix + Role Matrix Bridge** — taxonomía oficial de perfiles → 9 roles documentados; `artistCategory` ortogonal a `artistTier`; sin resolución de permisos (`24339a1`)

**MOD-002 Session Manager** permanece **cerrado localmente** (DECISION-V2-005) como baseline congelada — Permissions **no** conectado a boot, session ni portales.

Evidencia de validación:

- **131/131** tests unitarios · **3/3** e2e Playwright
- Validación visual PO aprobada en `localhost:5173` — client · artist · staff
- Boot baseline intacto: Config · Bus · Logging · Error Handler · Session ready · **Business logic: false**
- **Sin push · sin PR · sin Supabase · sin Permission Resolver**

### Consecuencias

| Autorizado tras LOCKED LOCAL | No autorizado sin ticket + PO |
|------------------------------|-------------------------------|
| Apertura **MOD-003 Fase 3 — Permission Resolver** | Push/merge/deploy producción |
| Tickets runtime acotados a resolver/guards MOD-003 | Wiring Session/Boot sin ticket explícito |
| Referencia a commits MOD-003 en tickets V2 | Modificar DECISION-V2-006 sin ADR PO |
| Continuar lab local sobre baseline MOD-002 + MOD-003 F1–2 | Business logic en portales |

### Aprobación

Product Owner — TICKET-MOD-003-LOCAL-CHECKPOINT-DOCS-001 (2026-07-06) — **PENDIENTE DE APROBACIÓN PO PARA MOD-003 FASE 3 — PERMISSION RESOLVER**

---

## DECISION-V2-007

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-06 |
| **Título** | MOD-003 Permissions Core Local Baseline Approved |
| **Estado** | **LOCKED LOCAL** |
| **Ticket cierre** | TICKET-MOD-003-CLOSEOUT-LOCAL-001 |
| **Evidencia** | `docs/V2/SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Closeout Local (2026-07-06) |

### Descripción

Se completa el **núcleo arquitectónico** del sistema de permisos MOD-003 hasta **Fase 3B** en el laboratorio `MiamiDJBeat-MigracionV2/`:

| Componente | Commit |
|------------|--------|
| **Capability Registry** | `5f3547d` |
| **Profile Matrix** | `24339a1` |
| **Role Matrix** | `24339a1` |
| **Permission Resolver** | `aa702ff` |
| **Session ↔ Permission Snapshot** | `fb78b1e` |

Evidencia de validación:

- **162/162** tests unitarios · **3/3** e2e Playwright
- Validación visual PO aprobada — client · artist · staff
- Boot · Config · Bus · Logging · Error Handler · Session — sin regresiones
- **Business logic: false** · **Sin push · sin PR · sin Supabase**

### Consecuencias

| Regla | Detalle |
|-------|---------|
| Consumo obligatorio | Todo desarrollo futuro de autorización debe consumir **PermissionSnapshot** vía Session |
| Prohibido | Checks manuales por rol dentro de portales (`if (role === 'Owner')`) |
| Obligatorio | Toda autorización mediante **`hasCapability()`** |
| Congelado | Capability Registry · Role Matrix · Profile Matrix · Permission Resolver · Session Permission Snapshot |
| Próximo módulo autorizado | **MOD-003 Fase 4 — Route Guards** |

| Autorizado tras LOCKED LOCAL | No autorizado sin ticket + PO |
|------------------------------|-------------------------------|
| Apertura **MOD-003 Fase 4 — Route Guards** | Push/merge/deploy producción |
| Tickets runtime acotados a guards MOD-003+ | Modificar núcleo Permissions congelado |
| Referencia a commits MOD-003 en tickets V2 | Modificar DECISION-V2-007 sin ADR PO |
| Continuar lab local sobre baseline MOD-003 | Business logic en portales |

### Aprobación

Product Owner — TICKET-MOD-003-CLOSEOUT-LOCAL-001 (2026-07-06) — **PENDIENTE DE APROBACIÓN PO PARA MOD-003 FASE 4 — ROUTE GUARDS**

---

## DECISION-V2-008

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-06 |
| **Título** | MOD-003 Route Guards Local Baseline Approved |
| **Estado** | **LOCKED LOCAL** |
| **Ticket cierre** | TICKET-MOD-003-ROUTE-GUARDS-CLOSEOUT-DOCS-001 |
| **Evidencia** | `docs/V2/SESSION-SUMMARIES/2026-07-05.md` § MOD-003 Route Guards Closeout Local (2026-07-06) |

### Descripción

Se completa **MOD-003 Fase 4 — Route Guards** en el laboratorio `MiamiDJBeat-MigracionV2/`:

| Componente | Commit |
|------------|--------|
| **Route Capability Map** | `eb8372d` |
| **Route Guards (`canActivateRoute`)** | `eb8372d` |
| **Unit tests Route Guards** | `eb8372d` |

Evidencia de validación:

- **47** rutas registradas (`ROUTE_CAPABILITY_MAP`) — client 11 · artist 14 · staff 22
- **184/184** tests unitarios · **3/3** e2e Playwright
- Validación visual PO aprobada — client · artist · staff
- Boot · Session · portales — **sin cambios**
- **Business logic: false** · **Sin push · sin PR · sin Supabase**

### Consecuencias

| Regla | Detalle |
|-------|---------|
| Consumo obligatorio | Toda activación de ruta futura debe usar **`canActivateRoute()`** + `PermissionSnapshot` |
| Prohibido | Guards de ruta que reimplementen `hasCapability()` o consulten rol directo |
| Congelado | `route-capability-map.ts` · `route-guards.ts` · exports en `permissions/runtime/index.ts` |
| Próximo módulo autorizado | **MOD-003 Fase 5 — Component Guards** |

| Autorizado tras LOCKED LOCAL | No autorizado sin ticket + PO |
|------------------------------|-------------------------------|
| Apertura **MOD-003 Fase 5 — Component Guards** | Push/merge/deploy producción |
| Tickets runtime acotados a guards MOD-003+ | Modificar Route Guards congelado sin ADR PO |
| Router real · redirect · nav hide | Sin ticket portal explícito |
| Continuar lab local sobre baseline Route Guards | Business logic en portales |

### Aprobación

Product Owner — TICKET-MOD-003-ROUTE-GUARDS-CLOSEOUT-DOCS-001 (2026-07-06) — **PENDIENTE DE APROBACIÓN PO PARA MOD-003 FASE 5 — COMPONENT GUARDS**
