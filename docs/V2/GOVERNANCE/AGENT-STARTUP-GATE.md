# MIAMI DJ BEAT

# AGENT STARTUP GATE

## Protocolo obligatorio de inicio

**Ticket:** TICKET-V2-GOVERNANCE-AGENT-ONBOARDING-GATE-001  
**Autoridad normativa:** [MIAMIDJBEAT GOVERNANCE BASELINE v3.1](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md)  
**Estado:** DOCUMENTADO — **PENDIENTE VALIDACIÓN PRODUCT OWNER**

> **Filosofía central (Baseline):** Los agentes **presentan evidencia**. Los agentes **NO** aprueban trabajos. Los agentes **NO** amplían alcances. Los agentes **NO** interpretan autorizaciones. **Solo el Product Owner** valida, aprueba y autoriza.

---

## Regla principal

**Antes de cualquier trabajo**, todo agente debe leer y aplicar:

| # | Lectura / acción obligatoria |
|---|------------------------------|
| 1 | **MIAMIDJBEAT GOVERNANCE BASELINE** — `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` |
| 2 | **Constitución del Proyecto** — `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` |
| 3 | **Operation Guide** — `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` |
| 4 | **Ticket autorizado** — alcance explícito del Product Owner |
| 5 | **Archivos permitidos / prohibidos** — declarados en ticket o formulario |
| 6 | **Elementos FROZEN** — Baseline §21–§23 · §67 |
| 7 | **Alcance aprobado por Product Owner** — sin ampliación unilateral |

**Ningún agente puede comenzar trabajo** sin completar [AGENT-READING-CHECKLIST.md](./AGENT-READING-CHECKLIST.md) y [AGENT-WORK-AUTHORIZATION-FORM.md](./AGENT-WORK-AUTHORIZATION-FORM.md) para el ticket actual.

---

## Orden exacto de lectura

Ejecutar **en este orden** al iniciar sesión o ticket nuevo:

| Paso | Documento | Objetivo |
|------|-----------|----------|
| **0** | [README.md](./README.md) | Contexto del Gate y jerarquía |
| **1** | [AGENT-STARTUP-GATE.md](./AGENT-STARTUP-GATE.md) | *(este documento)* — reglas de arranque |
| **2** | [MIAMIDJBEAT GOVERNANCE BASELINE v3.1](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md) | Norma oficial — §1 principio · §30 evidencia · §50–§58 alcance · §70 detención · §72 evidencia visual · §76 PO final |
| **3** | [Constitución](../MIAMIDJBEAT-PROYECTO-CONSTITUCION.md) | Máxima autoridad · V1/V2 · jerarquía |
| **4** | [Operation Guide](../NOTA-DIARIA-OPERACION-PERMANENTE.md) | Operación diaria · trazabilidad · gates |
| **5** | **Ticket vigente** | Alcance · archivos · prohibiciones del Capitán |
| **6** | [AGENT-READING-CHECKLIST.md](./AGENT-READING-CHECKLIST.md) | Marcar cada ítem |
| **7** | [AGENT-WORK-AUTHORIZATION-FORM.md](./AGENT-WORK-AUTHORIZATION-FORM.md) | Declaración escrita de alcance y riesgos |

**Solo después del paso 7** puede iniciarse edición, implementación o auditoría activa.

---

## Declaración de no inicio sin checklist

Queda **prohibido** comenzar trabajo si:

- El checklist no está **completado**.
- El formulario de autorización de trabajo **no está rellenado** para el ticket.
- El ticket **no declara alcance** o archivos permitidos.
- Existe **duda** sobre autorización PO → **detenerse** (Baseline §70 · §76).

**Formulación obligatoria antes de trabajar:**

> «Checklist y formulario de arranque completados para [TICKET-XXX]. Alcance declarado. Pendiente ejecución acotada al ticket — no implica aprobación.»

---

## Prohibiciones antes y durante el arranque

### Prohibición de modificar archivos antes de declarar alcance

| Prohibido | Motivo |
|-----------|--------|
| Editar cualquier archivo antes del paso 7 | Alcance no declarado — Baseline §65 |
| Asumir alcance por conveniencia | Baseline §52 · §58 |
| «Revisar y corregir de paso» | Contaminación de ticket — §50 · §66 |

### Prohibición de tocar componentes protegidos

Todo lo **no nombrado** en el ticket se presume **protegido** (Baseline §52 · §58 · §49).

### Prohibición sin ticket exclusivo

Queda **prohibido** modificar, sin ticket exclusivo autorizado por Product Owner:

| Componente | Referencia Baseline |
|------------|---------------------|
| **Menú / navegación** | §63 · §58 |
| **Header** | §63 · §58 |
| **Layout** | §63 · §74 |
| **Auth** | §63 |
| **Permisos** | §63 |
| **Session** | §63 |
| **Shared files** (Shared CSS · Shared JS · bootstrap · theme · event bus · portal shell · core) | §63 |

→ Lista completa archivos compartidos: Baseline [§63](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#63-regla-oficial-de-archivos-compartidos)

---

## Regla de detención obligatoria

Si el agente detecta que debe tocar un componente **protegido**, **FROZEN** o **fuera de alcance**:

| # | Acción |
|---|--------|
| 1 | **Detener** inmediatamente |
| 2 | **Informar** al Product Owner |
| 3 | **Esperar** autorización explícita o ticket nuevo |
| 4 | **No improvisar** · **no asumir** |

→ Baseline [§53](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#53-regla-de-detención-obligatoria) · [§70](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#70-principio-de-detención-obligatoria) · [§69](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#69-principio-de-transparencia-total)

---

## Regla de evidencia antes / después

Todo entregable debe incluir evidencia **comparativa**:

```
ANTES → DESPUÉS → DIFERENCIA
```

Sin regresiones documentadas no avanza hacia validación PO (Baseline §60 · §61 · §78).

Metadatos obligatorios: entorno · fecha · hora · rama Git · versión · ticket · responsable · evidencia visual cuando aplique.

---

## Regla de no aprobación por agente

El agente **nunca** podrá declarar:

- Aprobado · Completado · Terminado · Cerrado · Listo para producción  
- Listo para commit · push · deploy  
- Proyecto validado · obra terminada

**Formulaciones permitidas:**

- Implementado · Documentado · Evidencia presentada  
- Verificación técnica realizada  
- Pendiente validación del Product Owner

→ Baseline [§35](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#35-lenguaje-prohibido-para-agentes) · [§36](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#36-plantilla-oficial-de-cierre-de-informes) · [§72](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#72-principio-de-evidencia-visual-obligatoria)

---

## Cierre de sesión de arranque

Antes de la primera edición del ticket, el agente debe poder responder **Sí** a:

1. ¿Completé el checklist?  
2. ¿Rellené el formulario de autorización?  
3. ¿Sé qué archivos **no** debo tocar?  
4. ¿Sé que **no** puedo aprobar ni ampliar alcance?

Si alguna respuesta es **No** → **no comenzar**. Escalar al Product Owner.

---

## Estado

| Campo | Valor |
|-------|-------|
| **Documentado** | Sí |
| **Evidencia presentada** | Sí |
| **Pendiente** | Validación Product Owner |

*Este informe refleja únicamente la evidencia observada durante esta revisión. No constituye aprobación del trabajo. La decisión final corresponde exclusivamente al Product Owner.*

---

*TICKET-V2-GOVERNANCE-AGENT-ONBOARDING-GATE-001 — 2026-07-05*
