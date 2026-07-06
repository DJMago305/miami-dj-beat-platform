# DECISION-INDEX.md

**Ticket:** TICKET-V2-ARCHITECTURE-HANDBOOK-001  
**Tipo:** Índice de decisiones arquitectónicas y gobernanza

> Decisiones completas en documento origen. Nuevas decisiones requieren ADR aprobada PO.

---

## Jerarquía documental

| Nivel | Documento | Autoridad |
|-------|-----------|-----------|
| 1 | Constitución del Proyecto | Máxima |
| 2 | Operación Permanente | Operativa diaria |
| 3 | DECISIONS.md (ADR) | Decisiones registradas |
| 4 | System Blueprint | Plano funcional |
| 5 | Module specs | Implementación futura |

---

## Constitución

| Documento | Ticket | Estado |
|-----------|--------|--------|
| **`docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`** | TICKET-V2-PROJECT-CONSTITUTION-001 | **APROBADA** |

**Contenido clave:** misión, visión, separación V1/V2, jerarquía documental, reglas de modificación vía ADR.

**Operación diaria complementaria:** `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md`

---

## Decisiones registradas (ADR)

| ID | Título | Estado | Ticket cierre | Documento |
|----|--------|--------|---------------|-----------|
| **DECISION-V2-001** | Constitución Oficial del Proyecto | **APROBADA** | TICKET-V2-CONSTITUTION-CLOSE-001 | `docs/DECISIONS.md` |
| **DECISION-V2-002** | Shared Core Documentation First | **APROBADA** | TICKET-V2-END-OF-DAY-DOCUMENTATION-001 | `docs/DECISIONS.md` |
| **DECISION-V2-003** | Runtime Stack Oficial (TypeScript · Vite · Vitest · Playwright) | **APROBADA** | TICKET-V2-ADR-RATIFICATION-CLOSURE-001 | `docs/DECISIONS.md` · ADR: `MiamiDJBeat-MigracionV2/docs/adr/ADR-DECISION-V2-003-RUNTIME-STACK.md` |

### DECISION-V2-001 — Resumen (ir a fuente para texto completo)

- Constitución = documento de mayor jerarquía
- Separación permanente V1 / V2
- Modificaciones solo vía ADR + PO

### DECISION-V2-002 — Resumen (ir a fuente para texto completo)

- **Documentation First** permanente para MigracionV2
- Gate implementación: Blueprint + Contratos + Spec + PO
- Prohibido runtime sin spec completa

### DECISION-V2-003 — Resumen (ir a fuente para texto completo)

- Stack runtime oficial V2 — **APROBADA** PO 2026-07-05
- Lenguaje: **TypeScript 5 strict** · Runtime: **Browser ESM ES2022**
- Build: **Vite 6 MPA** (3 portales) · Tests: **Vitest + Playwright**
- Subsistemas propios: Config · Event Bus · Logging · Error Handler · Storage
- **Sin framework SPA** en MVP Shared Core + shells
- Registro: `docs/DECISIONS.md` · ADR: `MiamiDJBeat-MigracionV2/docs/adr/ADR-DECISION-V2-003-RUNTIME-STACK.md`
- Reglas: `MiamiDJBeat-MigracionV2/docs/RUNTIME-IMPLEMENTATION-RULES.md`
- **No autoriza código** — scaffold: **TICKET-V2-RUNTIME-SCAFFOLD-001** (siguiente fase)

---

## Decisiones arquitectónicas en specs (sin ADR separada aún)

Documentadas en specs de sesión 2026-07-05 — candidatas a ADR formal si PO lo requiere:

| Principio | Fuente spec |
|-----------|-------------|
| Capability-first permissions | `permissions/PERMISSIONS-SPEC.md` |
| Event-driven lifecycle | `events/EVENT-BUS-SPEC.md` |
| Session snapshot inmutable | `session/SESSION-SPEC.md` |
| Single API Client | `api/API-CLIENT-SPEC.md` |
| Storage namespaces `mdj_v2_*` | `storage/STORAGE-SPEC.md` |
| Error normalization ERR-xxxx | `errors/ERROR-HANDLING-SPEC.md` |
| EN canonical i18n | `i18n/I18N-SPEC.md` |
| Dark/gold token authority | `theme/THEME-SPEC.md` |
| Feature flags authority | `feature-flags/FEATURE-FLAGS-SPEC.md` |
| Design System rules | `design-system/DESIGN-SYSTEM-SPEC.md` |
| Components registry | `components/COMPONENTS-SPEC.md` |
| Responsive breakpoints | `responsive/RESPONSIVE-SPEC.md` |

→ Resumen sesión: `docs/V2/SESSION-SUMMARIES/2026-07-05.md`

---

## Reconciliación documental (proceso — no ADR)

| Ticket | Alcance | Estado |
|--------|---------|--------|
| **PHASE-DOC-RECONCILIATION-001** | Sincronizar Handbook, CONTRACTS §2, EVENT-BUS catálogo, métricas históricas | **COMPLETADO** 2026-07-05 |

**Fuentes oficiales únicas:** ver `ARCHITECTURE/ARCHITECTURE-HANDBOOK.md` §Roadmap → Fuentes oficiales.

---

## Plantilla para futuras ADR

```markdown
## DECISION-V2-NNN

| Campo | Valor |
|-------|-------|
| **Fecha** | YYYY-MM-DD |
| **Título** | [Título corto] |
| **Estado** | PROPUESTA \| APROBADA \| RECHAZADA \| SUPERSEDED |
| **Ticket cierre** | TICKET-V2-... |
| **Documento** | `docs/DECISIONS.md` |

### Contexto
[Problema o necesidad]

### Decisión
[Qué se decide]

### Consecuencias
[Impacto en módulos, V1, runtime]

### Aprobación
Product Owner — [ticket] ([fecha])
```

**Registro:** agregar entrada en `docs/DECISIONS.md` tras aprobación PO.

---

## Decisiones constitucionales incorporadas (V2-001)

| ID interno | Tema |
|------------|------|
| DECISIÓN CONSTITUCIONAL-001 | Separación permanente V1/V2 |
| Regla Constitucional | Evaluación V1 vs V2 documentada antes de cambio estratégico V1 |

→ `MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`

---

## Relacionados

| Documento | Rol |
|-----------|-----|
| `MiamiDJBeat-V2-ARQUITECTURA-VIVA.md` | Evolución del diseño |
| `MiamiDJBeat-MigracionV2-MEMORIA.md` | Memoria de proyecto |
| `NOTA-DIARIA-LAB-001.md` | Log operativo lab |

---

*DECISION-INDEX v2.2 — TICKET-V2-ADR-RATIFICATION-CLOSURE-001 — 2026-07-05*
