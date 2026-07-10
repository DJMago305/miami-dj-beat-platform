# MIAMI DJ BEAT

# GOVERNANCE — AGENT STARTUP GATE

**Ticket:** TICKET-V2-GOVERNANCE-AGENT-ONBOARDING-GATE-001 · **TICKET-V2-GOVERNANCE-AGENT-PIPELINE-001**  
**Proyecto:** MiamiDJBeat  
**Estado documental:** DOCUMENTADO — **PENDIENTE VALIDACIÓN PRODUCT OWNER**  
**Audiencia:** Agentes IA, desarrolladores, colaboradores

---

## Propósito de esta carpeta

`docs/V2/GOVERNANCE/` es el **sistema de arranque y pipeline obligatorio para agentes**.

Ningún agente puede trabajar en MiamiDJBeat — V1, V2, documentación, runtime o laboratorio — **sin pasar por este Gate y Pipeline** antes de tocar archivos, declarar estados o entregar informes.

---

## Jerarquía de autoridad

| Nivel | Documento | Rol |
|-------|-----------|-----|
| **1 — Máxima** | `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Constitución del Proyecto |
| **2 — Gobernanza operativa** | `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | **MIAMIDJBEAT GOVERNANCE BASELINE v3.1** |
| **3 — Operación diaria** | `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` | Operation Guide |
| **4 — Gate de agente** | Esta carpeta `GOVERNANCE/` | Lectura, checklist y formulario previos al trabajo |
| **5 — Informes de agente** | Entregables por ticket | **No sustituyen** Baseline ni PO |

**Reglas permanentes:**

- El **Baseline manda** sobre cualquier informe de agente.
- La **Constitución manda** sobre el Baseline.
- El **Product Owner** es la **única autoridad** de validación, aprobación y autorización (commit · push · deploy).

→ Autoridad normativa: Baseline [§3](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#3-regla-de-oro) · [§45](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#45-matriz-oficial-de-autoridad) · [§76](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#76-cláusula-final-del-product-owner)

---

## Índice oficial del sistema de gobernanza

| Archivo | Función |
|---------|---------|
| **[AGENT-GOVERNANCE-PIPELINE.md](./AGENT-GOVERNANCE-PIPELINE.md)** | **Pipeline oficial obligatorio** — flujo completo antes · durante · después del trabajo |
| **[AGENT-STARTUP-GATE.md](./AGENT-STARTUP-GATE.md)** | Protocolo obligatorio de inicio — orden de lectura y reglas antes de trabajar |
| **[AGENT-READING-CHECKLIST.md](./AGENT-READING-CHECKLIST.md)** | Checklist que **debe completarse** antes de iniciar |
| **[AGENT-WORK-AUTHORIZATION-FORM.md](./AGENT-WORK-AUTHORIZATION-FORM.md)** | Plantilla obligatoria de declaración de alcance por ticket |
| **[GOVERNANCE-VIOLATION-CHECKLIST.md](./GOVERNANCE-VIOLATION-CHECKLIST.md)** | Autoauditoría previa y final — posibles violaciones |
| **[INCIDENT-V2-PR-PREVIEW-001.md](./INCIDENT-V2-PR-PREVIEW-001.md)** | **Incidente gobernanza 2026-07-10** — PR activa Preview automático; política LOCALHOST / RAMA / PR / PREVIEW / PRODUCCIÓN |

**Documento maestro de referencia (fuera de esta carpeta):** [MIAMIDJBEAT GOVERNANCE BASELINE v3.1](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md)

---

## Flujo obligatorio (resumen)

Ver flujo completo en **[AGENT-GOVERNANCE-PIPELINE.md](./AGENT-GOVERNANCE-PIPELINE.md)**.

```
PO → README → Startup Gate → Baseline → Constitución → Operation Guide → Ticket
→ Reading Checklist → Authorization Form → Violation Checklist (previa)
→ Trabajo → Violation Checklist (final) → Evidencia → Validación visual PO
→ PO Review → [APROBADO] → COMMIT → PUSH → DEPLOY → Cierre
```

**Prohibido** iniciar implementación, edición de archivos o declaraciones de estado **antes** de Startup Gate + Checklist + Authorization Form.

---

## Autoridad referenciada

Documento normativo único de gobernanza:

**`docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md`**  
**MIAMIDJBEAT GOVERNANCE BASELINE v3.1 · BASELINE · FROZEN**

Este Gate y Pipeline **no reemplazan** el Baseline — lo **operacionalizan** para onboarding y flujo diario de agentes.

---

## Estado documental

| Campo | Valor |
|-------|-------|
| **Documentado** | Sí |
| **Evidencia presentada** | Sí |
| **Aprobado** | **No** — pendiente validación Product Owner |
| **Commit / push / deploy** | **No autorizado** |

---

*SIN DEPLOY* no implica automáticamente *SIN PREVIEW* ni *SIN PR*. Ver [INCIDENT-V2-PR-PREVIEW-001.md](./INCIDENT-V2-PR-PREVIEW-001.md).

*TICKET-V2-GOVERNANCE-AGENT-ONBOARDING-GATE-001 · TICKET-V2-GOVERNANCE-AGENT-PIPELINE-001 — 2026-07-05 · incidente PR Preview — 2026-07-10*
