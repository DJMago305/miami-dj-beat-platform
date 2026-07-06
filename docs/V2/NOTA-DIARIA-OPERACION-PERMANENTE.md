# MIAMI DJ BEAT

## OPERACIÓN PERMANENTE

### CONSTITUCIÓN DE DESARROLLO

**Versión:** 1.0  
**Ticket:** TICKET-V2-GOVERNANCE-OPERATIONS-MEMORY-001  
**Audiencia:** Product Owner, arquitectos, desarrolladores, agentes IA  
**Lectura obligatoria:** antes de cualquier trabajo en el proyecto

---

## SECCIÓN 1 — OBJETIVO

Este documento es la **Constitución Operativa** de Miami DJ Beat. Su propósito es garantizar:

| Principio | Significado |
|-----------|-------------|
| **Estabilidad** | Producción protegida; cambios controlados |
| **Trazabilidad** | Todo cambio tiene ticket, autor y evidencia |
| **Transparencia** | Alcance, riesgo y validación visibles antes y después |
| **Cero improvisación** | No se actúa sin lectura previa ni autorización |
| **Cero deuda técnica innecesaria** | No se paga velocidad con parches ocultos |
| **Protección de la producción** | V1 y usuarios reales primero |

Ante conflicto entre velocidad y estabilidad, **gana la estabilidad** (ver Sección 14).

---

## SECCIÓN 2 — ESTADO ACTUAL

| Entorno | Rol |
|---------|-----|
| **V1** | **Producción** — opera el negocio hoy |
| **V2** | **Laboratorio** — planificación y construcción aislada |

**Regla absoluta:** ningún desarrollo V2 puede afectar V1.

V2 no reemplaza V1 hasta migración módulo por módulo con aprobación del Product Owner. Coexistencia paralela es normal y esperada.

---

## SECCIÓN 3 — AUTORIDAD

| Nivel | Responsabilidad |
|-------|-----------------|
| **Product Owner** | Aprobación final de alcance, cierre y producción |
| **Arquitecto** | Validación técnica, contratos, límites de arquitectura |
| **Implementación** | Ejecuta solo lo autorizado en el ticket |

**Cierre de ticket:**

- Ningún ticket se considera **terminado** sin **validación visual del Product Owner**.
- Los informes de implementación **nunca sustituyen** la validación funcional en pantalla.
- “Funciona en código” ≠ “aprobado para producción”.

Frases de autorización exactas para acciones sensibles:

- Push remoto: **`APROBADO PUSH`**
- Deploy producción: **`APROBADO DEPLOY PRODUCCIÓN`**

---

## SECCIÓN 4 — MODO DE OPERACIÓN

Antes de escribir **una línea de código**, es obligatorio:

1. **Leer notas** — memoria del proyecto (`docs/V2/MiamiDJBeat-MigracionV2-MEMORIA.md`) y esta constitución
2. **Leer decisiones** — tickets cerrados, ADRs y acuerdos PO/Arquitecto
3. **Leer tickets** — alcance actual, archivos autorizados y bloqueados
4. **Revisar `git status`** — working tree limpio o cambios declarados
5. **Revisar `git diff`** — entender qué ya está modificado
6. **Declarar archivos autorizados** — lista explícita en el ticket
7. **Declarar archivos bloqueados** — locked, header, invoice, etc.
8. **Declarar riesgo** — regresión, auth, permisos, visual
9. **Esperar autorización** — si el ticket no está aprobado para implementar, detenerse

Sin estos pasos, la implementación **no comienza**.

---

## SECCIÓN 5 — REGLAS OBLIGATORIAS

| # | Regla |
|---|-------|
| 1 | **No modificar archivos fuera del ticket** |
| 2 | **No mezclar tickets** — un propósito por cambio |
| 3 | **No ampliar alcance** sin OK escrito del PO |
| 4 | **No refactor no solicitado** — cambio mínimo quirúrgico |
| 5 | **No cambiar arquitectura** sin autorización del Arquitecto y PO |
| 6 | **No modificar producción** sin frase de deploy aprobada |
| 7 | **No inventar soluciones** — usar rutas y funciones existentes o ticket de diseño |
| 8 | **No cambios “preventivos”** — solo lo reportado o pactado |
| 9 | **No corregir problemas no reportados** — describirlos y esperar ticket |
| 10 | **No cerrar tickets sin QA** — las cuatro capas (Sección 8) |

Violación de cualquiera de estas reglas invalida el cierre del ticket.

---

## SECCIÓN 6 — SISTEMA DE CONTROL

Todo ticket **debe** indicar:

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Qué problema resuelve, en una frase |
| **Archivos autorizados** | Rutas exactas que pueden editarse |
| **Archivos bloqueados** | Locked, nav, auth, invoice, etc. |
| **Alcance** | Qué incluye y qué excluye explícitamente |
| **Riesgo** | Auth, permisos, layout shift, regresión cruzada |
| **Plan de validación** | Pasos QA + evidencia esperada |
| **Estado** | Planificado · En curso · QA · PO review · Cerrado |

Ticket incompleto → **no implementar**.

---

## SECCIÓN 7 — CONTROL DE CAMBIOS

Cada modificación debe poder responder **las seis preguntas**:

| Pregunta | Obligatoria |
|----------|-------------|
| ¿**Por qué** se hizo? | Motivo de negocio o bug |
| ¿**Quién** la autorizó? | PO / ticket ID |
| ¿**Qué archivo** cambió? | Lista en diff |
| ¿**Qué problema** resolvió? | Antes / después |
| ¿**Cómo** se validó? | QA ejecutado |
| ¿**Qué evidencia** existe? | Capturas, logs, diff, localhost |

**Si falta alguna respuesta, el cambio no puede aprobarse.**

---

## SECCIÓN 8 — CONTROL DE CALIDAD

Toda implementación debe pasar **cuatro etapas**. Sin ellas **no existe cierre**:

| Etapa | Valida |
|-------|--------|
| **QA Técnico** | Errores, permisos, consola, red, diff acotado |
| **QA Visual** | Desktop + móvil, sin layout shift no autorizado |
| **QA Funcional** | Flujo completo del ticket por rol afectado |
| **QA Product Owner** | Aprobación visual y funcional en pantalla |

Orden recomendado: Técnico → Visual → Funcional → PO.  
PO en rojo bloquea merge, commit de cierre y deploy.

---

## SECCIÓN 9 — PROTECCIÓN DEL WORKING TREE

**Nunca mezclar** en el mismo ticket o rama sin autorización explícita:

| Dominio | Ejemplos |
|---------|----------|
| **Header / Navegación** | `mdj-shared-header.js`, nav strips, `#mainNav` |
| **Invoice** | Facturación, print, bundles staff |
| **Portal** | Client, artist, staff surfaces |
| **Docs** | Memoria, tickets, ADRs |
| **Supabase** | Migraciones, RLS, Edge |

Cada dominio **vive aislado**. Si un fix en header descubre un bug en invoice: **detenerse**, documentar, abrir ticket separado.

---

## SECCIÓN 10 — REGLAS PARA CURSOR (Y AGENTES IA)

Los agentes automatizados **obedecen la misma constitución** que los humanos.

| Obligación | Acción |
|------------|--------|
| Alcance | Trabajar **únicamente** sobre lo autorizado en el ticket |
| Límite | **Detenerse** al encontrar problema fuera del alcance |
| Ampliación | **Solicitar autorización** antes de ampliar el ticket |
| Iniciativa | **No** modificar archivos adicionales por “mejora” o “consistencia” |
| Suposición | **No** asumir que un cambio relacionado autoriza tocar otros componentes |
| Locked files | Respetar `.cursorrules` y archivos LOCKED salvo bloque explícito en ticket |
| Deploy | **Nunca** push ni deploy sin frases exactas del PO |

Reporte de agente ≠ evidencia. Adjuntar diff, capturas o logs.

---

## SECCIÓN 11 — CONTROL DE REGRESIONES

Toda regresión documentada con:

| Campo | Requerido |
|-------|-----------|
| **Fecha** | Cuándo se detectó |
| **Ticket** | ID origen y ID fix |
| **Archivo** | Ruta exacta |
| **Causa demostrada** | Mecanismo probado, no suposición |
| **Evidencia** | Diff, captura, log, repro steps |
| **Solución** | Cambio mínimo aplicado |
| **Validación** | QA repetido + PO si aplica |

**Nunca se aceptan hipótesis como cierre definitivo.**  
“Probablemente fue X” → investigar hasta evidencia objetiva.

---

## SECCIÓN 12 — PRINCIPIO DE EVIDENCIA

Toda afirmación técnica debe estar respaldada por **evidencia objetiva**.

| Evidencia válida | Uso |
|------------------|-----|
| `git diff` | Qué cambió |
| `git status` | Qué está pendiente |
| QA visual | Resultado en pantalla |
| localhost | Comportamiento local reproducible |
| Console | Errores JS |
| Network | Fallos API / Edge |
| Capturas | Antes / después |
| Logs | Servidor, Edge, Supabase |
| Código | Líneas citadas |

**Los reportes sin evidencia no constituyen prueba suficiente** para cerrar tickets, aprobar migraciones ni declarar “resuelto”.

---

## SECCIÓN 13 — LECCIONES APRENDIDAS

Sección **permanente**. Solo entradas **técnicas verificadas** — sin nombres, sin atribuciones personales.

| ID | Lección | Contexto |
|----|---------|----------|
| L-01 | Validación visual PO obligatoria | Informes de implementación no sustituyen QA en pantalla |
| L-02 | Tickets mezclados generan rollbacks | Header + invoice + nav en un solo diff = alto riesgo |
| L-03 | Alcance no declarado corrompe locked files | Editar `index.html` o nav “de paso” rompe regresiones |
| L-04 | Poll vs contrato explícito | Lifecycle inferido (timers) falla cuando auth async retrasa DOM |
| L-05 | Working tree sucio oculta causa | Siempre `git status` + `git diff` antes de implementar |
| L-06 | Hipótesis sin diff no cierran incidentes | Regresiones requieren causa demostrada |
| L-07 | Push sin aprobación desincroniza prod | Local ≠ producción hasta deploy autorizado |
| L-08 | Agentes amplían scope por defecto | Cursor debe detenerse y pedir ticket, no “arreglar relacionado” |

*Ampliar esta tabla con cada incidente verificado. Referencia estratégica: `docs/V2/MiamiDJBeat-MigracionV2-MEMORIA.md` §15.*

---

## SECCIÓN 14 — REGLA DE ORO

> **La estabilidad del producto tiene prioridad sobre la velocidad.**

Es preferible **una solución validada** que **varias implementaciones sin evidencia suficiente**.

| Preferir | Evitar |
|----------|--------|
| Ticket acotado + QA + PO | Parche rápido sin alcance |
| Evidencia en diff y capturas | “Debería funcionar” |
| Detenerse y pedir OK | Ampliar scope en silencio |
| Rollback planificado | Big bang en producción |

---

## REFERENCIAS

| Documento | Propósito |
|-----------|-----------|
| `docs/V2/MiamiDJBeat-MigracionV2-MEMORIA.md` | Memoria ejecutiva migración V2 |
| `docs/V2-LAB/` | Fundación técnica del laboratorio |
| `.cursorrules` | Leyes de estabilidad visual, roles, locked files |

---

**Regla de entrada:** leer este documento y la Memoria V2 **antes** de cualquier trabajo.

*Constitución Operativa v1.0 — 2026-07-05 — TICKET-V2-GOVERNANCE-OPERATIONS-MEMORY-001*

*Esperando aprobación del Product Owner.*
