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
