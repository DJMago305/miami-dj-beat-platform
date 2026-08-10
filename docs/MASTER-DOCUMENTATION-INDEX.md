# Miami DJ Beat — Master Documentation Index

**Ticket:** `TICKET-D001` — Master Documentation Index — Fase 1
**Tipo:** Índice maestro (solo organización)
**Estado:** `DOCUMENTATION ONLY — DRAFT INDEX v1`
**Fecha:** 2026-08-04
**Checkout de referencia (repositorio oficial):** `/Users/djmago/Desktop/miami-dj-beat-platform`
**Rama de referencia al crear este índice:** `plan/v2-phase-4-api-client`
**HEAD de referencia al crear este índice:** `782486a27b0d203245d8a26acefe0b2965dc9d22`

Este archivo **no** es arquitectura nueva, **no** reescribe documentos existentes y **no** sustituye la Constitución ni los protocolos del Product Owner. Solo organiza y apunta a ubicaciones exactas.

---

## 1. Introducción

El **Master Documentation Index** es la puerta de entrada documental del monorepo Miami DJ Beat.

Su función es:

- localizar documentación oficial existente;
- declarar jerarquía;
- separar lo oficial, lo histórico, lo experimental y lo pendiente de integrar;
- señalar solapamientos **sin eliminar** ningún documento.

**Fuera de alcance de este índice:**

- implementación de código;
- mover o renombrar archivos;
- fusionar o reescribir specs;
- decidir arquitectura financiera nueva.

**Leyenda de procedencia usada en este documento:**

| Etiqueta | Significado |
|----------|-------------|
| **OFICIAL (tracked)** | Presente en el working tree del repositorio oficial y no aparece como untracked en el gate de creación de este índice |
| **OFICIAL (working tree, untracked)** | Existe bajo `/Users/djmago/Desktop/miami-dj-beat-platform` pero `git status` lo marca `??` (aún no commitado) |
| **WORKTREE V1 ONLY** | Existe en `/Users/djmago/Desktop/MiamiDJBeat-V1-offline-payment` y **no** forma parte del árbol documental del checkout oficial de referencia |

---

## 2. Jerarquía documental

Orden de autoridad (de mayor a menor). Un documento inferior **no** puede contradecir uno superior sin ADR / decisión del Product Owner.

1. **Constitución del proyecto**
   `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`
2. **Protocolos Product Owner / gobernanza de validación**
   `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md`
   `docs/V2/GOVERNANCE/*`
   `docs/DECISIONS.md`
3. **Arquitecturas y blueprints**
   `docs/V2/ARCHITECTURE/*`
   `docs/V2/MiamiDJBeat-V2-*`
   `docs/architecture/*` (V1)
   `docs/mdjpro-licensing-architecture.md`
4. **Especificaciones / contratos / diseño acotado**
   `docs/V2/LEGAL/*`
   `docs/nav/*`
   `docs/design/*`
   `docs/ai/*`
   specs bajo `MiamiDJBeat-MigracionV2/`
5. **Índices y puertas de entrada**
   Este archivo · `docs/V2/README.md` · `docs/V2-LAB/README.md` · `docs/V2/ARCHITECTURE/ARCHITECTURE-HANDBOOK.md`
6. **Tickets**
   `docs/tickets/*` · `docs/V2/TICKETS/*`
7. **Session logs / notas diarias / AGENT-MEMORY**
   `docs/sessions/*` · `docs/V2/SESSION-SUMMARIES/*` · `docs/NOTA-DIARIA-*` · `docs/AGENT-MEMORY.md`
8. **Incidentes**
   `docs/INCIDENTS/*` · tickets de incidente en `docs/tickets/`
9. **Runbooks / workflow**
   `SUPABASE-RUNBOOK.md` · `docs/workflow-control.md` · `REGRESSION-CHECKPOINT.md` · `README.md`
10. **Manuales de producto**
    `web/manuals/*` · `web/docs/DJ_MANUAL.md`

---

## 3. Mapa completo de documentación

### 3.1 Raíz del repositorio oficial

| Ruta | Rol | Procedencia |
|------|-----|-------------|
| `README.md` | Mapa mínimo del proyecto activo (`web/`, Supabase, Vercel) | OFICIAL (tracked) |
| `SUPABASE-RUNBOOK.md` | Runbook migraciones SQL y Edge Functions | OFICIAL (tracked) |
| `REGRESSION-CHECKPOINT.md` | Checkpoint de regresión post-deploy | OFICIAL (tracked) |

### 3.2 Gobernanza y memoria de agentes

| Ruta | Rol | Procedencia |
|------|-----|-------------|
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Constitución permanente | OFICIAL (tracked) |
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Protocolo oficial de validación PO | OFICIAL (tracked) |
| `docs/DECISIONS.md` | Registro de decisiones oficiales | OFICIAL (tracked) |
| `docs/V2/GOVERNANCE/README.md` | Índice gobernanza agentes V2 | OFICIAL (tracked) |
| `docs/V2/GOVERNANCE/AGENT-STARTUP-GATE.md` | Gate de arranque agentes | OFICIAL (tracked) |
| `docs/V2/GOVERNANCE/AGENT-READING-CHECKLIST.md` | Checklist de lectura | OFICIAL (tracked) |
| `docs/V2/GOVERNANCE/AGENT-GOVERNANCE-PIPELINE.md` | Pipeline de gobernanza | OFICIAL (tracked) |
| `docs/V2/GOVERNANCE/AGENT-WORK-AUTHORIZATION-FORM.md` | Formulario de autorización de trabajo | OFICIAL (tracked) |
| `docs/V2/GOVERNANCE/GOVERNANCE-VIOLATION-CHECKLIST.md` | Checklist de violaciones | OFICIAL (tracked) |
| `docs/V2/GOVERNANCE/INCIDENT-V2-POST-COMMIT-WORKTREE-CONTAMINATION-001.md` | Incidente worktree V2 | OFICIAL (tracked) |
| `docs/V2/GOVERNANCE/INCIDENT-V2-PR-PREVIEW-001.md` | Incidente PR preview V2 | OFICIAL (tracked) |
| `docs/workflow-control.md` | Protocolo humano Git / deploy / auth | OFICIAL (tracked) |
| `docs/AGENT-MEMORY.md` | Memoria viva de agentes / baselines | OFICIAL (tracked) |

### 3.3 Índices V2 y laboratorio

| Ruta | Rol | Procedencia |
|------|-----|-------------|
| `docs/V2/README.md` | Índice baseline documentación V2 | OFICIAL (tracked) |
| `docs/V2/ARCHITECTURE/ARCHITECTURE-HANDBOOK.md` | Puerta de entrada arquitectura V2 | OFICIAL (tracked) |
| `docs/V2-LAB/README.md` | Índice fundación V2-LAB | OFICIAL (tracked) |
| `docs/V2-LAB/01-VISION.md` … `08-PROJECT-ROADMAP.md` | Fundación lab (visión → roadmap) | OFICIAL (tracked) |
| `MiamiDJBeat-MigracionV2/docs/README.md` | Docs propias del scaffold lab | OFICIAL (tracked) |
| `MiamiDJBeat-MigracionV2/docs/RUNTIME-IMPLEMENTATION-RULES.md` | Reglas runtime lab | OFICIAL (tracked) |
| `MiamiDJBeat-MigracionV2/docs/adr/README.md` | Índice ADR lab | OFICIAL (tracked) |
| `MiamiDJBeat-MigracionV2/docs/adr/ADR-DECISION-V2-003-RUNTIME-STACK.md` | ADR runtime stack | OFICIAL (tracked) |
| `MiamiDJBeat-MigracionV2/docs/legal/README.md` | Legal lab (índice local) | OFICIAL (tracked) |

### 3.4 Arquitectura V2 (mapas y blueprints)

| Ruta | Rol | Procedencia |
|------|-----|-------------|
| `docs/V2/ARCHITECTURE/MODULE-INDEX.md` | Índice de módulos | OFICIAL (tracked) |
| `docs/V2/ARCHITECTURE/CONTRACT-INDEX.md` | Índice de contratos | OFICIAL (tracked) |
| `docs/V2/ARCHITECTURE/DECISION-INDEX.md` | Índice de decisiones | OFICIAL (tracked) |
| `docs/V2/ARCHITECTURE/DEPENDENCY-MAP.md` | Mapa de dependencias | OFICIAL (tracked) |
| `docs/V2/ARCHITECTURE/EVENT-MAP.md` | Mapa de eventos | OFICIAL (tracked) |
| `docs/V2/ARCHITECTURE/ERROR-MAP.md` | Mapa de errores | OFICIAL (tracked) |
| `docs/V2/ARCHITECTURE/BOOT-SEQUENCE.md` | Secuencia de boot | OFICIAL (tracked) |
| `docs/V2/ARCHITECTURE/GLOSSARY.md` | Glosario | OFICIAL (tracked) |
| `docs/V2/MiamiDJBeat-V2-ARQUITECTURA-VIVA.md` | Arquitectura viva | OFICIAL (tracked) |
| `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` | Catálogo de módulos | OFICIAL (tracked) |
| `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` | System blueprint | OFICIAL (tracked) |
| `docs/V2/MIAMI-DJ-BEAT-V1-TO-V2-MIGRATION-BLUEPRINT.md` | Blueprint migración V1→V2 | OFICIAL (tracked) |
| `docs/V2/SHARED-CORE-PROGRESS.md` | Progreso Shared Core | OFICIAL (tracked) |
| `docs/V2/PROFILE-TAXONOMY.md` | Taxonomía de perfiles | OFICIAL (tracked) |
| `docs/V2/PHASE-4-MOD-005-API-CLIENT-PLANNING.md` | Planning MOD-005 | OFICIAL (tracked) |
| `docs/V2/MiamiDJBeat-MigracionV2-MEMORIA.md` | Memoria lab MigracionV2 | OFICIAL (tracked) |

### 3.5 Legal V2

| Zona | Rutas | Procedencia |
|------|-------|-------------|
| Índices / matrices | `docs/V2/LEGAL/README.md`, `LC-13A-*`, `LC-13B-0-*` | OFICIAL (tracked) |
| Contratos CTR-001…007 | `docs/V2/LEGAL/contracts/*` | OFICIAL (tracked) |
| Políticas LGL-001…006 | `docs/V2/LEGAL/policies/*` | OFICIAL (tracked) |
| Especiales SPC-001…005 | `docs/V2/LEGAL/special/*` | OFICIAL (tracked) |

### 3.6 Arquitectura y specs V1 (en repositorio oficial)

| Ruta | Rol | Procedencia |
|------|-----|-------------|
| `docs/architecture/MASTER-WIRING-AUDIT-V1.md` | Plano eléctrico / writers V1 | OFICIAL (tracked) |
| `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` | Definición producto Cash Flow (PO) | OFICIAL (tracked) |
| `docs/architecture/CFMOVEMENT-READ-MAP-SPEC-V1.md` | Spec read-map CFMovement | OFICIAL (tracked) |
| `docs/mdjpro-licensing-architecture.md` | Arquitectura licenciamiento MDJPRO | OFICIAL (tracked) |
| `docs/nav/NAV-CONTRACT-001.md` | Contrato de navegación | OFICIAL (tracked) |
| `docs/design/talent-selector-hub-design.md` | Diseño talent selector hub | OFICIAL (tracked) |
| `docs/ai/system-agent-v1.md` | System prompt agente IA producto | OFICIAL (tracked) |
| `docs/ai/tracking-contract.md` | Contrato tracking | OFICIAL (tracked) |
| `docs/ai/booth-tracking-contract.md` | Contrato tracking booth | OFICIAL (tracked) |
| `docs/informe-cumplimiento-auth-release-2026-04.md` | Informe auth release | OFICIAL (tracked) |

### 3.7 Tickets V1 / MDJPRO / bugs (`docs/tickets/`)

**Inventario completo (66 archivos `.md` en el directorio al momento del índice).** Agrupación:

| Grupo | Ejemplos de rutas | Procedencia |
|-------|-------------------|-------------|
| Nav / auth / owner strip | `TICKET-001`…`003`, `TICKET-NAV-*`, `TICKET-P0-OWNER-STRIP-*`, `TICKET-ROLE-REDIRECT-002-*` | OFICIAL (tracked) salvo nota |
| Finanzas / invoice / cashflow (V1 parcial) | `TICKET-004-financial-order-architecture.md`, `TICKET-CASHFLOW-005-wiring-review.md`, `TICKET-V1-INVOICE-UX-PANELS-001.md` | OFICIAL (tracked) |
| Offline payment | `TICKET-V1-STAFF-OFFLINE-PAYMENT-RECORD-001.md` | **OFICIAL (working tree, untracked)** al crear este índice |
| Staff Activity / Ops Center | `TICKET-V1-STAFF-ACTIVITY-DATAGRID-001`…`006`, `TICKET-V1-STAFF-ACTIVITY-OPERATIONS-CENTER-INDEX.md` | OFICIAL (tracked) |
| Profile / jobs / rentals / search | `TICKET-007`…`010`, `TICKET-JOBS-*`, `TICKET-SEARCH-007-*`, `TICKET-V1-PROFILE-*` | OFICIAL (tracked) |
| MDJPRO suite | `MDJPRO-*`, `MDJPRO-TICKET-STATUS.md` | OFICIAL (tracked) |
| Planes / field reports / behavior | `PLAN-MAESTRA-BUGS-2026-06-16.md`, `PLAN-DE-TRABAJO-ADMIN-DASHBOARD.md`, `FIELD-REPORT-*`, `BEHAVIOR-*` | OFICIAL (tracked) |
| Docs V2 baseline ticket | `TICKET-DOCS-V2-BASELINE-001.md` | OFICIAL (tracked) |
| Continuidad / end of session V1 | `TICKET-V1-CONTINUITY-AUDIT-001.md`, `TICKET-V1-END-OF-SESSION-DOCUMENTATION-2026-07-24-001.md` | OFICIAL (tracked) |
| Incidente en tickets | `INCIDENT-001-staff-black-screen-routing.md` | OFICIAL (tracked) |

### 3.8 Tickets V2 (`docs/V2/TICKETS/`)

Colección de tickets del laboratorio (fases Shared Core, API client, Legal Center LC-*, OFTL/DWL financieros V2, Staff Operations, Notification Center, etc.).
**Índice de carpeta:** listar `docs/V2/TICKETS/*.md` (decenas de tickets; la fuente de verdad del estado de fase vive además en `docs/V2/README.md`).
**Procedencia:** OFICIAL (tracked).

### 3.9 Session logs y notas

| Zona | Rutas | Procedencia |
|------|-------|-------------|
| Sessions V1 (oficial) | `docs/sessions/SESSION-LOG-2026-06-13.md` … `SESSION-LOG-2026-07-24.md` (12 archivos) | OFICIAL (tracked) |
| Session summaries V2 | `docs/V2/SESSION-SUMMARIES/*` | OFICIAL (tracked) |
| Notas diarias docs | `docs/NOTA-DIARIA-2026-07-05.md`, `…07-06.md`, `…07-23.md` | OFICIAL (tracked) |
| Notas lab V2 | `docs/V2/NOTA-DIARIA-LAB-001.md`, `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` | OFICIAL (tracked) |

### 3.10 Incidentes

| Ruta | Rol | Procedencia |
|------|-----|-------------|
| `docs/INCIDENTS/INCIDENT-V1-OFFLINE-PAYMENT-BRANCH-GATE-2026-07-24-001.md` | Gate rama offline payment | **OFICIAL (working tree, untracked)** carpeta `docs/INCIDENTS/` al crear este índice |
| `docs/INCIDENTS/INCIDENT-V1-V2-SEPARATION-BREACH-001/*` | Auditoría / RCA / corrective V1↔V2 | **OFICIAL (working tree, untracked)** al crear este índice |
| `docs/tickets/INCIDENT-001-staff-black-screen-routing.md` | Incidente staff black screen | OFICIAL (tracked) |

### 3.11 Manuales y docs web

| Ruta | Rol | Procedencia |
|------|-----|-------------|
| `web/docs/DJ_MANUAL.md` | Manual DJ (corto) | OFICIAL (tracked) |
| `web/manuals/mdj-pro.html` | Entrada manual MDJPRO web | OFICIAL (tracked) |
| `web/manuals/MDJPRO_Manual/{en,es,de,fr,it,pt}/index.html` | Manual MDJPRO multi-idioma | OFICIAL (tracked) |
| `web/manuals/MDJPRO_Manual_Print/{en,es,de,fr,it,pt}/index_print.html` | Variante impresión | OFICIAL (tracked) |

### 3.12 Supabase (documentación auxiliar)

| Ruta | Rol | Procedencia |
|------|-----|-------------|
| `SUPABASE-RUNBOOK.md` | Runbook principal | OFICIAL (tracked) |
| `supabase/docs/operativo-rls-identidad-mdj.md` | RLS / identidad | OFICIAL (tracked) |
| `supabase/functions/TWILIO_SUPABASE_SETUP.md` | Setup Twilio | OFICIAL (tracked) |
| `supabase/functions/*/DEPLOY.md` | Deploy puntual de functions | OFICIAL (tracked) |

### 3.13 Weather Intelligence Engine — artefactos NO canónicos en este checkout

> ⚠️ **GOVERNANCE — LA LÍNEA CANÓNICA WEATHER V1 NO VIVE EN ESTE CHECKOUT.**
> La única línea Weather **canónica y congelada** de V1 vive en el worktree `offline-payment`
> (`/Users/djmago/Desktop/MiamiDJBeat-V1-offline-payment`, branch `fix/v1-staff-offline-payment-controlled`):
> **Candidate C** (arquitectura · FROZEN · SHA `9efeb20bb635fb92fbe8e724d8a6fefcfc63f2d72119a9b9f1e4bd11e7821d8a`),
> **Design Bible** (experiencia visual · FROZEN · SHA `e2ba0662d27e831005738b7ed7a1d134f69d9a3dc9c65e80e6b9e76533ddbcb7`) y
> **Visual Prototype Direction** (Fase 3, PO-approved direction). Ninguno de esos tres archivos existe en `miami-dj-beat-platform`.
>
> Los artefactos Weather presentes **en este checkout** son **NO canónicos**: quedaron aquí por una sesión ejecutada en el worktree equivocado. Reclasificados (no promovidos, no fusionados) por `TICKET-V1-WEATHER-DIVERGENT-ARTIFACT-RECLASSIFICATION-001` (2026-08-08) por decisión explícita del Product Owner.

| Ruta (este checkout) | Clasificación | Procedencia |
|------|-----|-------------|
| `docs/architecture/weather-intelligence/MIAMI-DJ-BEAT-WEATHER-INTELLIGENCE-ENGINE-ARCHITECTURE.md` | **HISTORICAL / NON-CANONICAL** — Candidate A, superseded by Candidate C | working tree, untracked |
| `docs/architecture/weather-intelligence/MIAMI-DJ-BEAT-WEATHER-INTELLIGENCE-ENGINE-CANDIDATE-B.md` | **HISTORICAL / NON-CANONICAL** — Candidate B (Event Environment View), superseded by Candidate C | working tree, untracked |
| `docs/architecture/weather-intelligence/MIAMI-DJ-BEAT-WEATHER-DESIGN-BIBLE-V1.md` | **REFERENCE ONLY / NON-CANONICAL** — divergent visual exploration (SHA `e8aa244e…`); NO es la Design Bible canónica (`e2ba0662…`) | working tree, untracked |
| `MIAMI-DJ-BEAT-WEATHER-VISUAL-EXPERIENCE-PHASE-REGISTER-V1.md` | **REMOVED** — stray session artifact eliminado por este ticket | — |

---

## 4. Documentos oficiales (fuentes de verdad por tema)

| Tema | Fuente de verdad (ubicación exacta) | Notas |
|------|-------------------------------------|-------|
| Autoridad documental del proyecto | `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Máxima jerarquía |
| Decisiones aprobadas | `docs/DECISIONS.md` | Apunta a Constitución |
| Validación / estados / multiagente PO | `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Norma BASELINE FROZEN |
| Índice documentación V2 | `docs/V2/README.md` | Continuidad de fases lab |
| Navegación arquitectura V2 | `docs/V2/ARCHITECTURE/ARCHITECTURE-HANDBOOK.md` | Meta-índice; no reemplaza specs |
| Roadmap lab V2 | `docs/V2-LAB/08-PROJECT-ROADMAP.md` | Planning; no roadmap monorepo único |
| Cableado / writers V1 | `docs/architecture/MASTER-WIRING-AUDIT-V1.md` | Auditoría 2026-07-06 |
| Cash Flow producto V1 | `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` | Locked PO (ver también AGENT-MEMORY) |
| CFMovement read-map V1 | `docs/architecture/CFMOVEMENT-READ-MAP-SPEC-V1.md` | Spec |
| Workflow Git / deploy | `docs/workflow-control.md` + `.cursor/rules/*` | Humano + agentes |
| Supabase apply | `SUPABASE-RUNBOOK.md` | No lo hace Vercel solo |
| MDJPRO licensing | `docs/mdjpro-licensing-architecture.md` | Producto MDJPRO |
| Weather V1 (canónico) | Worktree `offline-payment` — **NO en este checkout** | Candidate C `9efeb20b…` (FROZEN) + Design Bible `e2ba0662…` (FROZEN) + Prototype Direction; ver §3.13. Los artefactos Weather de este checkout son **NO canónicos**. |
| MDJPRO manual usuario | `web/manuals/MDJPRO_Manual/**` | No es manual de plataforma V1/Accounting |
| Entrada repo | `README.md` | Mínimo; no es el índice maestro |
| **Este índice** | `docs/MASTER-DOCUMENTATION-INDEX.md` | Organización únicamente |

**No declarar como fuente de verdad financiera V1 canónica consolidada (T009–T014)** ningún archivo del checkout oficial: esa serie aún está en el worktree V1 (ver §7).

---

## 5. Documentos históricos

Documentos de registro temporal, cierres de jornada o evidencia pasada. Siguen siendo válidos como **trazabilidad**, no como especificación viva salvo que un documento superior los incorpore.

| Categoría | Ubicaciones |
|-----------|-------------|
| Session logs V1 (oficial) | `docs/sessions/SESSION-LOG-2026-06-*.md`, `SESSION-LOG-2026-07-20.md`, `SESSION-LOG-2026-07-24.md` |
| Session summaries V2 | `docs/V2/SESSION-SUMMARIES/*` |
| Notas diarias | `docs/NOTA-DIARIA-2026-07-*.md`, `docs/V2/NOTA-DIARIA-*` |
| Tickets cerrados / field reports / planes maestra bugs | p. ej. `docs/tickets/FIELD-REPORT-*`, `PLAN-MAESTRA-BUGS-2026-06-16.md`, series Staff Activity DATAGRID, muchos `TICKET-*` de UI puntual |
| Informe auth abril 2026 | `docs/informe-cumplimiento-auth-release-2026-04.md` |
| Regression checkpoint | `REGRESSION-CHECKPOINT.md` |
| End-of-day / handoff tickets V2 | p. ej. `docs/V2/TICKETS/TICKET-V2-END-OF-*` |

---

## 6. Documentos experimentales

**Aclaración:** la carpeta `docs/V2/` **no** es experimental en bloque. Contiene documentación **oficial permanente** y, por separado, material de laboratorio. Esta sección solo lista lo experimental / lab; la oficial permanente de `docs/V2/` permanece bajo la jerarquía §2 y el mapa §3 / fuentes §4.

### 6.A Documentación oficial permanente dentro de `docs/V2` (no experimental)

Ejemplos (no exhaustivo; ver §3.2–§3.5 y §4):

| Ubicación | Rol |
|-----------|-----|
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Constitución — máxima autoridad |
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Protocolo oficial de validación PO |
| `docs/V2/ARCHITECTURE/ARCHITECTURE-HANDBOOK.md` | Puerta de entrada arquitectura V2 |
| `docs/V2/README.md` | Índice oficial / baseline documentación V2 |
| `docs/V2/GOVERNANCE/*` | Gobernanza de agentes V2 |

### 6.B Documentación de laboratorio / experimental

Ámbito de laboratorio / scaffold / no producción V1 `web/`.

| Ubicación | Rol |
|-----------|-----|
| `docs/V2-LAB/*` | Fundación documental del lab (planning) |
| `MiamiDJBeat-MigracionV2/**` | Scaffold / runtime experimental aislado |
| `MiamiDJBeat-MigracionV2/docs/adr/*` | ADRs del lab |
| `docs/V2/TICKETS/*` discovery / design | Tickets de descubrimiento (no autorizan cambios en `web/` V1) |

---

## 7. Documentos pendientes de integrar

### 7.1 Serie financiera T009–T014 (WORKTREE V1 ONLY)

**Estado:** existe en el worktree local V1 y **todavía no** forma parte del repositorio oficial (checkout `miami-dj-beat-platform` de referencia).

**Worktree:** `/Users/djmago/Desktop/MiamiDJBeat-V1-offline-payment`
**Rama típica de ese worktree:** `fix/v1-staff-offline-payment-controlled`

#### Documentación arquitectónica / de sesión asociada (untracked en V1)

| Ruta en worktree V1 | Nota |
|---------------------|------|
| `docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md` | Canon financiero V1 consolidado (autodeclarado en su cabecera); **pendiente de integrar al repo oficial** |
| `docs/architecture/OPERATIONS-INTELLIGENCE-NORTH-STAR.md` | Relacionado ops/inteligencia; V1 only |
| `docs/architecture/OPERATIONS-LOG-SOURCE-OF-TRUTH.md` | Operations Log SoT; V1 only |
| `docs/architecture/OPERATIONS-LOG-DELETION-GOVERNANCE.md` | Gobernanza borrado; V1 only |
| `docs/architecture/OPERATIONS-LOG-HISTORICAL-INTEGRITY.md` | Integridad histórica; V1 only |
| `docs/sessions/SESSION-LOG-2026-07-27-ACCOUNTING-ARCHITECTURE.md` | Sesión Accounting; V1 only |
| `docs/sessions/SESSION-LOG-2026-07-27-FINANCIAL-CONSOLE-SESSION-CLOSE.md` | Cierre consola financiera; V1 only |
| `docs/sessions/SESSION-LOG-2026-08-03-PERMANENT-QUALITY-DIRECTIVES.md` | Directivas calidad; V1 only |
| `docs/sessions/SESSION-LOG-2026-08-03-PRODUCTION-INVOICE-SAVE-LIFECYCLE-FORENSIC-RECONCILIATION.md` | Reconciliación Save; V1 only |
| Otros session logs Accounting / Register Event ago-2026 | Ver `docs/sessions/SESSION-LOG-2026-07-2*` / `08-0*` untracked en V1 |

#### Artefactos runtime / tests de la serie financiera (WORKTREE V1 ONLY — no son docs, listados para trazabilidad de integración futura)

| Ruta en worktree V1 |
|---------------------|
| `web/js/mdj-financial-legacy-adapter.js` (+ `.local-selftest.mjs`) |
| `web/js/mdj-financial-local-services.js` (+ `.local-selftest.mjs`) |
| `web/js/mdj-financial-domain-events.js` (+ `.local-selftest.mjs`) |
| `web/js/mdj-local-projection-engine.js` (+ `.local-selftest.mjs`) |
| `web/js/mdj-financial-projection-sync.js` (+ `.local-selftest.mjs`) |
| `web/js/mdj-financial-legacy-import-bridge.js` (+ `.local-selftest.mjs`) |
| `web/js/fixtures/mdj-financial-legacy-adapter.synthetic.json` |

> **Nota de honestidad documental:** en el inventario de `docs/tickets/` del worktree V1 no se observaron archivos cuyo nombre literal sea `TICKET-…-T009`…`T014` de la serie financiera; la serie T009–T014 referida por el Product Owner corresponde al **bloque de trabajo financiero** (arquitectura canónica + módulos anteriores) presente solo en el worktree V1. No inventar títulos de ticket no encontrados en disco.

#### Tickets V1 untracked relacionados (WORKTREE V1 ONLY) — candidatos a integrar junto con la serie

Ejemplos observados como `??` en el worktree V1:

- `docs/tickets/TICKET-V1-BUSINESS-EVENT-FINANCIAL-ROUTING-CONTRACT-006C.md`
- `docs/tickets/TICKET-V1-CORPORATE-BUSINESS-CHANNEL-AND-SNAPSHOT-SCHEMA-PLAN-007D.md`
- `docs/tickets/TICKET-V1-CORPORATE-SHARED-SAVE-PARAMETERIZATION-PLAN-007E.md`
- `docs/tickets/TICKET-V1-MDJ-BUSINESS-INTELLIGENCE-ARCHITECTURE-001.md`
- `docs/tickets/TICKET-V1-OPERATIONS-LOG-*-001.md` (serie Operations Log)
- `docs/tickets/TICKET-V1-CANONICAL-TALENT-TAXONOMY-SCHEMA-006.md`
- `docs/tickets/TICKET-V1-MDJ-ENTERPRISE-COMMAND-BAR-ARCHITECTURE-001.md`
- `docs/tickets/TICKET-V1-DJ-PROFILES-DUAL-IDENTITY-AND-CLEAN-BASELINE-REPAIR-006A.md`

### 7.2 Pendientes en el working tree del repositorio oficial (untracked al crear este índice)

| Ruta | Nota |
|------|------|
| `docs/INCIDENTS/` (árbol completo) | Presente en disco oficial; aún `??` |
| `docs/tickets/TICKET-V1-STAFF-OFFLINE-PAYMENT-RECORD-001.md` | Presente en disco oficial; aún `??` |
| `docs/MASTER-DOCUMENTATION-INDEX.md` | Este archivo (nuevo en Fase 1); integrar vía proceso Git del PO |
| `docs/tickets/TICKET-V1-ARTIST-FINANCIAL-STRIPE-CONNECT-BLUEPRINT-001.md` | **Hogar formal** del blueprint Bloque 5 / Stripe Connect (Suscripciones + Payouts). Clasif. B) V2-prep. Gate de construcción NO cumplido (Package 5 COMPLETE + auth PO). Presente en disco oficial; aún `??` |
| `docs/architecture/financial-intelligence/blueprint-payouts-suscripciones.html` | **Maqueta canónica de diseño VIGENTE** para el futuro Bloque 5 / Stripe Connect (Payouts, Suscripciones y Gestión Financiera). Artefacto publicado (privado): https://claude.ai/code/artifact/da8b5d22-e7fd-45ce-889b-3adff1cb9ceb — **Referencia de diseño, NO autoriza construcción.** No sustituye ni elimina la maqueta previa `MIAMI-DJ-BEAT-BUSINESS-FINANCIAL-INTELLIGENCE-MAQUETA.md` (regla de no-remoción). Ver ticket. Presente en disco oficial; aún `??` |
| `docs/architecture/financial-intelligence/maqueta-centro-financiero-verlo-ya.html` | Maqueta "verlo-ya" (mock) aprobada visualmente. Artefacto: https://claude.ai/code/artifact/fac47654-2415-4ab4-ac25-703257ba7720 . Presente en disco oficial; aún `??` |
| `web/centro-financiero-artista.html` | **Página de app portada** (verlo-ya · UI-only mock). Datos estáticos, SIN Stripe/backend/comunicación externa. Se abre por URL directa (mismo patrón que el calendario, sin entrada en nav). Gate Bloque 5 intacto. Presente en disco oficial; aún `??` |

---

## 8. Documentos duplicados o parcialmente solapados

**No eliminar.** Solo identificación:

| Par / conjunto | Solapamiento |
|----------------|--------------|
| `docs/V2/README.md` ↔ `docs/V2-LAB/README.md` ↔ `docs/V2/ARCHITECTURE/ARCHITECTURE-HANDBOOK.md` | Tres puertas de entrada V2 / lab |
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` ↔ `docs/V2/GOVERNANCE/*` ↔ `docs/workflow-control.md` | Gobernanza PO vs agentes vs Git/deploy |
| `docs/AGENT-MEMORY.md` ↔ `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` ↔ `docs/DECISIONS.md` | Baselines Cash Flow repetidos en memoria vs spec |
| `docs/architecture/MASTER-WIRING-AUDIT-V1.md` ↔ `docs/tickets/TICKET-004-financial-order-architecture.md` ↔ Cash Flow / CFMovement | Finanzas V1 fragmentadas (audit vs ticket vs producto) |
| `docs/V2/MiamiDJBeat-V2-ARQUITECTURA-VIVA.md` ↔ `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` ↔ Handbook | Arquitectura V2 en varias capas |
| `docs/V2/LEGAL/*` ↔ `MiamiDJBeat-MigracionV2/docs/legal/README.md` | Legal superior vs índice local lab |
| `docs/mdjpro-licensing-architecture.md` ↔ `docs/tickets/MDJPRO-*` ↔ `web/manuals/MDJPRO_Manual/**` | Arquitectura vs tickets vs manual usuario |
| `docs/sessions/*` ↔ `docs/V2/SESSION-SUMMARIES/*` ↔ `docs/NOTA-DIARIA-*` ↔ `docs/AGENT-MEMORY.md` | Narrativa operativa en cuatro formatos |
| Canon financiero V1 (worktree) ↔ Cash Flow / Wiring (oficial) | El canon V1 untracked supersede/complementa; riesgo de leer solo el oficial parcial |

---

## 9. Recomendaciones futuras

1. **Mantener este índice** como único punto de navegación monorepo; actualizarlo cuando se integren documentos, sin copiar su contenido.
2. **Integrar formalmente** (ticket + aprobación PO) la serie financiera T009–T014 y el canon
   `MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md` desde el worktree V1 al repositorio oficial, luego enlazarlos en §4 como fuente de verdad financiera V1.
3. **Commitar o descartar con criterio** el árbol `docs/INCIDENTS/` y el ticket offline-payment hoy untracked en el checkout oficial.
4. **Añadir** un `docs/README.md` de una página que solo enlace a este Master Index (opcional; no duplicar el mapa).
5. **No fusionar** Constitución / PO Protocol / Handbook: mantener jerarquía; el índice solo referencia.
6. **Separar claramente** en futuras ediciones: “oficial tracked” vs “worktree only” vs “lab experimental”.
7. **Fase 2 posible (solo con ticket):** tabla de owners por documento y estado de vigencia PO — sin reescribir specs.

---

## Confirmaciones de esta pasada (TICKET-D001)

```
NO CODE MODIFIED
NO RUNTIME MODIFIED
DOCUMENTATION ONLY
NO FILES MOVED
NO FILES RENAMED
NO EXISTING DOCS REWRITTEN
```

**Único archivo creado por este ticket:** `docs/MASTER-DOCUMENTATION-INDEX.md`
