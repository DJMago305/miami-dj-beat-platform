# ADR — DECISION-V2-003

# Runtime Stack Oficial — MiamiDJBeat-MigracionV2

| Campo | Valor |
|-------|-------|
| **ID** | **DECISION-V2-003** |
| **Fecha** | 2026-07-05 |
| **Ticket** | **TICKET-V2-ADR-RUNTIME-STACK-001** |
| **Estado** | **APROBADA POR PRODUCT OWNER** |
| **Fecha ratificación PO** | 2026-07-05 |
| **Ticket ratificación** | TICKET-V2-ADR-RATIFICATION-001 |
| **Ticket cierre** | TICKET-V2-ADR-RATIFICATION-CLOSURE-001 |
| **Tipo** | Architecture Decision Record — Fase Runtime (apertura documental) |
| **Alcance** | Stack tecnológico del laboratorio V2 — **sin implementación** |
| **Supersede** | — |
| **Registro formal** | `docs/DECISIONS.md` — **DECISION-V2-003** |

> **Este ADR abre oficialmente la Fase Runtime a nivel documental.**  
> **No autoriza** escribir código, crear `package.json`, instalar dependencias, ni levantar build.

---

## 1. Contexto

### 1.1 Situación actual

| Hecho | Evidencia |
|-------|-----------|
| V1 opera en `web/` sin capa de build | Arquitectura Viva §1 |
| V2 lab = `MiamiDJBeat-MigracionV2/` aislado | Constitución · DECISION-V2-001 |
| Shared Core **16/16** specs completas | `SHARED-CORE-PROGRESS.md` |
| Implementación runtime **0%** | Module Catalog · Blueprint §11 |
| Metodología **Documentation First** | DECISION-V2-002 |
| Boot canónico definido | `BOOT-SEQUENCE.md` |
| Contratos Event Bus, Config, Storage, Logging, Errors definidos | Specs MOD-004–014 |

### 1.2 Problema a resolver

Antes de la **primera línea de código runtime**, el proyecto necesita una decisión arquitectónica **única y explícita** sobre:

- Lenguaje y target de ejecución
- Herramientas de build y entorno de desarrollo
- Estrategia de pruebas
- Implementación conceptual de subsistemas transversales (Config, Event Bus, Logging, Error Handler, Storage)
- Compatibilidad navegador, performance y escalabilidad

Sin ADR, cada ticket futuro improvisaría stack → violación de Constitución §4 (decisión arquitectónica = ADR) y Blueprint §13 criterio #6.

### 1.3 Restricciones no negociables

| Restricción | Fuente |
|-------------|--------|
| V2 **no modifica** V1 durante lab | Constitución · D-06 |
| Shared Core **no** contiene nav/páginas de portal | Blueprint · Arquitectura Viva §5 |
| Boot order **Configuration → Event Bus → Auth → …** | `BOOT-SEQUENCE.md` |
| Eventos JSON-safe, sin DOM en payload | `EVENT-BUS-SPEC.md` |
| Config solo vía MOD-006; env `MDJ_V2_*` | `CONFIG-SPEC.md` |
| Storage namespaces `mdj_v2_*` | `STORAGE-SPEC.md` |
| Errores normalizados `ERR-xxxx` | `ERROR-HANDLING-SPEC.md` |
| Logs estructurados redactados | `LOGGING-SPEC.md` |
| Permisos vía snapshot DB, no JWT solo | Permissions spec · lecciones V1 |

---

## 2. Decisión (stack recomendado)

### 2.1 Resumen ejecutivo

| Capa | Decisión |
|------|----------|
| **Lenguaje oficial** | **TypeScript 5.x** — modo `strict` |
| **Runtime de ejecución** | **Navegador nativo ESM** — target **ES2022** |
| **Arquitectura modular** | **Monorepo físico por dominio** (`shared/` · `client/` · `artist/` · `staff/`) + **registro de módulos MOD-xxx** + boot secuencial |
| **Build** | **Vite 6.x** — multi-entry (3 portales) + typecheck `tsc --noEmit` |
| **Testing unitario / integración** | **Vitest 3.x** + **jsdom** (DOM ligero) |
| **Testing E2E** | **Playwright** — un proyecto por portal |
| **Logging (MOD-010)** | **Implementación propia** alineada a `LOGGING-SPEC.md` |
| **Error Manager (MOD-014)** | **Implementación propia** alineada a `ERROR-HANDLING-SPEC.md` |
| **Event Bus (MOD-004)** | **Bus in-memory propio** — catálogo tipado, cola sync/async |
| **Runtime Config (MOD-006)** | **Validador de schema en boot** — env `MDJ_V2_*` inyectadas por Vite |
| **Runtime Storage (MOD-012)** | **Facade** sobre Memory · sessionStorage · localStorage |
| **UI framework** | **Sin framework SPA global** en MVP — Web Components / DOM imperativo tipado + Design System (MOD-008/009) |
| **Backend client** | **Supabase JS v2** vía MOD-005 API Client (futuro ticket) |

---

## 3. Lenguaje oficial — TypeScript

### 3.1 Decisión

**TypeScript 5.x strict** es el lenguaje oficial de todo código runtime V2.

### 3.2 Alternativas evaluadas

| Alternativa | Ventajas | Desventajas | Veredicto |
|-------------|----------|-------------|-----------|
| **JavaScript ES2022** | Cero transpile; paridad con V1 | Sin tipos en 16 MOD con contratos; errores en runtime; refactors costosos | **Descartada** |
| **TypeScript strict** | Contratos compile-time; alinea tablas de spec; IDE; tests tipados | Curva inicial; build step | **Elegida** |
| **JSDoc + checkJs** | Sin `.ts` | Frágil a escala 73 módulos; no enforce imports | **Descartada** |
| **ReScript / Elm** | Seguridad tipos | Ecosistema ajeno; curva equipo; specs en TS-like | **Descartada** |

### 3.3 Justificación técnica

- Specs ya usan columnas **Tipo**, estados de máquina y rangos `ERR-xxxx` — naturalmente mapeables a tipos.
- Event Bus exige envelope tipado por `name` + `version` — **discriminated unions** en TS previenen emits inválidos.
- V1 falló por globals implícitos (`window.__mdj*`) — TS + `exports` explícitos cierra brecha.
- DECISION-V2-002 exige contratos antes de código — TS es la capa de enforcement estático.

### 3.4 Impacto futuro

- Cada MOD implementado exporta API pública tipada; breaking change = bump + ADR.
- Portal code importa solo `@mdj/shared/*` paths declarados — lint boundaries en ticket scaffold.

---

## 4. Runtime de ejecución

### 4.1 Decisión

Código cliente corre **exclusivamente en navegador** como **ES Modules nativos**. No Node.js en runtime cliente. Target compilación: **ES2022** (async/await, class fields, top-level await permitido en entries controlados).

### 4.2 Alternativas evaluadas

| Alternativa | Ventajas | Desventajas | Veredicto |
|-------------|----------|-------------|-----------|
| **Browser ESM** | Alineado Vite; tree-shaking; sin polyfill pesado | Requiere browsers evergreen | **Elegida** |
| **Browser + SystemJS** | Legacy loaders | Complejidad; V1 no lo usa en V2 | **Descartada** |
| **Electron / Tauri desktop** | Offline | Fuera alcance web portals; MDJPRO es producto Mac separado | **Descartada** para V2 web |
| **SSR Next/Nuxt** | SEO | Portales autenticados; SEO en marketing V1; duplica deploy | **Descartada** MVP |

### 4.3 Compatibilidad navegador (baseline recomendado)

| Navegador | Versión mínima |
|-----------|----------------|
| Chrome / Edge (Chromium) | Últimas **2** versiones major |
| Firefox | Últimas **2** versiones major |
| Safari (macOS + iOS) | **Safari 16+** / **iOS 16+** |
| Internet Explorer | **No soportado** |

**APIs requeridas:** ES modules, `fetch`, `sessionStorage`/`localStorage`, `matchMedia`, `CustomEvent` (solo si ADR interno lo autoriza — preferir bus propio), `ResizeObserver`, `Intl` (i18n).

**Verificación:** matriz Playwright en ticket scaffold; no asumir IE polyfills.

---

## 5. Arquitectura modular

### 5.1 Decisión

**Modelo de capas + módulos MOD-xxx** con límites físicos y de import:

```
MiamiDJBeat-MigracionV2/
├── shared/          ← Shared Core (MOD-001…016) — sin UI de portal
├── client/          ← Portal Client — solo importa shared public API
├── artist/          ← Portal Artist
├── staff/           ← Portal Staff
└── docs/            ← ADR, runbooks (no runtime)
```

**Reglas de acoplamiento:**

| Regla | Detalle |
|-------|---------|
| **R-01** | Portales **no** importan entre sí |
| **R-02** | Shared **no** importa portales |
| **R-03** | Módulos Core se comunican vía **Event Bus** o interfaces públicas — no singletons globales |
| **R-04** | Boot único vía `bootstrap/` (futuro) siguiendo `BOOT-SEQUENCE.md` |
| **R-05** | Design System (MOD-008) = reglas + tokens; Components (MOD-009) = primitivas — no páginas |
| **R-06** | Prohibido `window.__mdj*` como contrato público — registry interno encapsulado |

### 5.2 Alternativas evaluadas

| Alternativa | Ventajas | Desventajas | Veredicto |
|-------------|----------|-------------|-----------|
| **Monolito single bundle** | Simple | Repite error V1; regresiones cruzadas | **Descartada** |
| **Micro-frontends Module Federation** | Deploy independiente | Overkill lab; complejidad operativa prematura | **Descartada** fase 1 |
| **Monorepo MOD-xxx + event bus** | Alinea specs; testeable | Requiere disciplina lint | **Elegida** |
| **Nx/Turborepo orchestrator** | Caching builds | Dependencia extra; ticket futuro si escala | **Diferida** — reevaluar si >4 packages |

### 5.3 Escalabilidad

- **Horizontal de producto:** nuevos MOD en catálogo → carpeta spec existente + implementación acotada.
- **Horizontal de portales:** cuarto portal = nuevo entry Vite + shell — Shared Core intacto.
- **Vertical:** lazy routes por módulo portal; code-split por entry.
- **Migración V1:** módulo completo cutover — no file-by-file (Constitución D-04).

---

## 6. Sistema de Build — Vite

### 6.1 Decisión

**Vite 6.x** como herramienta única de dev server, bundling y env injection para el lab V2.

**Configuración conceptual (sin archivos en este ticket):**

| Aspecto | Elección |
|---------|----------|
| Entradas | `client/index.html`, `artist/index.html`, `staff/index.html` (MPA) |
| Salida | `dist/` bajo lab — **nunca** `web/` |
| Env prefix | `MDJ_V2_` — alineado `CONFIG-SPEC.md` |
| Typecheck | `tsc --noEmit` en CI — separado del transpile esbuild de Vite |
| Assets | `assets/` lab; WOFF2 subset per PERFORMANCE-GUIDELINES |
| Source maps | `hidden` staging · `false` production (ADR seguridad futura) |

### 6.2 Alternativas evaluadas

| Herramienta | Ventajas | Desventajas | Veredicto |
|-------------|----------|-------------|-----------|
| **Vite** | ESM nativo; HMR rápido; multi-page; env simple | Requiere Node dev | **Elegida** |
| **Webpack 5** | Maduro | Config pesada; HMR más lento greenfield | **Descartada** |
| **Rollup solo** | Bundle fino | Sin dev server integrado comparable | **Descartada** como primario |
| **esbuild CLI** | Velocidad | Sin ecosystem MPA/html | **Descartada** como primario |
| **Sin build (copia V1)** | Paridad V1 | Impide TS strict; no tree-shake; repite deuda | **Descartada** |
| **Parcel** | Zero-config | Menos control multi-portal | **Descartada** |

### 6.3 Justificación

- Lab necesita **tres portales independientes** (Blueprint §2) — Vite MPA es patrón documentado y mantenible.
- `MDJ_V2_ENV` y URLs portal inyectadas en build time cumplen CONFIG-SPEC §2–3.
- Vite no toca V1; deploy preview V2 separado en Vercel project futuro (ADR infra separado).

---

## 7. Sistema de Testing

### 7.1 Decisión

| Capa | Herramienta | Alcance |
|------|-------------|---------|
| **Unit** | Vitest | MOD-004 bus, MOD-006 config validate, MOD-014 normalize, MOD-012 namespaces |
| **Integration** | Vitest + jsdom | Boot sequence phases 0–2 mock |
| **Contract** | Vitest | Payload eventos vs catálogo EVENT-MAP |
| **E2E** | Playwright | Smoke portal shell, auth gate, nav contract |
| **Visual regression** | Playwright screenshots | Solo tickets PO que lo exijan — Baseline §72 |

### 7.2 Alternativas evaluadas

| Herramienta | Veredicto | Motivo |
|-------------|-----------|--------|
| **Jest** | Descartada | Duplicidad con Vitest; peor integración Vite |
| **Cypress** | Descartada E2E primario | Playwright multi-browser superior para 3 portales |
| **Testing Library** | Adoptable en ticket UI | No obligatorio MVP Core |
| **Sin tests** | Descartada | Blueprint §12 riesgo event bus; Constitución calidad |

### 7.3 Criterios de aceptación runtime (futuro)

- Boot abort si CONFIG fatal — test obligatorio.
- Ningún emit antes `BUS_READY` — test obligatorio.
- Cobertura mínima Shared Core P0: **80%** líneas en MOD-004–006–014 (objetivo ticket implementación).

---

## 8. Logging (MOD-010)

### 8.1 Decisión

**Implementación propia** — clase `LoggingService` (nombre ilustrativo) que cumple `LOGGING-SPEC.md`:

| Requisito | Implementación |
|-----------|----------------|
| API | `debug | info | warn | error | fatal` |
| Redacción | Pipeline regex + key denylist `LOG-REDACTION-RULES.md` |
| Sink dev | `console` con formato estructurado JSON line |
| Sink prod | Buffer opcional → remote ADR futuro; MVP console filtrado |
| Integración | Error Handler delega; Event Bus log debug emits |

### 8.2 Alternativas descartadas

| Alternativa | Motivo descarte |
|-------------|-----------------|
| **winston / pino** | Orientados Node; no browser-first |
| **console.log libre** | Violación LOGGING-SPEC §4 |
| **Sentry solo** | Complemento futuro — no reemplaza MOD-010 |

---

## 9. Error Manager (MOD-014)

### 9.1 Decisión

**Implementación propia** — pipeline:

```
unknown throw/catch → classify (C-01…C-10) → ERR-xxxx → NormalizedError → Logging + Event Bus + userMessageKey
```

| Propiedad | Fuente spec |
|-----------|-------------|
| Categorías 10 | ERROR-HANDLING-SPEC §2 |
| Severidad 5 | ERROR-SEVERITY.md |
| Sin stack en prod UI | ERROR-HANDLING-SPEC |
| Config fatal ERR-0001–0005 abort boot | BOOT-SEQUENCE Fase 0 |

### 9.2 Alternativas descartadas

| Alternativa | Motivo |
|-------------|--------|
| **Errores string ad hoc** | V1 pattern — prohibido |
| **HTTP codes only** | Insuficiente — dominio business ERR-07xx |
| **Zone.js / error boundaries React** | No hay React en MVP |

---

## 10. Runtime Event Bus (MOD-004)

### 10.1 Decisión

**Bus in-memory propio** con:

| Característica | Detalle |
|----------------|---------|
| Estados | `BUS_UNINITIALIZED → BUS_READY → …` |
| Envelope | Campos EVENT-BUS-SPEC §1 |
| Subscribe | `on`, `once`, `off` — handlers async-safe |
| Emit | Validación schema + scope `internal|public` |
| Catch-up | Cola replay para late subscribers (spec EVENT-LIFECYCLE) |
| Threading | Microtask queue — no `setInterval` poll |

### 10.2 Alternativas evaluadas

| Alternativa | Ventajas | Desventajas | Veredicto |
|-------------|----------|-------------|-----------|
| **Custom bus** | Control total; alinea spec | Costo implementación | **Elegida** |
| **mitt / eventemitter3** | Ligero | Sin estados bus; sin envelope versionado | **Descartada** como core — posible interno |
| **RxJS** | Streams | Curva; overkill; riesgo poll | **Descartada** |
| **DOM CustomEvent** | Nativo | Mezcla DOM/lógica; payload no tipado | **Descartada** |
| **Supabase Realtime** | Server push | No reemplaza lifecycle client boot | **Complemento** MOD-005 futuro |

---

## 11. Runtime Config (MOD-006)

### 11.1 Decisión

| Aspecto | Elección |
|---------|----------|
| Fuente | Variables `MDJ_V2_*` en build (Vite `import.meta.env`) |
| Validación | Schema validator — **Zod** recomendado en ticket scaffold (dependencia explícita futura) |
| Freeze | Config inmutable post-boot exitoso |
| Fail-fast | ERR-0001–0005 → abort + Logging fatal |

### 11.2 Alternativas descartadas

| Alternativa | Motivo |
|-------------|--------|
| **Parse manual sin schema** | Errores silenciosos staging/prod |
| **JSON config file en repo** | Secret leak risk; no env-specific |
| **Runtime fetch config remoto** | Boot circular; ticket infra separado |

---

## 12. Runtime Storage (MOD-012)

### 12.1 Decisión

**Facade `StorageService`** con backends:

| Backend | MVP | Uso |
|---------|-----|-----|
| Memory | ✅ | Authoritative tab snapshot |
| sessionStorage | ✅ | Tab-scoped restore |
| localStorage | ✅ | Prefs no secret |
| IndexedDB | ❌ fase 2 | Drafts grandes |
| Encrypted | ❌ ADR futuro | Web Crypto |

Keys: prefix `mdj_v2_{namespace}_*` — STORAGE-NAMESPACE-RULES.md.

### 12.2 Alternativas descartadas

| Alternativa | Motivo |
|-------------|--------|
| **Acceso directo storage en portales** | Viola single authority |
| **Cookies para session** | ADR pendiente `MDJ_V2_SESSION_STORAGE` |
| **Supabase como local cache** | Confunde remote/local |

---

## 13. UI y componentes

### 13.1 Decisión

**Sin React / Vue / Angular** en MVP Shared Core + portal shells.

| Capa | Enfoque |
|------|---------|
| MOD-008 Design System | Tokens CSS variables + documentación |
| MOD-009 Components | Web Components (`customElements`) **o** factory functions TS + templates — ticket implementación elige uno; ambos ESM-native |
| Portales | HTML shell mínimo + bootstrap TS |

### 13.2 Alternativas evaluadas

| Framework | Veredicto | Motivo |
|-----------|-----------|--------|
| **React 19** | Diferida ADR portal | Bundle size; curva; no requerido para Core |
| **Vue 3** | Diferida | Idem |
| **Lit 3** | Candidata fuerte WC | Evaluar ticket Components si PO prefiere WC estándar |
| **Svelte** | Descartada MVP | Menor ecosistema interno |
| **Copiar HTML V1** | Descartada | Arrastra deuda layout/nav |

**Nota:** Adoptar framework en **un portal** requeriría **ADR separada** — no mezclar en DECISION-V2-003 sin PO.

---

## 14. Performance

| Principio | Implementación runtime |
|-----------|------------------------|
| No polling V1-style | Event Bus + session state machine |
| Code splitting | Por portal entry Vite |
| Lazy modules | Dynamic `import()` portal routes post-SHELL_READY |
| Resize | Single Responsive authority — debounce 150ms (PERFORMANCE-GUIDELINES) |
| Assets | WOFF2 subset; lazy images below fold |
| Bundle budget ADR | Core shared < **120 KB** gzip MVP (objetivo medible ticket scaffold) |

---

## 15. Riesgos

| ID | Riesgo | Prob. | Impacto | Mitigación |
|----|--------|-------|---------|------------|
| R-01 | TS strict bloquea velocidad inicial | Media | Media | Templates MOD; ticket scaffold |
| R-02 | Event bus mal implementado → nav drift | Media | Alta | Contract tests; lint no-poll |
| R-03 | Vite env leak anon key mal configurado | Baja | Alta | CONFIG-SPEC prohibiciones; review PO |
| R-04 | Tres entries duplican chunk shared | Media | Media | Manual chunks Vite `shared` |
| R-05 | Sin framework → UI verbose | Media | Media | Components library MOD-009 |
| R-06 | Playwright flake E2E | Media | Baja | Smoke mínimo; no gate deploy MVP |
| R-07 | Safari ESM edge cases | Baja | Media | Matriz browser CI |
| R-08 | Agente implementa antes PO aprueba ADR | Media | Alta | Gate DECISION-V2-002 + este ADR |
| R-09 | Confusión V1/V2 deploy root | Media | Alta | `MDJ_V2_DEPLOY_ROOT` sin `/web/` |
| R-10 | Import circular shared | Media | Alta | dependency-cruiser ticket scaffold |

---

## 16. Compatibilidad con documentos superiores

### 16.1 Shared Core (specs MOD-001–016)

| Spec | Compatibilidad ADR |
|------|-------------------|
| BOOT-SEQUENCE | ✅ Boot TS modules en orden exacto |
| EVENT-BUS-SPEC | ✅ Bus propio cumple envelope |
| CONFIG-SPEC | ✅ Vite env `MDJ_V2_*` |
| LOGGING-SPEC | ✅ Implementación propia |
| ERROR-HANDLING-SPEC | ✅ ERR-xxxx pipeline |
| STORAGE-SPEC | ✅ Facade namespaces |
| CONTRACTS.md | ✅ TS interfaces public API |
| API-CLIENT-SPEC | ✅ Supabase JS v2 behind MOD-005 |

**No modifica** ningún spec — solo declara cómo se implementarán.

### 16.2 System Blueprint

| Blueprint | Alineación |
|-----------|------------|
| Tres portales independientes | ✅ Vite multi-entry |
| Shared Core transversal | ✅ `shared/` package |
| Operations Core single order | ✅ Sin impacto stack — dominio Supabase |
| Criterio §13 #6 ADR stack | ✅ Este documento |
| Sin framework en Blueprint | ✅ No contradice — Blueprint defería stack |

### 16.3 Gobernanza

| Documento | Cumplimiento |
|-----------|--------------|
| Constitución §4 ADR para arquitectura | ✅ |
| DECISION-V2-002 Documentation First | ✅ ADR antes de código |
| Baseline §65 alcance ticket | ✅ Solo docs ADR |
| Baseline §70 detención | ✅ Sin implementación |
| Pipeline etapa 11–14 | Evidencia documental → PO |

---

## 17. Roadmap — inicio Runtime (post-aprobación PO)

**Secuencia obligatoria — ningún paso sin ticket + PO:**

| Fase | Ticket recomendado | Entregable | Gate |
|------|-------------------|------------|------|
| **0** | PO ratifica **DECISION-V2-003** | Entrada `docs/DECISIONS.md` | PO firma |
| **1** | `TICKET-V2-RUNTIME-SCAFFOLD-001` | `package.json`, Vite MPA vacío, tsconfig, lint boundaries — **sin lógica negocio** | PO + Arquitecto |
| **2** | `TICKET-V2-SHARED-CORE-RUNTIME-001` | MOD-006 Config + MOD-014 Error + MOD-010 Logging + MOD-004 Bus — boot Fase 0–1 | Tests Vitest green |
| **3** | `TICKET-V2-SHARED-CORE-RUNTIME-002` | MOD-001 Auth + MOD-002 Session + MOD-003 Permissions — Fase 2 | SESSION_READY test |
| **4** | `TICKET-V2-SHARED-CORE-RUNTIME-003` | MOD-007 Theme + MOD-015 i18n + MOD-013 Flags — Fase 3 | THEME_READY / LOCALE_READY |
| **5** | `TICKET-V2-PORTAL-SHELL-SPEC-001` | Spec shells client/artist/staff | Documentación |
| **6** | `TICKET-V2-PORTAL-SHELL-RUNTIME-001` | HTML+TS shells mínimos | Playwright smoke |
| **7** | Módulos portal P0 | Según Module Catalog | Cutover olas ADR |

**Prohibido saltar a Fase 1 (scaffold)** sin ticket PO explícito (**TICKET-V2-RUNTIME-SCAFFOLD-001**) — DECISION-V2-003 **APROBADA** 2026-07-05; ratificación **no** autoriza código automáticamente.

---

## 18. Recomendación final

Se recomienda al Product Owner **ratificar DECISION-V2-003** con el stack:

> **TypeScript strict · Browser ESM ES2022 · Vite 6 MPA · Vitest + Playwright · Shared Core modular MOD-xxx · subsistemas propios Config / Event Bus / Logging / Errors / Storage · sin framework SPA en MVP · Supabase v2 vía API Client.**

Esta combinación:

1. Corrige deuda estructural V1 (globals, monolito, poll) sin tocar V1.
2. Respeta **100%** specs Shared Core existentes.
3. Minimiza sorpresas operativas (Vite/Vitest/Playwright estándar industria).
4. Mantiene puerta abierta a ADR futura (framework portal, IndexedDB, remote logging).

---

## 19. Estado y aprobación

| Campo | Valor |
|-------|-------|
| **Estado ADR** | **APROBADA POR PRODUCT OWNER** |
| **Fecha ratificación** | 2026-07-05 |
| **Registro oficial** | `docs/DECISIONS.md` — DECISION-V2-003 |
| **Ticket cierre documental** | TICKET-V2-ADR-RATIFICATION-CLOSURE-001 |
| **Implementación autorizada** | **NO** — requiere ticket scaffold/implementación PO |
| **Runtime autorizado** | **NO** — requiere TICKET-V2-RUNTIME-SCAFFOLD-001+ |
| **Aprobación Product Owner** | **Ratificada** — TICKET-V2-ADR-RATIFICATION-CLOSURE-001 (2026-07-05) |

---

## 20. Referencias

| Documento | Ruta |
|-----------|------|
| Constitución | `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` |
| Blueprint | `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` |
| Boot Sequence | `docs/V2/ARCHITECTURE/BOOT-SEQUENCE.md` |
| Decision Index | `docs/V2/ARCHITECTURE/DECISION-INDEX.md` |
| Shared Core Progress | `docs/V2/SHARED-CORE-PROGRESS.md` |
| DECISION-V2-002 | `docs/DECISIONS.md` |
| Specs Shared | `MiamiDJBeat-MigracionV2/shared/` |

---

*ADR-DECISION-V2-003 — TICKET-V2-ADR-RUNTIME-STACK-001 · cierre TICKET-V2-ADR-RATIFICATION-CLOSURE-001 — 2026-07-05*  
*APROBADA POR PRODUCT OWNER · REGISTRO: docs/DECISIONS.md · EXPEDIENTE CERRADO*
