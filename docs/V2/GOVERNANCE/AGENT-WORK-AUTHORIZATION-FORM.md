# MIAMI DJ BEAT

# AGENT WORK AUTHORIZATION FORM

## Plantilla obligatoria por ticket

**Ticket:** TICKET-V2-GOVERNANCE-AGENT-ONBOARDING-GATE-001 (plantilla)  
**Autoridad normativa:** [MIAMIDJBEAT GOVERNANCE BASELINE v3.1](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md)  
**Uso:** Rellenar **una copia por ticket** antes de la primera edición o auditoría activa

> Este formulario **no sustituye** autorización del Product Owner. Documenta lo que el agente **declara haber leído y entendido**. La aprobación formal requiere PO / POAC (Baseline §34).

---

## Plantilla (copiar y completar)

```markdown
# AGENT WORK AUTHORIZATION FORM

Ticket:
Fecha:
Agente:

Objetivo:

Alcance autorizado:

Archivos permitidos:

Archivos prohibidos:

Componentes protegidos:

Componentes FROZEN:

Riesgo local:

Riesgo compartido:

Riesgo global:

Evidencia requerida:

Validación PO requerida:

Estado inicial:

Autorización recibida:

Observaciones:
```

---

## Guía de campos

| Campo | Qué declarar |
|-------|----------------|
| **Ticket** | ID exacto del ticket PO (ej. `TICKET-V2-…-001`) |
| **Fecha** | ISO 8601 recomendado |
| **Agente** | Identificador de sesión / agente |
| **Objetivo** | Una frase — qué entrega el ticket |
| **Alcance autorizado** | Qué está incluido — citar ticket PO |
| **Archivos permitidos** | Rutas explícitas — solo estas |
| **Archivos prohibidos** | Todo lo demás + maestros §49 si no autorizados |
| **Componentes protegidos** | Nav · header · auth · shared — Baseline §58 · §63 |
| **Componentes FROZEN** | Listar FROZEN conocidos · N/A si ninguno en zona |
| **Riesgo local** | Un archivo / bloque |
| **Riesgo compartido** | CSS/JS compartido · múltiples páginas |
| **Riesgo global** | Producción · header · bootstrap · auth |
| **Evidencia requerida** | ANTES · DESPUÉS · DIFERENCIA · entorno §78 |
| **Validación PO requerida** | Visual · documental · funcional — según ticket |
| **Estado inicial** | PLANIFICADO · AUTORIZADO · etc. (Baseline §5) |
| **Autorización recibida** | Qué dijo PO explícitamente — o «Pendiente PO» |
| **Observaciones** | Limitaciones · N/A · dependencias |

---

## Reglas de uso

| Regla | Descripción |
|-------|-------------|
| F-01 | **Sin formulario completo → sin edición** |
| F-02 | Nuevo archivo durante trabajo → **detener** (Baseline §65) |
| F-03 | Impacto mayor al declarado → **detener** (Baseline §62) |
| F-04 | «Autorización recibida» solo con comunicación PO verificable |
| F-05 | Adjuntar o referenciar [AGENT-READING-CHECKLIST.md](./AGENT-READING-CHECKLIST.md) completado |

---

## Ejemplo mínimo (documentación only)

```markdown
Ticket: TICKET-V2-EJEMPLO-DOC-001
Fecha: 2026-07-05
Agente: [sesión]

Objetivo: Actualizar un único archivo de gobernanza en docs/V2/GOVERNANCE/

Alcance autorizado: Crear AGENT-STARTUP-GATE.md únicamente

Archivos permitidos: docs/V2/GOVERNANCE/AGENT-STARTUP-GATE.md

Archivos prohibidos: web/ · Shared Core · Baseline · Constitución · resto del repo

Componentes protegidos: Header, nav, auth, shared JS/CSS — no aplican (solo docs)

Componentes FROZEN: N/A en alcance

Riesgo local: Bajo — un archivo nuevo en GOVERNANCE/

Riesgo compartido: Ninguno

Riesgo global: Ninguno — sin producción

Evidencia requerida: Diff · rutas · checklist completado

Validación PO requerida: Documental + revisión PO

Estado inicial: AUTORIZADO (declarado en ticket)

Autorización recibida: Pendiente confirmación PO explícita

Observaciones: No commit sin AUTORIZADO COMMIT
```

*(Ejemplo ilustrativo — no implica ticket real ni aprobación.)*

---

## Cierre obligatorio del agente

Al terminar el trabajo del ticket, añadir al informe:

```
Estado del trabajo:
IMPLEMENTADO / DOCUMENTADO: [según aplique]
EVIDENCIA PRESENTADA: SÍ
Pendiente: VALIDACIÓN DEL PRODUCT OWNER

Observación obligatoria (Baseline §36):
"Este informe refleja únicamente la evidencia observada durante esta revisión.
No constituye aprobación del trabajo.
La decisión final corresponde exclusivamente al Product Owner."
```

---

## Estado

| Campo | Valor |
|-------|-------|
| **Documentado** | Sí |
| **Evidencia presentada** | Sí |
| **Pendiente** | Validación Product Owner |

---

*TICKET-V2-GOVERNANCE-AGENT-ONBOARDING-GATE-001 — 2026-07-05*
