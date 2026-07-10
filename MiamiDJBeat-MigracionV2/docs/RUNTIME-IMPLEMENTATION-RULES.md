# RUNTIME-IMPLEMENTATION-RULES.md

# Reglas Oficiales de Implementación Runtime — MiamiDJBeat-MigracionV2

| Campo | Valor |
|-------|-------|
| **Ticket** | **TICKET-V2-RUNTIME-IMPLEMENTATION-RULES-001** |
| **Versión** | 1.0 |
| **Estado** | **DOCUMENTADO** — **PENDIENTE VALIDACIÓN PRODUCT OWNER** |
| **Tipo** | Norma operativa de implementación — **no arquitectura** |
| **Audiencia** | Agentes IA, desarrolladores, QA |
| **Implementación autorizada** | **NO** — este documento **no** habilita código |

> **Filosofía:** El ADR define **qué stack** usar. Este documento define **cómo** implementarlo sin violar contratos, gobernanza ni producción V1.  
> **Los agentes ejecutan. El Product Owner valida. Los agentes no aprueban.**

---

## 1. Objetivo

Establecer las **reglas obligatorias y permanentes** que gobernarán **toda** implementación runtime del laboratorio `MiamiDJBeat-MigracionV2/`.

| Este documento | No es |
|----------------|-------|
| Manual operativo de implementación runtime | Definición de arquitectura (→ ADR, Blueprint, specs) |
| Checklist por ticket | Sustituto de Baseline o Constitución |
| Gate de autorización para escribir código | Aprobación PO — requiere ticket + ADR ratificado + PO |

**Propósito concreto:** evitar improvisación, regresiones cruzadas, deuda V1 replicada, violaciones de boot, imports ilegales y cierre prematuro de tickets runtime.

---

## 2. Alcance

### 2.1 Cubre

- Implementación futura en `MiamiDJBeat-MigracionV2/` (Shared Core, portales, bootstrap, tests).
- Conducta obligatoria de agentes y desarrolladores durante tickets runtime.
- Dependencias, imports, estructura, calidad y evidencia mínima por ticket.
- Reglas module-specific para subsistemas P0/P1 del Shared Core.

### 2.2 No cubre

- Diseño funcional de producto (→ System Blueprint).
- Especificación técnica de módulos (→ `shared/{módulo}/*-SPEC.md`).
- Stack tecnológico (→ ADR DECISION-V2-003).
- Deploy, Git, Supabase remoto (→ tickets infra + PO).
- Modificaciones a V1 (`web/`).

### 2.3 Vigencia

Entra en vigor operativo para implementación **solo cuando**:

1. Product Owner ratifique este documento, **y**
2. Product Owner ratifique **DECISION-V2-003** (ADR Runtime Stack) — **✅ APROBADA** 2026-07-05 · `docs/DECISIONS.md`, **y**
3. Exista ticket de implementación explícito autorizado por PO.

**Estado DECISION-V2-003:** APROBADA (TICKET-V2-ADR-RATIFICATION-CLOSURE-001). Implementación sigue **bloqueada** hasta ítems 1 y 3 + ticket scaffold PO.

---

## 3. Fuentes oficiales

Orden de consulta ante duda — **prevalece el nivel superior**:

| Prioridad | Documento | Ruta |
|-----------|-----------|------|
| 1 | Constitución del Proyecto | `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` |
| 2 | Governance Baseline v3.1 | `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` |
| 3 | Operation Guide | `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` |
| 4 | ADR Runtime Stack | `MiamiDJBeat-MigracionV2/docs/adr/ADR-DECISION-V2-003-RUNTIME-STACK.md` |
| 5 | System Blueprint | `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` |
| 6 | Module Catalog | `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` |
| 7 | Boot Sequence | `docs/V2/ARCHITECTURE/BOOT-SEQUENCE.md` |
| 8 | Shared Contracts | `MiamiDJBeat-MigracionV2/shared/CONTRACTS.md` |
| 9 | Spec del módulo | `MiamiDJBeat-MigracionV2/shared/{módulo}/*-SPEC.md` |
| 10 | **Este documento** | `MiamiDJBeat-MigracionV2/docs/RUNTIME-IMPLEMENTATION-RULES.md` |
| 11 | Agent Governance Pipeline | `docs/V2/GOVERNANCE/AGENT-GOVERNANCE-PIPELINE.md` |

Ante conflicto entre este documento y niveles 1–9 → **obedecer nivel superior** y **detenerse** (Baseline §70).

---

## 4. Relación con el ADR Runtime (DECISION-V2-003)

| ADR decide | Estas reglas operacionalizan |
|------------|------------------------------|
| TypeScript 5 strict | Prohibido JS suelto; `strict` no relajable sin ADR |
| Browser ESM ES2022 | Prohibido Node APIs en runtime cliente |
| Vite 6 MPA | Un entry por portal; output solo bajo lab `dist/` |
| Vitest + Playwright | Tests obligatorios por capa (§ Calidad) |
| Bus / Config / Log / Error / Storage propios | Reglas module-specific §5 |
| Sin framework SPA MVP | Prohibido React/Vue/Angular sin ADR portal |
| Supabase v2 vía MOD-005 | Prohibido `@supabase/*` directo desde portales |

**Regla R-ADR-01:** Ninguna línea de implementación antes de ADR **APROBADA** por PO.  
**Regla R-ADR-02:** Desviación del stack ADR → detener + ADR nueva + PO.

---

## 5. Relación con el Shared Core

| Principio | Regla de implementación |
|-----------|-------------------------|
| 16 MOD documentados | Implementación solo MOD listados en Module Catalog |
| Spec completa = gate | Estado `DOCUMENTACIÓN COMPLETA` mínimo antes de código MOD |
| Una responsabilidad | Un ticket = uno o más MOD **declarados** — no mezcla portal + Core sin PO |
| Sin UI de portal en Core | Prohibido nav, páginas staff/client/artist en `shared/` |
| Contratos escritos | Input/Output/Estados/Errores de `CONTRACTS.md` son ley |

**Regla R-SC-01:** Modificar código o specs en `shared/` **solo** en tickets dedicados Shared Core runtime — nunca como «arreglo de paso» desde ticket portal.

**Regla R-SC-02:** Portales consumen **Public API** exportada — nunca internals (`_`, `internal/`, archivos no exportados en barrel permitido).

**Regla R-SC-03:** Cambio de contrato público MOD → breaking change → ADR + bump versión evento/API + Contract Tests actualizados.

---

## 6. Relación con el Blueprint

| Blueprint | Regla runtime |
|-----------|---------------|
| Tres portales independientes | `client/`, `artist/`, `staff/` no se importan entre sí |
| Operations Core — una orden | Portales no duplican estado de orden; consumen proyección vía API |
| Separación roles buyer / performer / staff | Permissions snapshot — no JWT-only |
| Migración por módulos | Cutover ticket por MOD catálogo — no file-by-file V1 copy |

**Regla R-BP-01:** Prohibido modificar `MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` desde tickets runtime — solo ticket documental PO.

**Regla R-BP-02:** Funcionalidad no listada en Blueprint + Catalog → **no implementar** — escalar PO.

---

## 7. Relación con el Baseline

| Baseline | Aplicación runtime |
|----------|-------------------|
| §35 Lenguaje prohibido agente | Nunca «APROBADO», «CERRADO», «LISTO PROD» |
| §50–§58 Alcance ticket | Solo archivos declarados en Authorization Form |
| §60–§61 Cero regresión | Evidencia ANTES → DESPUÉS → DIFERENCIA |
| §63 Archivos compartidos V1 | **Prohibido** tocar `web/` shared JS/CSS/header |
| §70 Detención obligatoria | Componente FROZEN / fuera alcance → stop |
| §72 Evidencia visual | UI runtime requiere capturas PO |
| Pipeline 1–15 | Gate completo antes y después del trabajo |

**Regla R-BL-01:** Evidencia presentada ≠ aprobación PO.  
**Regla R-BL-02:** Commit / push / deploy solo con frases PO exactas — nunca recomendados por agente.

---

## 8. Gobernanza — qué NO sustituye este documento

Este documento **operacionaliza** implementación runtime. **No reemplaza ni modifica:**

| Documento | Sigue siendo autoridad en |
|-----------|---------------------------|
| Constitución | Misión, V1/V2, jerarquía máxima |
| Baseline | Validación PO, GV, estados, evidencia |
| Blueprint | Plano funcional global |
| Shared Core specs | Contrato técnico por MOD |
| ADR Runtime | Stack y decisiones arquitectónicas |
| Operation Guide | Procedimiento diario, trazabilidad |
| Module Catalog | Inventario oficial MOD |

Si este documento contradijera un superior → **el superior manda** → escalar PO para enmienda vía ticket documental.

---

## 9. Reglas obligatorias por subsistema

### 9.1 Boot Sequence

| ID | Regla |
|----|-------|
| **BOOT-01** | Orden canónico: `BOOT-SEQUENCE.md` — única fuente boot global |
| **BOOT-02** | Fase 0 Configuration fatal (ERR-0001–0005) → abort total — no partial boot |
| **BOOT-03** | Error Handler + Logging registrados en Fase 0 antes de lógica dominio |
| **BOOT-04** | Event Bus `BUS_READY` antes de cualquier emit dominio |
| **BOOT-05** | `SYSTEM_READY` (internal) tras bus ready |
| **BOOT-06** | Auth → Session → Permissions — secuencia estricta Fase 2 |
| **BOOT-07** | `SESSION_READY` antes de `PORTAL_READY` |
| **BOOT-08** | Storage Fase 4 **después** identidad Session — no antes Fase 2 |
| **BOOT-09** | Theme ∥ i18n ∥ Flags post-`SESSION_READY` — orden preferido Theme → i18n → Flags |
| **BOOT-10** | Prohibido `setInterval` / polling para simular boot gates |
| **BOOT-11** | Portal Shell solo Fase 7 — features portal post-`PORTAL_READY` |
| **BOOT-12** | Test obligatorio: boot integration por fase en ticket Core |

### 9.2 Event Bus (MOD-004)

| ID | Regla |
|----|-------|
| **BUS-01** | Envelope completo: `name`, `version`, `timestamp`, `emitter`, `scope`, `payload` |
| **BUS-02** | Payload JSON-safe — sin DOM, functions, class instances |
| **BUS-03** | Sin secrets en payload o `meta` |
| **BUS-04** | `scope`: `internal` \| `public` — portales solo subscribe `public` salvo ADR |
| **BUS-05** | Catálogo en EVENT-MAP — emit no catalogado → ERR runtime + detener en dev |
| **BUS-06** | Breaking payload → increment `version` + ADR |
| **BUS-07** | Prohibido DOM `CustomEvent` como bus de dominio |
| **BUS-08** | Handlers async — errores handler → Error Handler — no swallow |
| **BUS-09** | Contract test por evento P0 en ticket MOD-004 |

### 9.3 Session (MOD-002)

| ID | Regla |
|----|-------|
| **SES-01** | Distinguir `INITIAL_SESSION` (hydrate) vs `SIGNED_IN` (login real) |
| **SES-02** | Session Manager única autoridad estado sesión — Auth delega, no duplica |
| **SES-03** | Emite `SESSION_READY` solo cuando snapshot coherente |
| **SES-04** | Restore vía Storage namespace Session — keys `mdj_v2_session_*` |
| **SES-05** | Prohibido redirect portal antes `SESSION_READY` |
| **SES-06** | Forced signOut staff gate — Auth + Session coordinados |
| **SES-07** | Sin tokens en logs — redacción Logging |

### 9.4 Permissions (MOD-003)

| ID | Regla |
|----|-------|
| **PERM-01** | Fuente operativa: snapshot DB (`mdj_access_snapshot` conceptual) — **no** JWT-only |
| **PERM-02** | `hasCapability()` única API evaluación — no checks ad hoc en portales |
| **PERM-03** | Staff gate fail → signOut + redirect — no UI staff parcial |
| **PERM-04** | Seller vs management — capabilities catálogo; no hardcode roles string |
| **PERM-05** | Prohibido `app_metadata.role` cliente sin validación snapshot |
| **PERM-06** | Permisos no re-fetch en resize/orientation (PERFORMANCE-GUIDELINES) |

### 9.5 Theme (MOD-007)

| ID | Regla |
|----|-------|
| **THM-01** | Tokens dark/gold — authority `THEME-SPEC.md` |
| **THM-02** | Emite `THEME_CHANGED` tras `THEME_READY` |
| **THM-03** | Error visual theme no aborta Session (BOOT-04 Baseline doc) |
| **THM-04** | Theme no parsea env — lee Config |
| **THM-05** | Portales no inline CSS tokens — consumen Theme API / CSS vars |

### 9.6 Feature Flags (MOD-013)

| ID | Regla |
|----|-------|
| **FLG-01** | Única autoridad flags — no toggles duplicados en portales |
| **FLG-02** | `FLAGS_READY` post-Config y post-`BUS_READY` |
| **FLG-03** | Env `MDJ_V2_FEATURE_*` + runtime registry — no localStorage ad hoc |
| **FLG-04** | Flag no decide permisos — Permissions decide acceso |
| **FLG-05** | Emit flag change vía bus — catálogo FLAG-EVENTS |

### 9.7 Storage (MOD-012)

| ID | Regla |
|----|-------|
| **STO-01** | Facade única — portales no acceden `localStorage`/`sessionStorage` directo |
| **STO-02** | Prefix obligatorio `mdj_v2_{namespace}_*` |
| **STO-03** | Prohibido secrets, refresh tokens permanentes, service role |
| **STO-04** | Validación pre-write — datos prohibidos → ERR-06xx |
| **STO-05** | Memory authoritative tab; session/local según STORAGE-SPEC |
| **STO-06** | IndexedDB / encrypted — prohibido MVP salvo ADR |

### 9.8 Config (MOD-006)

| ID | Regla |
|----|-------|
| **CFG-01** | Variables canónicas `MDJ_V2_*` — parse solo en MOD-006 |
| **CFG-02** | Config frozen post-boot exitoso — inmutable runtime |
| **CFG-03** | Un build = un entorno (`local` \| `staging` \| `production`) |
| **CFG-04** | Prohibido `SUPABASE_SERVICE_ROLE_KEY` en client bundle |
| **CFG-05** | Prohibido parse env en portales o MOD no autorizado |
| **CFG-06** | Schema validation fail → ERR-0001–0005 + abort |

### 9.9 API Client (MOD-005)

| ID | Regla |
|----|-------|
| **API-01** | Único egress HTTP Supabase/Edge desde MOD-005 |
| **API-02** | Portales y otros MOD llaman API Client — no `fetch` directo a Supabase |
| **API-03** | Errores HTTP → normalización Error Handler ERR-05xx |
| **API-04** | Retry/timeout — `API-RETRY-TIMEOUT-RULES.md` |
| **API-05** | Anon key + user JWT only — nunca service role |
| **API-06** | URLs sin prefijo `/web/` — `MDJ_V2_DEPLOY_ROOT` |

### 9.10 Logging (MOD-010)

| ID | Regla |
|----|-------|
| **LOG-01** | API única `debug|info|warn|error|fatal` — prohibido `console.log` en portales |
| **LOG-02** | Redacción automática — LOG-REDACTION-RULES |
| **LOG-03** | Sin PII bundle, tokens, CRM payloads |
| **LOG-04** | Nivel por `MDJ_V2_LOG_LEVEL` + entorno |
| **LOG-05** | Error Handler delega registro — no duplica formatos |

### 9.11 Error Manager (MOD-014)

| ID | Regla |
|----|-------|
| **ERR-01** | Todo throw/catch desconocido → `NormalizedError` + `ERR-xxxx` |
| **ERR-02** | Categorías C-01–C-10 — sin categoría → C-10 Unexpected |
| **ERR-03** | Portales consumen `userMessageKey` — no construyen errores ad hoc |
| **ERR-04** | Sin stack trace en UI production |
| **ERR-05** | Config fatal → boot abort — no catch silencioso |
| **ERR-06** | Publica eventos error vía bus según ERROR-LIFECYCLE |

---

## 10. Reglas de implementación (conducta agente)

| ID | Regla |
|----|-------|
| **IMP-01** | **Nunca** modificar specs Shared Core (`*-SPEC.md`, `CONTRACTS.md`) sin ticket documental PO |
| **IMP-02** | **Nunca** modificar Blueprint ni Module Catalog desde ticket implementación |
| **IMP-03** | **Nunca** crear módulos fuera del catálogo oficial |
| **IMP-04** | **Nunca** crear dependencias circulares entre MOD o portales |
| **IMP-05** | **Nunca** romper Boot Sequence — test gate obligatorio |
| **IMP-06** | **Nunca** ampliar alcance del ticket — Baseline §50 |
| **IMP-07** | **Nunca** modificar V1 (`web/`, `supabase/` prod paths) |
| **IMP-08** | **Nunca** crear runtime fuera del orden roadmap ADR §17 |
| **IMP-09** | **Nunca** implementar MOD sin spec `DOCUMENTACIÓN COMPLETA` + ticket PO |
| **IMP-10** | **Nunca** declarar IMPLEMENTADO como APROBADO — Baseline §35 |
| **IMP-11** | **Nunca** usar globals `window.__mdj*` como contrato público |
| **IMP-12** | **Nunca** copiar-pegar archivos V1 a V2 — reimplementar desde spec |
| **IMP-13** | **Nunca** mezclar dominios en un diff (header + invoice + portal) |
| **IMP-14** | **Nunca** cerrar ticket sin evidencia mínima §16 |
| **IMP-15** | Detener ante incertidumbre arquitectónica — escalar PO |

---

## 11. Dependencias

### 11.1 Permitidas (post-ADR aprobado + ticket scaffold)

| Categoría | Dependencias | Condición |
|-----------|--------------|-----------|
| **Toolchain** | TypeScript, Vite, Vitest, Playwright, ESLint, Prettier | Ticket scaffold PO |
| **Validación** | Zod (o equivalente declarado en ticket) | Solo MOD-006 Config |
| **Backend client** | `@supabase/supabase-js` v2 | Solo MOD-005 vía wrapper |
| **Dev-only** | tipos, plugins Vite, testing utils | `devDependencies` — no en bundle cliente |

### 11.2 Prohibidas (salvo ADR + PO)

| Categoría | Ejemplos | Motivo |
|-----------|----------|--------|
| **Framework SPA** | React, Vue, Angular, Svelte | ADR DECISION-V2-003 MVP |
| **Segundo bus** | RxJS, mitt como core | Duplica MOD-004 |
| **HTTP alternativo** | axios directo en portales | Bypass MOD-005 |
| **Logging Node** | winston, pino | No browser-first |
| **State global** | Redux, MobX, Pinia | Event Bus + Session authority |
| **Polyfill IE** | core-js massive | Target ES2022 evergreen |
| **Bundler alternativo** | Webpack en paralelo | ADR elige Vite |
| **Deps no listadas** | Cualquier npm sin declaración | IMP-15 + ADR |

### 11.3 Declaración obligatoria

Cada ticket que añada dependencia debe incluir en Authorization Form:

| Campo | Contenido |
|-------|-----------|
| **Paquete** | Nombre + versión exacta |
| **MOD afectado** | ID catálogo |
| **Justificación técnica** | Por qué no implementación propia |
| **Alternativas descartadas** | Mínimo dos |
| **Impacto bundle** | Estimado gzip |
| **ADR** | Referencia si aplica |

Sin estos campos → **no instalar**.

### 11.4 Justificación

- Preferir **implementación propia** cuando spec ya define subsistema (Bus, Log, Error, Storage).
- Dependencia externa solo si reduce riesgo medible **y** no viola IMP-04 / layer boundaries.
- **No decidir por popularidad** — comparar ventajas, desventajas, impacto futuro (criterio ticket ADR).

---

## 12. Importaciones y layer boundaries

### 12.1 Diagrama de capas

```
┌─────────────────────────────────────────┐
│  client/  │  artist/  │  staff/         │  Portales
│  (solo importan shared/public)          │
└────────────────────┬────────────────────┘
                     │  PUBLIC API ONLY
┌────────────────────▼────────────────────┐
│           shared/  Shared Core          │
│  MOD-001 … MOD-016                      │
│  (no importa portales)                  │
└─────────────────────────────────────────┘
```

### 12.2 Imports permitidos

| Desde | Hacia | Permitido |
|-------|-------|-----------|
| Portal | `shared/public/*` o paths exportados ticket scaffold | ✅ |
| Portal | Otro portal | ❌ |
| Portal | `@supabase/*` directo | ❌ → MOD-005 |
| MOD Core A | MOD Core B public API | ✅ si DEPENDENCY-MAP lo autoriza |
| MOD Core | Portal | ❌ |
| Tests | Internals vía `@internal` test alias | ✅ solo en `*.test.ts` si ticket declara |

### 12.3 Imports prohibidos

| Patrón | Motivo |
|--------|--------|
| `../../../` cross-portal | Acoplamiento |
| Import circular A↔B | IMP-04 |
| Dynamic import string no constante sin ADR | Tree-shake / audit |
| Side-effect import sin boot registry | Orden boot roto |
| V1 paths `web/*` | Contaminación V1 |

### 12.4 Cross-module Shared Core

- Consultar `docs/V2/ARCHITECTURE/DEPENDENCY-MAP.md` antes de import.
- Comunicación preferida: **Event Bus** cuando DEPENDENCY-MAP prohíbe import directo.
- Design System ↔ Responsive: coordinación por eventos — no import mutuo.

### 12.5 Shared imports (convención futura scaffold)

| Alias conceptual | Apunta a |
|------------------|----------|
| `@mdj/shared/config` | MOD-006 public API |
| `@mdj/shared/events` | MOD-004 public API |
| `@mdj/shared/session` | MOD-002 public API |
| *(etc.)* | Solo exports en `index` public por MOD |

Internals viven en `./internal/` — no exportados en barrel público.

---

## 13. Estructura — naming, folders, exports

### 13.1 Folders (lab V2)

| Ruta | Contenido permitido |
|------|---------------------|
| `shared/{domain}/` | Implementación MOD + tests colocados |
| `shared/{domain}/internal/` | Privado MOD |
| `client/` | Shell + features portal client |
| `artist/` | Shell + features portal artist |
| `staff/` | Shell + features portal staff |
| `docs/` | Documentación lab — no runtime |
| `tests/e2e/` | Playwright cross-portal (ticket scaffold) |

**Prohibido** en MVP sin ADR: `src/` monolítico único, `runtime/` paralelo, copia `web/`.

### 13.2 Naming

| Elemento | Convención |
|----------|------------|
| Archivos TS | `kebab-case.ts` |
| Clases / types | `PascalCase` |
| Functions | `camelCase` |
| Event names | `UPPER_SNAKE` |
| Error codes | `ERR-xxxx` |
| Storage keys | `mdj_v2_{namespace}_{key}` |
| MOD ids en comments | `MOD-00N` en header archivo |
| Tests | `{module}.test.ts`, `{flow}.spec.ts` (e2e) |

### 13.3 Files

| Regla | Detalle |
|-------|---------|
| **F-01** | Un MOD principal por carpeta domain |
| **F-02** | Max ~400 líneas por archivo — split si excede (ticket refactor PO) |
| **F-03** | Prohibido «god file» estilo V1 `client-portal.js` |
| **F-04** | Spec markdown **no** mezclada con `.ts` en mismo nombre |

### 13.4 Exports

| Tipo | Regla |
|------|-------|
| **Public API** | Export explícito en `{domain}/index.ts` — lista blanca ticket |
| **Internal** | No re-export desde public index |
| **Barrel** | Prohibido `export *` ciego — named exports |
| **Breaking change** | Remover export public → ADR + semver event |

### 13.5 Internal vs Public API

| Public | Internal |
|--------|----------|
| Documentado en CONTRACTS.md | Detalle implementación |
| Stable entre minor releases | Cambio libre en ticket MOD |
| Usado por portales | Solo mismo MOD o tests |
| Contract tested | Unit tested |

---

## 14. Calidad

### 14.1 Lint y formatting

| Herramienta | Regla |
|-------------|-------|
| **ESLint** | Ticket scaffold — reglas `import/no-cycle`, boundaries portal |
| **Prettier** | Formato único repo lab |
| **tsc --noEmit** | CI gate — zero errors strict |
| **dependency-cruiser** | Opcional ticket scaffold — enforce layers |

Prohibido `@ts-ignore` salvo comentario + ticket + revisión PO.

### 14.2 Contract Tests (obligatorios)

| Ámbito | Qué validar |
|--------|-------------|
| Event Bus | Envelope + catálogo EVENT-MAP payloads |
| Config | Schema `MDJ_V2_*` required keys |
| Session | State machine transitions |
| Permissions | Capability matrix snapshot mock |
| API Client | Error mapping ERR-05xx |
| Storage | Namespace + prohibited keys |

**Regla QA-C-01:** Prohibido omitir Contract Tests en ticket MOD P0.

### 14.3 Unit Tests

- Vitest por MOD — cobertura objetivo **≥80%** líneas MOD P0 (ADR).
- Mock Supabase — no red en unit default.

### 14.4 Integration Tests

- Boot phases 0–2 mínimo en ticket Core runtime 001.
- Session + Permissions + Auth cadena.

### 14.5 Smoke Tests

- Playwright: app carga, boot no abort, portal shell visible post-PO visual.

### 14.6 Visual QA

- Baseline §72 — capturas ANTES/DESPUÉS cuando ticket toque UI.
- Agente presenta evidencia — **PO decide**.

### 14.7 Performance QA

- Bundle budget Shared Core MVP < **120 KB** gzip (ADR objetivo).
- No resize storm — debounce 150ms Responsive.
- Prohibido re-mount portal entero en breakpoint change.

---

## 15. Prohibiciones específicas

| ID | Prohibición |
|----|-------------|
| **PRO-01** | NO tocar V1 — `web/`, deploy V1, shared header V1 |
| **PRO-02** | NO modificar componentes FROZEN sin ticket exclusivo PO |
| **PRO-03** | NO cambiar navegación V1 ni V2 spec sin ticket nav |
| **PRO-04** | NO cambiar contratos publicados sin ADR |
| **PRO-05** | NO crear deuda técnica deliberada — Constitución §3 |
| **PRO-06** | NO introducir librerías npm sin declaración §11 |
| **PRO-07** | NO crear módulos experimentales / `playground/` en lab |
| **PRO-08** | NO omitir Contract Tests MOD P0 |
| **PRO-09** | NO polling V1-style (`setInterval` state sync) |
| **PRO-10** | NO secrets en repo, bundle, logs |
| **PRO-11** | NO abrir Runtime Scaffold sin PO post-ADR |
| **PRO-12** | NO Supabase migrations desde ticket frontend runtime |
| **PRO-13** | NO mezclar implementación Shared Core + portal mismo ticket salvo PO |
| **PRO-14** | NO declarar «obra terminada» |

---

## 16. Evidencia obligatoria por ticket Runtime

Todo ticket runtime debe entregar informe con **como mínimo**:

| # | Sección | Contenido |
|---|---------|-----------|
| 1 | **Objetivo** | Qué MOD/fase boot |
| 2 | **Alcance** | Archivos permitidos explícitos |
| 3 | **Archivos modificados** | Lista exacta |
| 4 | **Archivos protegidos** | Confirmación no tocados |
| 5 | **Riesgos** | Regresión, auth, boot |
| 6 | **Evidencia** | ANTES → DESPUÉS → DIFERENCIA |
| 7 | **QA** | Unit / contract / integration / smoke resultados |
| 8 | **Regresiones** | Ninguna conocida o listadas |
| 9 | **Impacto** | MOD/portales afectados |
| 10 | **Próximo paso** | Ticket siguiente recomendado — **no autorizado** |

Metadatos: entorno · fecha · ticket · rama · commit hash si aplica.

**Cierre permitido agente:** IMPLEMENTADO · DOCUMENTADO · EVIDENCIA PRESENTADA · PENDIENTE VALIDACIÓN DEL PRODUCT OWNER.

---

## 17. Orden de implementación aprobado (referencia ADR)

Sin PO + ADR aprobado → **ningún paso ejecutable**:

| Orden | Fase | Ticket tipo |
|-------|------|-------------|
| 0 | Ratificación ADR + estas reglas | Documental PO |
| 1 | Runtime Scaffold | Toolchain vacío |
| 2 | Core Fase 0–1 | Config · Error · Log · Bus |
| 3 | Core Fase 2 | Auth · Session · Permissions |
| 4 | Core Fase 3–5 | Theme · i18n · Flags · Storage · API · UI registry |
| 5 | Portal Shell spec + runtime | Por portal |
| 6 | Módulos portal P0+ | Module Catalog |

**Regla ORD-01:** Prohibido saltar orden sin ADR + PO.

---

## 18. Estado documental

| Campo | Valor |
|-------|-------|
| **Documentado** | Sí |
| **Implementación runtime** | **0%** — ninguna línea de código autorizada por este ticket |
| **Scaffold** | **No autorizado** |
| **Aprobación PO** | **Pendiente** |
| **Commit / push / deploy** | **No autorizado** |

---

## 19. Cierre obligatorio

> Este documento refleja únicamente las reglas operativas de implementación runtime propuestas en TICKET-V2-RUNTIME-IMPLEMENTATION-RULES-001.  
> **No constituye aprobación.**  
> **No autoriza código.**  
> La decisión final corresponde exclusivamente al Product Owner conforme al MIAMIDJBEAT GOVERNANCE BASELINE vigente.

**DOCUMENTADO · EVIDENCIA PRESENTADA · PENDIENTE VALIDACIÓN DEL PRODUCT OWNER**

---

*RUNTIME-IMPLEMENTATION-RULES v1.0 — TICKET-V2-RUNTIME-IMPLEMENTATION-RULES-001 — 2026-07-05*
