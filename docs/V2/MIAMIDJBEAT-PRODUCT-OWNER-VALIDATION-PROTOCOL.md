# MIAMI DJ BEAT

# PRODUCT OWNER VALIDATION PROTOCOL

## MIAMIDJBEAT GOVERNANCE BASELINE

**Versión:** 3.1 · **BASELINE**  
**Tickets:** TICKET-V2-GOVERNANCE-VALIDATION-PROTOCOL-001 · 002 · 003 · 004 · 005 · 006 · BASELINE-001 · BASELINE-002 · BASELINE-003 · **BASELINE-004**  
**Estado:** **BASELINE** · **FROZEN** — **NORMA OFICIAL DE GOBERNANZA DEL PROYECTO** · **versión definitiva del cuerpo principal**  
**Audiencia:** Product Owner, arquitectos, desarrolladores, agentes IA  
**Alcance:** V1 · V2 · Shared Core · Portales · Runtime · Backend · Frontend · Documentación · Arquitectura · QA · Infraestructura · DevOps · Migración · Laboratorio · Producción

> **Filosofía central:** Los agentes **presentan evidencia**. Los agentes **NO** aprueban trabajos. Los agentes **NO** amplían alcances. Los agentes **NO** interpretan autorizaciones. **Solo el Product Owner** valida, aprueba y autoriza.

> **Declaración BASELINE:** Este documento es la **MIAMIDJBEAT GOVERNANCE BASELINE** (**v3.1** — cuerpo principal definitivo). Tras ratificación por el Product Owner, **queda prohibida toda modificación directa** del cuerpo principal (§1–§79). Toda evolución futura solo mediante **ADDENDUM-XXX** o **ENMIENDA-XXX** aprobados expresamente por el PO ([§43](#43-política-oficial-de-baseline) · [§79](#79-cláusula-de-integridad-del-baseline) · [§76](#76-cláusula-final-del-product-owner)).

> **Jerarquía:** La Constitución del Proyecto (`MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`) permanece como **máxima autoridad**.  
> Este protocolo **operacionaliza** la validación, trazabilidad, control de estados, gobernanza multiagente y política Freeze/Unfreeze del Product Owner.  
> **Prioridad sobre informes de agentes:** ningún reporte, auditoría, recomendación o verificación técnica de un agente sustituye este flujo ni la aprobación del Product Owner. Los agentes presentan evidencia ([§30](#30-principio-de-evidencia)); la aprobación oficial requiere POAC ([§34](#34-certificado-oficial-de-aprobación)).

**Complementa (no reemplaza):**

- `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`
- `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md`
- `docs/workflow-control.md` · `.cursor/rules/no-auto-deploy.mdc`

**Modificación de este Baseline:** **prohibida** una vez ratificado v3.1. Evolución únicamente vía **ADDENDUM-XXX** o **ENMIENDA-XXX** aprobados expresamente por Product Owner ([§43](#43-política-oficial-de-baseline) · [§79](#79-cláusula-de-integridad-del-baseline) · [§76](#76-cláusula-final-del-product-owner)). La Constitución prevalece ante conflicto ([§46](#46-cláusula-final) · [§76](#76-cláusula-final-del-product-owner)).

---

## ÍNDICE

| § | Sección |
|---|---------|
| 1 | [Principio fundamental](#1-principio-fundamental) |
| 2 | [Definiciones oficiales](#2-definiciones-oficiales) |
| 3 | [Regla de oro](#3-regla-de-oro) |
| 4 | [Flujo de validación obligatorio](#4-flujo-de-validación-obligatorio) |
| 5 | [Máquina oficial de estados](#5-máquina-oficial-de-estados) |
| 6 | [Prohibiciones para agentes](#6-prohibiciones-para-agentes) |
| 7 | [Cambio de alcance y decisiones](#7-cambio-de-alcance-y-decisiones) |
| 8 | [Evidencia obligatoria](#8-evidencia-obligatoria) |
| 9 | [Evidencia en informes del agente](#9-evidencia-en-informes-del-agente) |
| 10 | [Aprobación explícita](#10-aprobación-explícita) |
| 11 | [Suficiencia de evidencia](#11-suficiencia-de-evidencia) |
| 12 | [Cambio de estado](#12-cambio-de-estado) |
| 13 | [Principio de trazabilidad](#13-principio-de-trazabilidad) |
| 14 | [Irreversibilidad de estados del Product Owner](#14-irreversibilidad-de-estados-del-product-owner) |
| 15 | [Historial inmutable](#15-historial-inmutable) |
| 16 | [Glosario oficial de estados](#16-glosario-oficial-de-estados) |
| 17 | [Principio de no interpretación](#17-principio-de-no-interpretación) |
| 18 | [Gobernanza multiagente](#18-gobernanza-multiagente) |
| 19 | [Modificación de trabajos existentes](#19-modificación-de-trabajos-existentes) |
| 20 | [Resolución de conflictos entre agentes](#20-resolución-de-conflictos-entre-agentes) |
| 21 | [Política oficial de Freeze](#21-política-oficial-de-freeze) |
| 22 | [Reglas del estado FROZEN](#22-reglas-del-estado-frozen) |
| 23 | [Procedimiento UNFREEZE](#23-procedimiento-unfreeze) |
| 24 | [Principio de protección del historial](#24-principio-de-protección-del-historial) |
| 25 | [Jerarquía de autoridad](#25-jerarquía-de-autoridad) |
| 26 | [Cierre de un ticket](#26-cierre-de-un-ticket) |
| 27 | [Regla para todas las fases](#27-regla-para-todas-las-fases) |
| 28 | [Relación con commit / push / deploy](#28-relación-con-commit--push--deploy) |
| 29 | [Carácter permanente](#29-carácter-permanente) |
| 30 | [Principio de evidencia](#30-principio-de-evidencia) |
| 31 | [Evidencia no es validación](#31-evidencia-no-es-validación) |
| 32 | [Principio de la duda](#32-principio-de-la-duda) |
| 33 | [Clasificación oficial de la evidencia](#33-clasificación-oficial-de-la-evidencia) |
| 34 | [Certificado oficial de aprobación](#34-certificado-oficial-de-aprobación) |
| 35 | [Lenguaje prohibido para agentes](#35-lenguaje-prohibido-para-agentes) |
| 36 | [Plantilla oficial de cierre de informes](#36-plantilla-oficial-de-cierre-de-informes) |
| 37 | [Detección de violaciones de gobernanza](#37-detección-de-violaciones-de-gobernanza) |
| 38 | [Clasificación oficial de severidad](#38-clasificación-oficial-de-severidad) |
| 39 | [Respuesta oficial del agente](#39-respuesta-oficial-del-agente) |
| 40 | [Autoauditoría obligatoria](#40-autoauditoría-obligatoria) |
| 41 | [Principio de vigilancia de gobernanza](#41-principio-de-vigilancia-de-gobernanza) |
| 42 | [Principio de no autoaprobación](#42-principio-de-no-autoaprobación) |
| 43 | [Política oficial de Baseline](#43-política-oficial-de-baseline) |
| 44 | [Política de preservación de evidencia](#44-política-de-preservación-de-evidencia) |
| 45 | [Matriz oficial de autoridad](#45-matriz-oficial-de-autoridad) |
| 46 | [Cláusula final](#46-cláusula-final) |
| 47 | [Principio de presunción documental](#47-principio-de-presunción-documental) |
| 48 | [Cadena oficial de custodia](#48-cadena-oficial-de-custodia) |
| 49 | [Documentos maestros protegidos](#49-documentos-maestros-protegidos) |
| 50 | [Principio de no contaminación de tickets](#50-principio-de-no-contaminación-de-tickets) |
| 51 | [Principio de responsabilidad sobre cambios](#51-principio-de-responsabilidad-sobre-cambios) |
| 52 | [Principio de alcance inviolable](#52-principio-de-alcance-inviolable) |
| 53 | [Regla de detención obligatoria](#53-regla-de-detención-obligatoria) |
| 54 | [Cláusula de gobernanza multiagente](#54-cláusula-de-gobernanza-multiagente) |
| 55 | [Cláusula de evidencia visual](#55-cláusula-de-evidencia-visual) |
| 56 | [Principio final del Baseline](#56-principio-final-del-baseline) |
| 57 | [Principio de responsabilidad absoluta](#57-principio-de-responsabilidad-absoluta) |
| 58 | [Principio de no contaminación del alcance](#58-principio-de-no-contaminación-del-alcance) |
| 59 | [Principio de preservación del producto](#59-principio-de-preservación-del-producto) |
| 60 | [Principio de regresión cero](#60-principio-de-regresión-cero) |
| 61 | [Principio de evidencia comparativa](#61-principio-de-evidencia-comparativa) |
| 62 | [Cláusula de impacto global](#62-cláusula-de-impacto-global) |
| 63 | [Regla oficial de archivos compartidos](#63-regla-oficial-de-archivos-compartidos) |
| 64 | [Principio de protección de interfaces](#64-principio-de-protección-de-interfaces) |
| 65 | [Declaración obligatoria de dependencias](#65-declaración-obligatoria-de-dependencias) |
| 66 | [Prohibición de expansión autónoma](#66-prohibición-de-expansión-autónoma) |
| 67 | [Principio oficial de congelación](#67-principio-oficial-de-congelación) |
| 68 | [Cláusula oficial de incidente de gobernanza](#68-cláusula-oficial-de-incidente-de-gobernanza) |
| 69 | [Principio de transparencia total](#69-principio-de-transparencia-total) |
| 70 | [Principio de detención obligatoria](#70-principio-de-detención-obligatoria) |
| 71 | [Principio de reversibilidad](#71-principio-de-reversibilidad) |
| 72 | [Principio de evidencia visual obligatoria](#72-principio-de-evidencia-visual-obligatoria) |
| 73 | [Principio de no sustitución](#73-principio-de-no-sustitución) |
| 74 | [Principio de conservación del diseño](#74-principio-de-conservación-del-diseño) |
| 75 | [Principio de confianza cero](#75-principio-de-confianza-cero) |
| 76 | [Cláusula final del Product Owner](#76-cláusula-final-del-product-owner) |
| 77 | [Cláusula de protección de producción](#77-cláusula-de-protección-de-producción) |
| 78 | [Cláusula de paridad de evidencia](#78-cláusula-de-paridad-de-evidencia) |
| 79 | [Cláusula de integridad del Baseline](#79-cláusula-de-integridad-del-baseline) |

---

## 1. PRINCIPIO FUNDAMENTAL

En MiamiDJBeat:

**Ningún trabajo se considera aprobado por el simple hecho de haber sido implementado o documentado.**

Todo entregable debe pasar por un **proceso formal de validación** antes de cualquier declaración de cierre, integración, commit, push, merge o deploy.

→ Estados oficiales: [§5](#5-máquina-oficial-de-estados) · Cadena evidencia: [§31](#31-evidencia-no-es-validación) · Glosario: [§16](#16-glosario-oficial-de-estados) · Multiagente: [§18](#18-gobernanza-multiagente) · [§54](#54-cláusula-de-gobernanza-multiagente) · Freeze: [§21](#21-política-oficial-de-freeze) · [§67](#67-principio-oficial-de-congelación) · Jerarquía: [§25](#25-jerarquía-de-autoridad) · Matriz autoridad: [§45](#45-matriz-oficial-de-autoridad) · Evidencia: [§8](#8-evidencia-obligatoria) · Paridad evidencia: [§78](#78-cláusula-de-paridad-de-evidencia) · Comparativa: [§61](#61-principio-de-evidencia-comparativa) · Regresión cero: [§60](#60-principio-de-regresión-cero) · Evidencia visual: [§55](#55-cláusula-de-evidencia-visual) · [§72](#72-principio-de-evidencia-visual-obligatoria) · Producción protegida: [§77](#77-cláusula-de-protección-de-producción) · Integridad Baseline: [§79](#79-cláusula-de-integridad-del-baseline) · Principio evidencia: [§30](#30-principio-de-evidencia) · Confianza cero: [§75](#75-principio-de-confianza-cero) · Presunción documental: [§47](#47-principio-de-presunción-documental) · Alcance: [§50](#50-principio-de-no-contaminación-de-tickets) · [§52](#52-principio-de-alcance-inviolable) · [§58](#58-principio-de-no-contaminación-del-alcance) · Archivos compartidos: [§63](#63-regla-oficial-de-archivos-compartidos) · Detención: [§53](#53-regla-de-detención-obligatoria) · [§70](#70-principio-de-detención-obligatoria) · Certificado PO: [§34](#34-certificado-oficial-de-aprobación) · Violaciones: [§37](#37-detección-de-violaciones-de-gobernanza) · Incidente: [§68](#68-cláusula-oficial-de-incidente-de-gobernanza) · Baseline: [§43](#43-política-oficial-de-baseline) · [§56](#56-principio-final-del-baseline) · PO final: [§76](#76-cláusula-final-del-product-owner)

---

## 2. DEFINICIONES OFICIALES

### IMPLEMENTADO

Significa **únicamente** que el agente afirma haber realizado el trabajo solicitado.

**No implica:** calidad · exactitud · aceptación · aprobación · cierre del ticket · validación.

| Permitido | Prohibido |
|-----------|-----------|
| **IMPLEMENTADO** · **EN DESARROLLO** (agente) | **APROBADO** · **APROBADO PRODUCT OWNER** |

→ **IMPLEMENTADO ≠ VALIDADO** ([§16](#16-glosario-oficial-de-estados))

---

### DOCUMENTADO

Significa **únicamente** que el agente afirma haber creado la documentación correspondiente.

**No implica:** corrección · consistencia · navegabilidad · completitud · aprobación.

→ Requisitos de evidencia documental: [§8.1](#81-documentación)

---

### VERIFICADO

Significa que existen **evidencias objetivas de revisión**.

La verificación puede incluir:

- Revisión técnica
- Revisión documental
- Revisión arquitectónica
- Revisión funcional
- Revisión visual

**La verificación nunca reemplaza la aprobación.**

Variantes permitidas:

- **VERIFICADO TÉCNICAMENTE** — agente o arquitecto, con evidencia ([§5](#5-máquina-oficial-de-estados))
- **VERIFICADO VISUALMENTE** — Product Owner, con evidencia en pantalla cuando aplique

→ **VERIFICADO ≠ ACEPTADO** ([§16](#16-glosario-oficial-de-estados))

---

### APROBADO

Estado **reservado exclusivamente al Product Owner**.

Ningún agente podrá declarar un ticket como:

`APROBADO` · `APROBADO PRODUCT OWNER` · `CERRADO` · `ACEPTADO` · `FINALIZADO` · `READY` · `DONE` · `COMPLETE`

sin **autorización explícita** del Product Owner.

→ Qué **no** cuenta como aprobación: [§10](#10-aprobación-explícita) · [§17](#17-principio-de-no-interpretación)

---

## 3. REGLA DE ORO

**La única autoridad para aprobar una obra es el Product Owner.**

Los agentes **presentan evidencia** — **no** aprueban trabajos, **no** amplían alcances, **no** interpretan autorizaciones ([§47](#47-principio-de-presunción-documental) · [§50](#50-principio-de-no-contaminación-de-tickets) · [§52](#52-principio-de-alcance-inviolable)).

Los agentes **pueden:**

- Implementar
- Investigar
- Documentar
- Proponer
- Auditar
- Verificar

Los agentes **nunca** podrán sustituir la aprobación del Product Owner.

→ Transiciones permitidas al agente: [§12](#12-cambio-de-estado) · Trazabilidad obligatoria: [§13](#13-principio-de-trazabilidad)

---

## 4. FLUJO DE VALIDACIÓN OBLIGATORIO

Todo ticket debe completar las siguientes etapas. **Saltar una etapa deja el ticket abierto.** Ningún estado de [§5](#5-máquina-oficial-de-estados) puede omitirse sin autorización del Product Owner. Todo cambio de estado debe registrarse ([§13](#13-principio-de-trazabilidad)).

### ETAPA 1 — Trabajo del agente

| Campo | Valor |
|-------|-------|
| **Responsable** | Agente |
| **Estados** | **AUTORIZADO** (PO) → **EN DESARROLLO** → **ENTREGADO** |
| **Salida** | Entregable + evidencia diferenciada ([§9](#9-evidencia-en-informes-del-agente)) |

---

### ETAPA 2 — Revisión técnica

Puede incluir: auditoría · revisión de código · revisión documental · revisión arquitectónica.

| Campo | Valor |
|-------|-------|
| **Responsable** | Agente / Arquitecto |
| **Estado** | **VERIFICADO TÉCNICAMENTE** |
| **Evidencia requerida** | Según tipo de trabajo ([§8](#8-evidencia-obligatoria)) |
| **Nota** | No autoriza commit, push, merge ni deploy |

---

### ETAPA 3 — Validación del Product Owner

El ticket pasa a **EN VALIDACIÓN PRODUCT OWNER** solo cuando existe evidencia suficiente ([§11](#11-suficiencia-de-evidencia)).

Según tipo de trabajo:

- Revisión visual
- Revisión documental
- Navegación completa
- Inspección de arquitectura
- Revisión funcional
- Validación en localhost
- Validación en producción *(solo cuando corresponda)*

| Campo | Valor |
|-------|-------|
| **Responsable** | Product Owner |
| **Estado** | **EN VALIDACIÓN PRODUCT OWNER** |
| **Sin esta etapa** | Permanece **ENTREGADO** o **VERIFICADO TÉCNICAMENTE** — nunca aprobado |

---

### ETAPA 4 — Aprobación formal

| Campo | Valor |
|-------|-------|
| **Responsable** | **Product Owner exclusivamente** |
| **Estado** | **APROBADO PRODUCT OWNER** |
| **Acciones posteriores** | **AUTORIZADO COMMIT** · **AUTORIZADO PUSH** · **AUTORIZADO DEPLOY** ([§28](#28-relación-con-commit--push--deploy)) |
| **Irreversibilidad** | Estados PO no modificables por agentes ([§14](#14-irreversibilidad-de-estados-del-product-owner)) |

**Frases de autorización Git/deploy (literales — alineadas con Constitución):**

| Acción | Orden requerida |
|--------|-----------------|
| Push | **`APROBADO PUSH`** → estado **AUTORIZADO PUSH** |
| Merge / deploy producción | **`APROBADO DEPLOY PRODUCCIÓN`** → estado **AUTORIZADO DEPLOY** |

---

## 5. MÁQUINA OFICIAL DE ESTADOS

Estados oficiales del ciclo de vida de un ticket en MiamiDJBeat. Definiciones completas: [§16](#16-glosario-oficial-de-estados).

| Estado | Responsable |
|--------|-------------|
| **PLANIFICADO** | Product Owner |
| **AUTORIZADO** | Product Owner |
| **EN DESARROLLO** | Agente |
| **ENTREGADO** | Agente |
| **VERIFICADO TÉCNICAMENTE** | Agente |
| **EN VALIDACIÓN PRODUCT OWNER** | Product Owner |
| **APROBADO PRODUCT OWNER** | Product Owner |
| **AUTORIZADO COMMIT** | Product Owner |
| **AUTORIZADO PUSH** | Product Owner |
| **AUTORIZADO DEPLOY** | Product Owner |

**Regla de secuencia:** ningún estado puede **omitirse** ni **saltarse** sin autorización explícita del Product Owner.

**Cadena ampliada evidencia→validación:** [§31](#31-evidencia-no-es-validación). **Validación visual PO** obligatoria en impacto UI: [§55](#55-cláusula-de-evidencia-visual). **Violaciones de promoción:** GV-004 [§37](#37-detección-de-violaciones-de-gobernanza).

**Estados auxiliares del agente** (Etapa 1 — no sustituyen la máquina principal):

| Estado auxiliar | Uso |
|-----------------|-----|
| IMPLEMENTADO · DOCUMENTADO · INVESTIGADO · AUDITADO | Declaraciones de trabajo dentro de **EN DESARROLLO** o **ENTREGADO** |

→ Transiciones: [§12](#12-cambio-de-estado) · Cadena ampliada evidencia→validación: [§31](#31-evidencia-no-es-validación) · Trazabilidad: [§13](#13-principio-de-trazabilidad) · Irreversibilidad PO: [§14](#14-irreversibilidad-de-estados-del-product-owner)

---

## 6. PROHIBICIONES PARA AGENTES

Queda **prohibido** que cualquier agente escriba las siguientes expresiones **como hecho consumado**, sin aprobación explícita del Product Owner:

- Trabajo terminado
- Proyecto terminado
- Ticket cerrado
- Aprobado · Aprobado Product Owner
- Ready · Complete · Done
- Production Ready · Deploy Ready
- Commit Ready · Push Ready
- Finished · Finalizado · Aceptado
- Obra concluida
- Milestone aprobado

**Formulaciones permitidas (con calificador):**

- «**Recomendación técnica:** …»
- «**Entregado — pendiente validación PO**»
- «**Verificado técnicamente** — evidencia: …»
- «**Implementado** — no implica aprobación»

→ Lista ampliada y formulaciones permitidas: [§35](#35-lenguaje-prohibido-para-agentes) · Violaciones: [§37](#37-detección-de-violaciones-de-gobernanza) · Ver [§10](#10-aprobación-explícita) · [§16](#16-glosario-oficial-de-estados) · [§17](#17-principio-de-no-interpretación) · [§32](#32-principio-de-la-duda) · [§42](#42-principio-de-no-autoaprobación)

---

## 7. CAMBIO DE ALCANCE Y DECISIONES

Violación de protocolo: ampliar unilateralmente el alcance con afirmaciones como:

- «El proyecto ya está listo.»
- «Ya podemos pasar a Runtime.»
- «Ya podemos hacer commit.»
- «Está listo para producción.»
- «El trabajo quedó aprobado.»

…cuando **no** provienen del Product Owner.

| Permitido | Prohibido |
|-----------|-----------|
| Recomendaciones técnicas fundamentadas | Presentar recomendaciones como aprobaciones |
| Señalar riesgos y gates pendientes | Declarar fases cerradas sin PO |
| Promover estados dentro de autoridad del agente ([§12](#12-cambio-de-estado)) | Promover estados reservados al PO |
| Registrar trazabilidad de cambios ([§13](#13-principio-de-trazabilidad)) | Reescribir historial aprobado ([§15](#15-historial-inmutable) · [§24](#24-principio-de-protección-del-historial)) |
| Respetar elementos **FROZEN** ([§22](#22-reglas-del-estado-frozen)) | Modificar frozen sin UNFREEZE ([§23](#23-procedimiento-unfreeze)) |
| Respetar alcance cerrado del ticket ([§50](#50-principio-de-no-contaminación-de-tickets)) | Contaminar ticket con cambios ajenos ([§52](#52-principio-de-alcance-inviolable)) |
| Detenerse ante componente protegido ([§53](#53-regla-de-detención-obligatoria)) | Continuar sin autorización PO |

**Las decisiones finales corresponden únicamente al Product Owner.**

---

## 8. EVIDENCIA OBLIGATORIA

Antes de que el Product Owner pueda aprobar un ticket debe existir **evidencia suficiente** ([§11](#11-suficiencia-de-evidencia)).

La evidencia **depende del tipo de trabajo**. Solo aplican las categorías relevantes al ticket; las omitidas se marcan **N/A** en el informe de entrega. Clasificación oficial por responsable: [§33](#33-clasificación-oficial-de-la-evidencia).

### 8.1 Documentación

Debe existir (cuando el ticket es documental o incluye entregables docs):

| Requisito | Descripción |
|-----------|-------------|
| Navegación documental completa | Rutas, índices y enlaces verificables |
| Referencias válidas | Enlaces a fuentes oficiales existentes — no rutas inventadas |
| Consistencia entre documentos | Sin contradicciones P0 entre specs, Handbook, Blueprint, Progress |
| Índices correctos | MODULE-INDEX, CONTRACT-INDEX, etc. alineados con Module Catalog |
| Ausencia de contradicciones | Métricas, estados MOD y boot order reconciliados |
| Revisión documental del Product Owner | Gate **EN VALIDACIÓN PRODUCT OWNER** — no sustituida por auditoría del agente |

---

### 8.2 Frontend

Debe existir (cuando el ticket toca UI, nav, portales o assets visibles):

| Requisito | Descripción |
|-----------|-------------|
| Localhost | Validación en entorno local declarado (puerto, URL, hard refresh) |
| Desktop | Comportamiento verificado en viewport desktop |
| Mobile | Comportamiento verificado en viewport mobile |
| Console limpia | Sin errores no explicados en consola del navegador |
| Network validado | Peticiones críticas con respuesta esperada |
| Evidencia visual | Capturas, grabación o revisión en vivo registrada |
| Revisión del Product Owner | Gate visual PO — informes del agente no sustituyen |

*Alineado con Constitución: validación visual del Product Owner cuando corresponda UI.* Evidencia visual: [§55](#55-cláusula-de-evidencia-visual).

---

### 8.3 Backend

Debe existir (cuando el ticket toca API, Edge, Supabase, jobs o integraciones):

| Requisito | Descripción |
|-----------|-------------|
| Logs | Evidencia de ejecución sin secretos expuestos |
| Respuestas esperadas | Status, payload y errores documentados |
| Integridad | Datos y side-effects acotados al alcance del ticket |
| Validación técnica | Revisión agente/arquitecto — estado **VERIFICADO TÉCNICAMENTE** |
| Rollback identificado | Procedimiento de reversión declarado antes de deploy |
| Revisión del Product Owner | Gate PO para impacto de negocio, permisos o red zone |

---

### 8.4 Arquitectura

Debe existir (cuando el ticket es arquitectónico, Shared Core, contratos o fase V2):

| Requisito | Descripción |
|-----------|-------------|
| Blueprint | Alineación con plano funcional vigente |
| Contratos | Interfaces escritas en CONTRACTS.md o *-CONTRACT.md |
| Diagramas | Boot, dependencias, eventos — fuente oficial referenciada |
| Dependencias | DEPENDENCY-MAP o spec de módulo sin ciclos prohibidos |
| Consistencia documental | Handbook, Event Bus, Module Catalog coherentes |
| Revisión arquitectónica | Agente/arquitecto — **VERIFICADO TÉCNICAMENTE**; aprobación final: PO |

---

## 9. EVIDENCIA EN INFORMES DEL AGENTE

Todo agente debe diferenciar claramente en cada entrega ([§8](#8-evidencia-obligatoria) define *qué* evidencia; esta sección define *cómo* reportarla):

| Categoría | Significado |
|-----------|-------------|
| **Lo implementado** | Qué cambió o se creó (declaración del agente) |
| **Lo verificado** | Qué se comprobó con evidencia objetiva |
| **Lo observado** | Hechos medidos o leídos en repo/archivos |
| **Lo supuesto** | Inferencias no confirmadas — marcar explícitamente |
| **Lo recomendado** | Opinión técnica — no es orden ni aprobación |
| **Lo aprobado** | **Solo si el PO lo declaró por escrito** ([§10](#10-aprobación-explícita)) |

**Nunca** presentar una recomendación como si fuera una aprobación.

### Plantilla mínima de cierre de entrega (agente)

```markdown
## Estado del ticket (máquina oficial §5)
- Estado declarado: ENTREGADO | VERIFICADO TÉCNICAMENTE
- EN VALIDACIÓN PRODUCT OWNER: NO (solo PO promueve)
- APROBADO PRODUCT OWNER: NO

## Evidencia obligatoria (§8)
- Documentación: [N/A | cumplida — enlace/ruta]
- Frontend: [N/A | cumplida — localhost/desktop/mobile]
- Backend: [N/A | cumplida — logs/respuestas]
- Arquitectura: [N/A | cumplida — refs]

## Diferenciación (§9)
- Observado: …
- Supuesto: …
- Recomendado: …

## Acciones NO autorizadas
- Commit: NO
- Push: NO
- Deploy: NO
```

→ Registro de transiciones: usar plantilla oficial [§13.1](#131-plantilla-oficial-de-trazabilidad) · Cierre obligatorio de informes: [§36](#36-plantilla-oficial-de-cierre-de-informes) · Paridad entorno: [§78](#78-cláusula-de-paridad-de-evidencia)

---

## 10. APROBACIÓN EXPLÍCITA

**Regla permanente:** ningún agente podrá interpretar como aprobación:

| No es aprobación | Motivo |
|------------------|--------|
| Ausencia de comentarios | Silencio ≠ consentimiento |
| Silencio | Requiere comunicación explícita del PO |
| Tiempo transcurrido | El tiempo no promueve estados |
| Aceptación implícita | Prohibida |
| Recomendaciones positivas | Opinión del agente |
| Informes favorables | Entrega ≠ aceptación |
| Auditorías exitosas | **VERIFICADO TÉCNICAMENTE** ≠ **APROBADO PRODUCT OWNER** |

**La aprobación solamente existe cuando el Product Owner la comunica de forma explícita** — preferentemente vía POAC [§34](#34-certificado-oficial-de-aprobación). No autoaprobación: [§42](#42-principio-de-no-autoaprobación).

Estados que requieren comunicación explícita del PO: [§5](#5-máquina-oficial-de-estados) — desde **AUTORIZADO** hasta **AUTORIZADO DEPLOY**.

→ Ampliación: [§17 Principio de no interpretación](#17-principio-de-no-interpretación) · Certificado oficial único: [§34](#34-certificado-oficial-de-aprobación) · Evidencia ≠ validación: [§31](#31-evidencia-no-es-validación)

---

## 11. SUFICIENCIA DE EVIDENCIA

Un trabajo solo podrá pasar a **EN VALIDACIÓN PRODUCT OWNER** cuando exista evidencia suficiente según [§8](#8-evidencia-obligatoria).

**La suficiencia de evidencia será determinada únicamente por el Product Owner.**

| Entidad | ¿Determina suficiencia? |
|---------|-------------------------|
| Product Owner | **Sí** — única autoridad |
| Agente | **No** |
| Herramientas automáticas | **No** |
| Auditorías | **No** — preparan **VERIFICADO TÉCNICAMENTE**, no validación PO |
| Reportes | **No** |

El agente puede **proponer** que la evidencia está lista; el PO **decide** si promueve a **EN VALIDACIÓN PRODUCT OWNER**.

→ Clasificación de tipos de evidencia: [§33](#33-clasificación-oficial-de-la-evidencia) · **EVIDENCIA PRESENTADA** no implica validación: [§31](#31-evidencia-no-es-validación)

---

## 12. CAMBIO DE ESTADO

Los agentes **únicamente** podrán cambiar estados dentro de su autoridad. **Todo cambio de estado debe quedar trazado** ([§13](#13-principio-de-trazabilidad)).

**Cadena oficial (ningún eslabón omitible sin PO):**

```
PLANIFICADO                    (Product Owner)
      ↓
AUTORIZADO                     (Product Owner)
      ↓
EN DESARROLLO                  (Agente)
      ↓
ENTREGADO                      (Agente)
      ↓
VERIFICADO TÉCNICAMENTE        (Agente)
      ↓
EN VALIDACIÓN PRODUCT OWNER    (Product Owner)
      ↓
APROBADO PRODUCT OWNER         (Product Owner)
      ↓
AUTORIZADO COMMIT              (Product Owner)
      ↓
AUTORIZADO PUSH                (Product Owner)
      ↓
AUTORIZADO DEPLOY              (Product Owner)
```

| Transición | ¿Puede el agente? |
|------------|-------------------|
| → EN DESARROLLO | Solo si PO declaró **AUTORIZADO** |
| → ENTREGADO | **Sí** — registrar trazabilidad |
| → VERIFICADO TÉCNICAMENTE | **Sí**, con evidencia [§8](#8-evidencia-obligatoria) |
| → EN VALIDACIÓN PRODUCT OWNER | **No** — solo Product Owner |
| → APROBADO PRODUCT OWNER | **No** — solo Product Owner |
| → AUTORIZADO COMMIT / PUSH / DEPLOY | **No** — solo Product Owner |

**Ningún agente podrá promover un ticket a un estado reservado al Product Owner.**

Estados PO alcanzados: **irreversibles por agentes** ([§14](#14-irreversibilidad-de-estados-del-product-owner)).

---

## 13. PRINCIPIO DE TRAZABILIDAD

**Todo cambio oficial de estado debe dejar evidencia documental.**

Ningún cambio de estado podrá quedar **sin trazabilidad**.

Cada transición debe registrar **como mínimo**:

| Campo | Descripción |
|-------|-------------|
| **Estado** | Estado origen → estado destino |
| **Fecha** | Fecha del cambio (ISO 8601 recomendado) |
| **Hora** | Hora del cambio (zona declarada) |
| **Responsable** | Agente · Arquitecto · Product Owner |
| **Ticket relacionado** | ID del ticket que autoriza el cambio |
| **Evidencia utilizada** | Enlaces, rutas, capturas, logs — según [§8](#8-evidencia-obligatoria) |
| **Observaciones** | Contexto, limitaciones, N/A declarados |
| **Nivel de autorización requerido** | Agente · PO · frase literal (push/deploy) |

**Ubicaciones recomendadas:** ticket · nota diaria · session summary · addendum — nunca sustituir historial ([§15](#15-historial-inmutable)).

---

### 13.1 Plantilla oficial de trazabilidad

Formato oficial recomendado para **cualquier transición de estado**:

```markdown
Estado: [ORIGEN] → [DESTINO]
Fecha: YYYY-MM-DD
Hora: HH:MM (timezone)
Responsable: [Agente | Arquitecto | Product Owner — nombre/rol]
Ticket: TICKET-...
Documentos revisados: [rutas o N/A]
Evidencia: [descripción + enlaces]
Observaciones: [texto libre]
Nivel de autorización: [Agente | Product Owner | APROBADO PUSH | APROBADO DEPLOY PRODUCCIÓN]
Resultado: [Transición registrada | Pendiente PO | N/A]
```

Esta plantilla constituye el **formato oficial recomendado** para registrar transiciones. No sustituye la aprobación del Product Owner cuando el estado lo requiera ([§10](#10-aprobación-explícita)).

---

## 14. IRREVERSIBILIDAD DE ESTADOS DEL PRODUCT OWNER

**Regla permanente:** una vez que un ticket alcance alguno de los siguientes estados:

- **APROBADO PRODUCT OWNER**
- **AUTORIZADO COMMIT**
- **AUTORIZADO PUSH**
- **AUTORIZADO DEPLOY**

**ningún agente podrá modificar esos estados** ni declararlos revertidos, anulados o sustituidos.

Si posteriormente aparece un defecto, regresión, incidencia, ampliación de alcance o cambio de arquitectura:

1. Debe abrirse un **nuevo ticket**.
2. El historial del ticket aprobado **no debe reescribirse** ([§15](#15-historial-inmutable)).
3. Las correcciones se documentan como addendum o seguimiento — no como borrado del estado PO original.

Solo el Product Owner puede autorizar excepciones documentadas vía ADR o ticket de gobernanza explícito.

---

## 15. HISTORIAL INMUTABLE

Los **informes históricos** forman parte de la evidencia del proyecto.

**No deben modificarse** para alterar el resultado originalmente validado o registrado.

| Acción permitida | Acción prohibida |
|------------------|------------------|
| **Addendum** al final del documento | Reescribir conclusiones de un informe aprobado |
| **Ticket nuevo** para correcciones | Borrar o sustituir estados PO en bitácoras |
| **Nota de seguimiento** con fecha y autor | Editar session summaries para cambiar métricas ya validadas |

Las correcciones posteriores deben quedar registradas mediante addendum, ticket nuevo o nota de seguimiento — **nunca** sustituyendo el historial existente.

→ Preservación de versiones: [§44](#44-política-de-preservación-de-evidencia) · Alineado con Constitución: trazabilidad y responsabilidad de cada cambio. Multiagente: [§24](#24-principio-de-protección-del-historial)

---

## 16. GLOSARIO OFICIAL DE ESTADOS

Términos oficiales de la máquina de estados ([§5](#5-máquina-oficial-de-estados)).

| Término | Definición |
|---------|------------|
| **PLANIFICADO** | Trabajo aún no autorizado. |
| **AUTORIZADO** | Inicio permitido por el Product Owner. |
| **EN DESARROLLO** | Trabajo en ejecución. |
| **ENTREGADO** | Trabajo finalizado por el agente. |
| **VERIFICADO TÉCNICAMENTE** | Evidencia técnica disponible. |
| **EN VALIDACIÓN PRODUCT OWNER** | Revisión oficial del Product Owner. |
| **APROBADO PRODUCT OWNER** | Validación formal del Product Owner. |
| **AUTORIZADO COMMIT** | Permiso para registrar cambios en Git. |
| **AUTORIZADO PUSH** | Permiso para enviar cambios al repositorio remoto. |
| **AUTORIZADO DEPLOY** | Permiso para desplegar a un entorno autorizado. |
| **IMPLEMENTADO** | Agente declara trabajo realizado — no implica validación ([§2](#2-definiciones-oficiales) · [§31](#31-evidencia-no-es-validación)). |
| **DOCUMENTADO** | Agente declara documentación creada — no implica aprobación ([§2](#2-definiciones-oficiales)). |
| **EVIDENCIA PRESENTADA** | Agente entregó evidencia objetiva — **no** implica **VALIDADO** ni **APROBADO** ([§31](#31-evidencia-no-es-validación)). |
| **VALIDADO PRODUCT OWNER** | Product Owner completó revisión formal — distinto de **APROBADO PRODUCT OWNER** hasta certificado ([§34](#34-certificado-oficial-de-aprobación)). |
| **FROZEN** | Elemento estable declarado por PO — protegido contra cambios ([§21](#21-política-oficial-de-freeze)). |
| **UNFREEZE** | Levantamiento explícito del Freeze — solo PO ([§23](#23-procedimiento-unfreeze)). |
| **BASELINE** | **MIAMIDJBEAT GOVERNANCE BASELINE** v3.1 — cuerpo principal definitivo, congelado tras ratificación PO — no editable directamente ([§43](#43-política-oficial-de-baseline) · [§79](#79-cláusula-de-integridad-del-baseline)). |
| **ADDENDUM** | Documento independiente **ADDENDUM-XXX** que añade reglas sin reescribir el Baseline ratificado — requiere aprobación PO ([§43](#43-política-oficial-de-baseline) · [§79](#79-cláusula-de-integridad-del-baseline)). |
| **ENMIENDA** | Documento independiente **ENMIENDA-XXX** que modifica el efecto de una regla puntual con trazabilidad PO ([§43](#43-política-oficial-de-baseline) · [§79](#79-cláusula-de-integridad-del-baseline)). |
| **PARIDAD DE EVIDENCIA** | Evidencia válida solo en el entorno declarado — metadatos obligatorios [§78](#78-cláusula-de-paridad-de-evidencia). |
| **PRODUCCIÓN PROTEGIDA** | V1 producción, localhost validado, runtime y componentes aprobados/FROZEN — autorización PO previa [§77](#77-cláusula-de-protección-de-producción). |
| **INTEGRIDAD DEL BASELINE** | Prohibición de omitir, reinterpretar, resumir sustitutivamente o modificar el Baseline ratificado ([§79](#79-cláusula-de-integridad-del-baseline)). |
| **GV-xxx** | Código oficial de violación de gobernanza ([§37](#37-detección-de-violaciones-de-gobernanza)). |
| **Documento maestro protegido** | Activo listado en [§49](#49-documentos-maestros-protegidos) — no modificable sin autorización PO explícita. |
| **Alcance inviolable** | Todo lo no nombrado en el ticket se presume protegido ([§52](#52-principio-de-alcance-inviolable)). |
| **PENDIENTE VALIDACIÓN PRODUCT OWNER** | Estado operativo del agente tras entrega — no implica aprobación ([§55](#55-cláusula-de-evidencia-visual) · [§72](#72-principio-de-evidencia-visual-obligatoria)). |
| **INCIDENTE DE GOBERNANZA** | Ticket previo a ticket técnico cuando hay posible violación del Baseline ([§68](#68-cláusula-oficial-de-incidente-de-gobernanza)). |
| **Regresión cero** | Evidencia ANTES → DESPUÉS → SIN REGRESIONES obligatoria ([§60](#60-principio-de-regresión-cero)). |
| **Evidencia comparativa** | Formato ANTES · DESPUÉS · DIFERENCIA ([§61](#61-principio-de-evidencia-comparativa)). |
| **Archivo compartido** | Componente de [§63](#63-regla-oficial-de-archivos-compartidos) — ticket exclusivo PO. |
| **Confianza cero** | Toda afirmación requiere evidencia — nada presunto ([§75](#75-principio-de-confianza-cero)). |

### Severidad oficial ([§38](#38-clasificación-oficial-de-severidad))

| Nivel | Uso |
|-------|-----|
| **CRÍTICA** | Riesgo inmediato a producción, permisos, Git remoto o integridad del Baseline |
| **ALTA** | Promoción ilegal de estados, aprobación implícita o freeze violado sin deploy |
| **MEDIA** | Alcance, evidencia incompleta o lenguaje prohibido sin acción Git |
| **BAJA** | Desviación menor de plantillas o referencias — corregir en informe |

### Equivalencias prohibidas

Los siguientes pares **no** son intercambiables:

| Expresión | No significa |
|-----------|--------------|
| **ENTREGADO** | **APROBADO** |
| **VERIFICADO** (técnico o visual) | **ACEPTADO** |
| **IMPLEMENTADO** | **VALIDADO** |
| **RECOMENDADO** | **AUTORIZADO** |
| **LISTO TÉCNICAMENTE** | **LISTO PARA PRODUCCIÓN** |

→ Cadena ampliada: [§31](#31-evidencia-no-es-validación) · Violaciones GV: [§37](#37-detección-de-violaciones-de-gobernanza) · Presunción documental: [§47](#47-principio-de-presunción-documental) · Ver [§2](#2-definiciones-oficiales) · [§10](#10-aprobación-explícita) · [§17](#17-principio-de-no-interpretación)

---

## 17. PRINCIPIO DE NO INTERPRETACIÓN

Los agentes **no podrán interpretar** lo siguiente como autorización para cambiar estados del proyecto:

- Silencios
- Demoras
- Ausencia de observaciones
- Mensajes ambiguos
- Respuestas parciales

Toda autorización reservada al Product Owner ([§5](#5-máquina-oficial-de-estados)) debe ser **explícita, inequívoca y verificable**.

| Señal | ¿Autoriza cambio de estado? |
|-------|----------------------------|
| PO escribe «APROBADO» / «AUTORIZADO COMMIT» / frase literal push/deploy | **Sí** — registrar [§13](#13-principio-de-trazabilidad) |
| PO no responde | **No** |
| PO responde «ok» sin contexto de ticket/estado | **No** — ambiguo |
| Auditoría favorable del agente | **No** |
| Recomendación «SÍ proceder» del agente | **No** — **RECOMENDADO ≠ AUTORIZADO** |

→ Complementa [§10 Aprobación explícita](#10-aprobación-explícita) · [§30 Principio de evidencia](#30-principio-de-evidencia) · [§32 Principio de la duda](#32-principio-de-la-duda) · Multiagente: [§18](#18-gobernanza-multiagente)

---

## 18. GOBERNANZA MULTIAGENTE

El proyecto MiamiDJBeat podrá ser desarrollado por **múltiples agentes**. Todos están sujetos a la **misma jerarquía de autoridad** ([§25](#25-jerarquía-de-autoridad) · Constitución).

### Reglas permanentes

| # | Regla |
|---|-------|
| M-01 | Ningún agente podrá **modificar un ticket entregado por otro agente** sin autorización explícita del Product Owner. |
| M-02 | Ningún agente podrá **reabrir un ticket aprobado** por iniciativa propia ([§14](#14-irreversibilidad-de-estados-del-product-owner)). |
| M-03 | Ningún agente podrá **invalidar el trabajo de otro agente** únicamente por criterio personal. |
| M-04 | Toda observación deberá estar respaldada por **evidencia objetiva** ([§8](#8-evidencia-obligatoria)). |
| M-05 | Si un agente detecta una posible incidencia, deberá **proponer un nuevo ticket** o una investigación específica — **sin alterar** el estado oficial del ticket existente. |
| M-06 | El **Product Owner** es la única autoridad para decidir si un ticket permanece vigente, se modifica, se reemplaza o se cierra. |

**Las diferencias de criterio entre agentes nunca sustituyen la decisión oficial del Product Owner.**

→ Conflictos: [§20](#20-resolución-de-conflictos-entre-agentes) · Cláusula ampliada: [§54](#54-cláusula-de-gobernanza-multiagente) · Modificar trabajo ajeno: [§19](#19-modificación-de-trabajos-existentes) · Vigilancia: [§41](#41-principio-de-vigilancia-de-gobernanza)

---

## 19. MODIFICACIÓN DE TRABAJOS EXISTENTES

Cuando un agente proponga cambios sobre un trabajo **previamente entregado** (propio o de otro agente), deberá indicar **obligatoriamente**:

| Campo | Descripción |
|-------|-------------|
| **Ticket original** | ID y estado vigente del ticket afectado |
| **Motivo del cambio** | Defecto, regresión, ampliación, reconciliación, etc. |
| **Alcance** | Archivos, módulos o documentos propuestos |
| **Riesgo** | Regresión, auth, visual, documental |
| **Evidencia** | Hechos observados — no opiniones sin respaldo |
| **Impacto esperado** | BEFORE/AFTER conceptual |
| **Autorización requerida** | PO · ticket de unfreeze · ADR según caso |

**Ninguna propuesta implica autorización automática** para modificar el trabajo existente.

Elementos **FROZEN** requieren ticket UNFREEZE ([§23](#23-procedimiento-unfreeze)) además de autorización PO.

---

## 20. RESOLUCIÓN DE CONFLICTOS ENTRE AGENTES

Cuando existan **conclusiones distintas** entre agentes:

| Paso | Acción |
|------|--------|
| 1 | **Conservar** el estado oficial vigente del ticket o elemento |
| 2 | **Documentar** las diferencias (agente A vs agente B — evidencia, no opinión) |
| 3 | **Recopilar** evidencia objetiva ([§8](#8-evidencia-obligatoria)) |
| 4 | El **Product Owner** emite la **decisión final** |

**Hasta esa decisión**, ningún agente podrá modificar unilateralmente el estado del proyecto, un ticket aprobado o un elemento **FROZEN**.

→ Cláusula ampliada multiagente: [§54](#54-cláusula-de-gobernanza-multiagente) · Registrar diferencias con [§13.1](#131-plantilla-oficial-de-trazabilidad) · Historial: [§24](#24-principio-de-protección-del-historial)

---

## 21. POLÍTICA OFICIAL DE FREEZE

### Estado FROZEN

**FROZEN** — un elemento declarado **congelado** por decisión exclusiva del **Product Owner**.

Representa un componente considerado **estable** y **protegido** frente a modificaciones accidentales o drive-by edits.

### Ámbito de aplicación

El estado **FROZEN** puede aplicarse a (lista no exhaustiva):

| Categoría | Ejemplos |
|-----------|----------|
| Módulos | MOD-xxx documentado o implementado |
| Componentes | UI, nav strips, portal shell blocks |
| Documentos | Constitución, Handbook, specs cerradas PO |
| Arquitectura | Blueprint secciones, boot order oficial |
| Navegación | `#mainNav`, artist strips pactados |
| Interfaces | Contratos, APIs documentadas |
| Contratos | `CONTRACTS.md`, *-CONTRACT.md |
| Especificaciones | *-SPEC.md aprobados PO |
| Procesos | Protocolos de gobernanza ratificados |
| **Governance Baseline** | **Este protocolo v3.1 BASELINE FROZEN** ([§43](#43-política-oficial-de-baseline) · [§56](#56-principio-final-del-baseline) · [§76](#76-cláusula-final-del-product-owner)) |
| **Documentos maestros** | Listados en [§49](#49-documentos-maestros-protegidos) |
| Otros | Cualquier activo que el PO declare FROZEN |

→ Reglas mientras FROZEN: [§22](#22-reglas-del-estado-frozen) · Levantamiento: [§23](#23-procedimiento-unfreeze)

---

## 22. REGLAS DEL ESTADO FROZEN

Mientras un elemento permanezca **FROZEN**:

| # | Regla |
|---|-------|
| F-01 | **Ningún agente** podrá modificarlo |
| F-02 | **Ningún ticket** podrá alterarlo indirectamente (drive-by, “consistencia”, refactors colaterales) |
| F-03 | **Ningún cambio** por conveniencia técnica del agente |
| F-04 | Las **recomendaciones** se registran (ticket, nota, informe) **sin** modificar el elemento congelado |

Todo cambio sobre un elemento FROZEN debe esperar **autorización expresa del Product Owner** vía procedimiento [§23](#23-procedimiento-unfreeze).

*Referencia operativa V1:* zonas LOCKED en `.cursorrules` — alineadas conceptualmente con FROZEN; el PO es autoridad final.

---

## 23. PROCEDIMIENTO UNFREEZE

Si fuera necesario modificar un elemento **FROZEN**, deberá abrirse un **nuevo ticket específico** de UNFREEZE (o ticket hijo explícito).

### Contenido mínimo del ticket UNFREEZE

| Campo | Requerido |
|-------|-----------|
| **Elemento afectado** | Ruta, MOD, selector, documento |
| **Motivo** | Por qué el Freeze debe levantarse |
| **Alcance** | Cambio mínimo autorizado |
| **Riesgos** | Regresión, permisos, visual |
| **Impacto esperado** | Qué mejora o corrige |
| **Evidencia** | Defecto, auditoría, requisito PO |
| **Justificación técnica** | Por qué no basta ticket separado sin tocar frozen |
| **Autorización requerida** | Product Owner — explícita |

El estado **FROZEN permanece vigente** hasta que el Product Owner autorice **expresamente** su levantamiento.

Tras UNFREEZE autorizado: registrar transición [§13.1](#131-plantilla-oficial-de-trazabilidad) · al cerrar el cambio, el PO puede **re-declarar FROZEN**.

---

## 24. PRINCIPIO DE PROTECCIÓN DEL HISTORIAL

Complementa [§15 Historial inmutable](#15-historial-inmutable) en contexto **multiagente**:

| Regla | Descripción |
|-------|-------------|
| P-01 | La existencia de un **ticket nuevo no modifica automáticamente** un ticket anterior |
| P-02 | Cada ticket **conserva su contexto histórico** |
| P-03 | Los cambios posteriores deben quedar **relacionados mediante referencias cruzadas** (ticket padre, UNFREEZE, addendum) |
| P-04 | **Nunca** sustituir la evidencia previamente validada por el PO |

Un agente posterior **no reescribe** la conclusión de un agente anterior — documenta addendum o abre ticket nuevo ([§19](#19-modificación-de-trabajos-existentes)).

---

## 25. JERARQUÍA DE AUTORIDAD

Autoridad oficial por acción. **Ninguna autoridad podrá asumirse por inferencia** ([§17](#17-principio-de-no-interpretación)).

| Acción | Autoridad |
|--------|-----------|
| Planificar | **Product Owner** |
| Autorizar inicio | **Product Owner** |
| Desarrollar | **Agente** |
| Documentar | **Agente** |
| Verificar técnicamente | **Agente** |
| Validar funcionalmente | **Product Owner** |
| Aprobar | **Product Owner** |
| Declarar **FROZEN** | **Product Owner** |
| Autorizar **UNFREEZE** | **Product Owner** |
| Autorizar **COMMIT** | **Product Owner** |
| Autorizar **PUSH** | **Product Owner** |
| Autorizar **DEPLOY** | **Product Owner** |

→ Matriz ampliada oficial: [§45](#45-matriz-oficial-de-autoridad) · Máquina de estados: [§5](#5-máquina-oficial-de-estados) · Multiagente: [§18](#18-gobernanza-multiagente)

---

## 26. CIERRE DE UN TICKET

Un ticket **únicamente** alcanza cierre formal en **APROBADO PRODUCT OWNER** cuando el Product Owner indique **de forma explícita** ([§10](#10-aprobación-explícita) · [§17](#17-principio-de-no-interpretación)) que el entregable fue revisado y aceptado.

| Hasta aprobación PO | Tras aprobación PO |
|---------------------|-------------------|
| **ENTREGADO** · **VERIFICADO TÉCNICAMENTE** · **EN VALIDACIÓN PRODUCT OWNER** | **APROBADO PRODUCT OWNER** |
| **PENDIENTE DE VALIDACIÓN DEL PRODUCT OWNER** *(alias operativo)* | **AUTORIZADO COMMIT** / **PUSH** / **DEPLOY** según ticket ([§28](#28-relación-con-commit--push--deploy)) |

**Nunca** usar **APROBADO** o **APROBADO PRODUCT OWNER** antes de la Etapa 4 ([§4](#4-flujo-de-validación-obligatorio)).

Tras cierre PO, el ticket queda **inmutable** para agentes ([§14](#14-irreversibilidad-de-estados-del-product-owner) · [§18 M-02](#18-gobernanza-multiagente)).

---

## 27. REGLA PARA TODAS LAS FASES

Esta política aplica **sin excepción** a:

V1 · V2 · Shared Core · Portales · Runtime · Backend · Supabase · Frontend · Documentación · Arquitectura · QA · Infraestructura · DevOps · Migración · Laboratorio · Producción

Incluye trabajo **solo documental** (specs, Handbook, reconciliación, planes Git): documentar ≠ aprobar ([§8.1](#81-documentación)).

**Compatibilidad V1 y V2:** un mismo protocolo; el tipo de evidencia [§8](#8-evidencia-obligatoria) se selecciona por ticket, no por entorno. **Multiagente** aplica a V1 y V2 ([§18](#18-gobernanza-multiagente)).

**Sin modificación de arquitectura:** este Baseline gobierna **proceso, estados, evidencia, certificación PO, violaciones, freeze y preservación documental** — no altera Blueprint, Shared Core specs, Module Catalog ni Architecture Handbook. Contenido baseline v2.0: §1–§46 · evolución futura: [§43](#43-política-oficial-de-baseline).

**Compatibilidad confirmada:** Constitución (máxima autoridad · [§76](#76-cláusula-final-del-product-owner)) · Operation Guide · Blueprint · Architecture Handbook · Shared Core · Module Catalog · gobernanza v1.0–v2.1 integrada · ampliaciones v3.1 §57–§79 ([§46](#46-cláusula-final)).

---

## 28. RELACIÓN CON COMMIT / PUSH / DEPLOY

| Acción | Estado requerido | Gate adicional |
|--------|------------------|----------------|
| Primer commit V2 documental | **AUTORIZADO COMMIT** | Plan seguro + checklist PO |
| `git commit` | **AUTORIZADO COMMIT** | Orden explícita en ticket |
| `git push` | **AUTORIZADO PUSH** | Frase literal **`APROBADO PUSH`** |
| Deploy producción | **AUTORIZADO DEPLOY** | Frase literal **`APROBADO DEPLOY PRODUCCIÓN`** |

Un plan de commit seguro, una auditoría pre-commit o una recomendación **SÍ** para proceder **no** equivalen a **AUTORIZADO COMMIT** ([§10](#10-aprobación-explícita) · [§11](#11-suficiencia-de-evidencia) · [§17](#17-principio-de-no-interpretación)).

Todo commit/push/deploy autorizado debe registrarse con [§13.1](#131-plantilla-oficial-de-trazabilidad).

Modificar archivos **FROZEN** en commit requiere **UNFREEZE** previo ([§23](#23-procedimiento-unfreeze)). Violaciones Git: [§37 GV-005–GV-007](#37-detección-de-violaciones-de-gobernanza). Producción protegida: [§77](#77-cláusula-de-protección-de-producción).

---

## 29. CARÁCTER PERMANENTE

Este protocolo — **MIAMIDJBEAT GOVERNANCE BASELINE v2.0** — forma parte de la **gobernanza oficial de MiamiDJBeat** y es la **norma operativa oficial** para:

- Validación del Product Owner
- Trazabilidad de estados
- Control de aprobaciones e historial
- **Principio de evidencia y certificado PO (POAC)**
- **Lenguaje obligatorio y plantilla de cierre para agentes**
- **Detección y respuesta a violaciones de gobernanza**
- **Autoauditoría y vigilancia entre agentes**
- **Preservación documental del Baseline**
- **Gobernanza multiagente**
- **Política Freeze / Unfreeze**

Su propósito es garantizar que **ninguna** implementación, documentación, auditoría o recomendación — **de ningún agente** — pueda sustituir la validación formal del Product Owner ni alterar elementos **FROZEN** sin autorización explícita.

Toda interacción futura entre agentes, desarrolladores y colaboradores **debe respetar** este Baseline.

**Detenerse siempre** tras entregar trabajo. Esperar validación y aprobación explícita del Product Owner antes de considerar cualquier fase, ticket, módulo o proyecto como oficialmente aprobado.

→ Principio de evidencia: [§30](#30-principio-de-evidencia) · Certificado PO: [§34](#34-certificado-oficial-de-aprobación) · Plantilla cierre: [§36](#36-plantilla-oficial-de-cierre-de-informes) · Baseline frozen: [§43](#43-política-oficial-de-baseline) · [§56](#56-principio-final-del-baseline) · Cláusula final: [§46](#46-cláusula-final) · Documentos maestros: [§49](#49-documentos-maestros-protegidos)

---

## 30. PRINCIPIO DE EVIDENCIA

Principio permanente derivado de la experiencia documental del laboratorio V2. **Amplía** [§8](#8-evidencia-obligatoria) y [§17](#17-principio-de-no-interpretación) — no los sustituye.

| Regla | Significado |
|-------|-------------|
| **E-01** | Un agente **únicamente** puede **presentar** evidencia. |
| **E-02** | Un agente **nunca** puede **interpretar** la evidencia (no convertir observaciones en juicio de mérito, aprobación o cierre). |
| **E-03** | Un agente **nunca** puede convertir evidencia en aprobación — ni explícita ni implícita. |
| **E-04** | La evidencia **pertenece al Product Owner** para evaluar suficiencia, validación y aprobación ([§11](#11-suficiencia-de-evidencia)). |

**Formulación obligatoria cuando el agente entrega evidencia:**

> «Evidencia presentada — pendiente revisión del Product Owner.»

El agente describe **hechos observables** ([§9](#9-evidencia-en-informes-del-agente)). El Product Owner **asigna significado** (suficiente / insuficiente / validado / aprobado).

→ Clasificación por tipo: [§33](#33-clasificación-oficial-de-la-evidencia) · Cadena de estados: [§31](#31-evidencia-no-es-validación)

---

## 31. EVIDENCIA NO ES VALIDACIÓN

Esta sección define la **máquina ampliada de evidencia y validación**. **Amplía** [§5](#5-máquina-oficial-de-estados) y [§12](#12-cambio-de-estado) — no elimina estados previos (**AUTORIZADO**, **EN DESARROLLO**, **ENTREGADO** permanecen vigentes cuando el ticket los requiera).

### Cadena oficial ampliada

```
PLANIFICADO
      ↓
IMPLEMENTADO                    (Agente — trabajo realizado)
      ↓
DOCUMENTADO                     (Agente — documentación entregada, si aplica)
      ↓
VERIFICADO TÉCNICAMENTE         (Agente — evidencia técnica objetiva)
      ↓
EVIDENCIA PRESENTADA            (Agente — informe + evidencia §8 / §33)
      ↓
EN VALIDACIÓN PRODUCT OWNER     (Product Owner — revisión en curso)
      ↓
VALIDADO PRODUCT OWNER          (Product Owner — revisión formal completada)
      ↓
APROBADO PRODUCT OWNER          (Product Owner — aprobación explícita)
      ↓
AUTORIZADO COMMIT               (Product Owner)
      ↓
AUTORIZADO PUSH                 (Product Owner — frase literal §28)
      ↓
AUTORIZADO DEPLOY               (Product Owner — frase literal §28)
```

### Regla permanente

| Estado | ¿Implica validación o aprobación? |
|--------|-----------------------------------|
| **EVIDENCIA PRESENTADA** | **NO** — solo indica que el agente depositó evidencia |
| **VERIFICADO TÉCNICAMENTE** | **NO** — solo indica revisión técnica con evidencia |
| **VALIDADO PRODUCT OWNER** | **NO** implica **APROBADO PRODUCT OWNER** hasta certificado y comunicación explícita ([§34](#34-certificado-oficial-de-aprobación)) |

**Equivalencias prohibidas:**

| Expresión del agente | Prohibido interpretar como |
|----------------------|----------------------------|
| **EVIDENCIA PRESENTADA** | **VALIDADO** |
| **EVIDENCIA PRESENTADA** | **APROBADO** |
| **VERIFICADO TÉCNICAMENTE** | **APROBADO PRODUCT OWNER** |
| Informe favorable | Decisión del Product Owner |

→ Suficiencia: [§11](#11-suficiencia-de-evidencia) · Aprobación explícita: [§10](#10-aprobación-explícita)

---

## 32. PRINCIPIO DE LA DUDA

Todo agente **debe asumir** que puede estar equivocado — incluso cuando:

- Toda la documentación parezca correcta
- Todo compile
- Toda la arquitectura parezca consistente
- Toda la evidencia sea favorable

### Prohibiciones de conclusión (agente)

Queda **prohibido** concluir como hecho:

- «El proyecto está correcto»
- «Todo está aprobado»
- «La obra terminó»
- «No quedan problemas»
- «El proyecto quedó validado»
- Cualquier variante de cierre, aprobación o certeza absoluta ([§35](#35-lenguaje-prohibido-para-agentes))

### Formulación obligatoria de cierre de auditoría (agente)

> «La presente revisión refleja exclusivamente la evidencia observada durante esta auditoría.»

Esta formulación **no sustituye** la plantilla de cierre [§36](#36-plantilla-oficial-de-cierre-de-informes) — la **complementa** en informes de auditoría y validación visual/documental.

→ Complementa [§17](#17-principio-de-no-interpretación) · [§30](#30-principio-de-evidencia)

---

## 33. CLASIFICACIÓN OFICIAL DE LA EVIDENCIA

Tipos oficiales de evidencia en MiamiDJBeat. **Amplía** [§8](#8-evidencia-obligatoria) — cada ticket declara qué tipos aplican (N/A cuando no corresponda).

| Tipo | Responsable | Descripción |
|------|-------------|-------------|
| **Documental** | Agente | Evidencia obtenida de documentos (lectura, grep, rutas, índices, consistencia entre archivos). |
| **Técnica** | Agente | Evidencia obtenida de auditorías (build, lint, revisión de código, logs, respuestas API). |
| **Visual** | Product Owner | Evidencia obtenida mediante inspección visual (UI, navegación, responsive, legibilidad documental en pantalla). |
| **Operacional** | Producción | Evidencia obtenida durante operación real (usuarios, entorno live, incidentes, métricas de negocio). |

### Regla de suficiencia

**Solo la combinación de la evidencia que el Product Owner considere suficiente** permite aprobar una obra.

| Entidad | ¿Puede declarar evidencia suficiente? |
|---------|--------------------------------------|
| Agente | **No** — solo presenta evidencia documental/técnica |
| Product Owner | **Sí** — única autoridad ([§11](#11-suficiencia-de-evidencia)) |
| Auditoría automática | **No** |
| Informe favorable | **No** |

La evidencia **visual** y **operacional** requieren participación del Product Owner o del entorno de producción según la tabla — un agente **no** sustituye la inspección visual PO ni la operación en producción.

→ Presentación de evidencia: [§30](#30-principio-de-evidencia) · Tipos en informes: [§9](#9-evidencia-en-informes-del-agente)

---

## 34. CERTIFICADO OFICIAL DE APROBACIÓN

Concepto oficial: **PRODUCT OWNER APPROVAL CERTIFICATE** (POAC).

**Amplía** [§10](#10-aprobación-explícita) — define el **único** instrumento que constituye aprobación oficial formal.

### Qué NO constituye aprobación oficial

Ninguno de los siguientes elementos, por sí solo o combinados, constituye aprobación oficial:

- Conversación
- Chat
- Comentario
- Informe
- Auditoría
- Revisión
- Agente (cualquier agente)

### Qué SÍ constituye aprobación oficial

**Únicamente** el **PRODUCT OWNER APPROVAL CERTIFICATE** emitido por el Product Owner, con los campos mínimos completados y comunicación explícita verificable.

### Campos mínimos del certificado

| Campo | Descripción |
|-------|-------------|
| **Proyecto** | Miami DJ Beat · V1 / V2 / ticket scope |
| **Versión** | Versión del entregable o documento aprobado |
| **Ticket** | ID del ticket autorizado |
| **Fecha** | Fecha de emisión (ISO 8601 recomendado) |
| **Product Owner** | Identidad del PO emisor |
| **Alcance aprobado** | Qué queda explícitamente incluido |
| **Alcance excluido** | Qué queda fuera de la aprobación |
| **Observaciones** | Condiciones, limitaciones, follow-ups |
| **Autorización Commit** | SÍ / NO · estado **AUTORIZADO COMMIT** si SÍ |
| **Autorización Push** | SÍ / NO · requiere **`APROBADO PUSH`** si SÍ ([§28](#28-relación-con-commit--push--deploy)) |
| **Autorización Deploy** | SÍ / NO · requiere **`APROBADO DEPLOY PRODUCCIÓN`** si SÍ |
| **Estado Final** | p. ej. **APROBADO PRODUCT OWNER** |

### Plantilla recomendada (POAC)

```markdown
# PRODUCT OWNER APPROVAL CERTIFICATE

Proyecto:
Versión:
Ticket:
Fecha:
Product Owner:

Alcance aprobado:
Alcance excluido:
Observaciones:

Autorización Commit: [SÍ | NO]
Autorización Push: [SÍ | NO]
Autorización Deploy: [SÍ | NO]

Estado Final: APROBADO PRODUCT OWNER

Emitido por: Product Owner — única autoridad
```

Registrar emisión del certificado con [§13.1](#131-plantilla-oficial-de-trazabilidad).

→ Irreversibilidad post-aprobación: [§14](#14-irreversibilidad-de-estados-del-product-owner)

---

## 35. LENGUAJE PROHIBIDO PARA AGENTES

Lista explícita. **Amplía** [§6](#6-prohibiciones-para-agentes) y [§32](#32-principio-de-la-duda).

### Afirmaciones prohibidas como hechos

Los agentes **NO** podrán afirmar como hechos consumados:

| # | Expresión prohibida |
|---|---------------------|
| P-01 | Proyecto aprobado |
| P-02 | Trabajo aprobado |
| P-03 | Documentación aprobada |
| P-04 | Shared Core aprobado |
| P-05 | Listo para commit |
| P-06 | Listo para push |
| P-07 | Listo para deploy |
| P-08 | Puede cerrarse |
| P-09 | Obra terminada |
| P-10 | Proyecto finalizado |
| P-11 | No quedan problemas |
| P-12 | Todo está correcto |
| P-13 | El proyecto quedó validado |

*(Incluye variantes en español e inglés: Approved, Ready, Done, Complete, Production Ready, Deploy Ready, Commit Ready, Push Ready, Finished, Finalizado, Aceptado — ver también [§6](#6-prohibiciones-para-agentes) · impacto visual: [§55](#55-cláusula-de-evidencia-visual).)*

### Formulaciones permitidas (agente)

| Situación | Expresión permitida |
|-----------|---------------------|
| Código o cambio aplicado | **Implementación finalizada** |
| Docs creadas o actualizadas | **Documentación entregada** |
| Informe con hechos y rutas | **Evidencia presentada** |
| Auditoría completada | **Verificación técnica realizada** |
| Tras entrega | **Pendiente revisión del Product Owner** |
| Tras entrega | **Pendiente decisión del Product Owner** |
| UI o docs en pantalla | **Esperando validación visual** |
| Tras entrega | **Esperando certificado de aprobación** ([§34](#34-certificado-oficial-de-aprobación)) |

---

## 36. PLANTILLA OFICIAL DE CIERRE DE INFORMES

Plantilla **obligatoria** para todos los agentes al cerrar un informe, auditoría o entrega. **Amplía** la plantilla mínima de [§9](#9-evidencia-en-informes-del-agente).

Todo informe de agente **debe terminar** con el siguiente bloque (marcar solo lo que aplique al ticket):

```markdown
Estado del trabajo:

IMPLEMENTADO: [SÍ | NO | N/A]
DOCUMENTADO: [SÍ | NO | N/A]
VERIFICADO: [SÍ | NO | N/A]
EVIDENCIA PRESENTADA: [SÍ | NO]

Pendiente:

VALIDACIÓN DEL PRODUCT OWNER

Observación obligatoria:

"Este informe refleja únicamente la evidencia observada durante esta revisión.
No constituye aprobación del trabajo.
La decisión final corresponde exclusivamente al Product Owner."
```

### Reglas de uso

| Regla | Descripción |
|-------|-------------|
| C-01 | **EVIDENCIA PRESENTADA: SÍ** no autoriza commit, push ni deploy |
| C-02 | El bloque **Observación obligatoria** debe aparecer **literalmente** (comillas incluidas en el texto del informe) |
| C-03 | Combinar con [§32](#32-principio-de-la-duda) en auditorías: añadir «La presente revisión refleja exclusivamente la evidencia observada durante esta auditoría.» |
| C-04 | Estados PO (**APROBADO PRODUCT OWNER**, etc.) solo si el PO los comunicó — registrar POAC [§34](#34-certificado-oficial-de-aprobación) |
| C-05 | Completar autoauditoría [§40](#40-autoauditoría-obligatoria) antes del cierre |

→ Trazabilidad de transiciones: [§13.1](#131-plantilla-oficial-de-trazabilidad) · Autoauditoría: [§40](#40-autoauditoría-obligatoria)

---

## 37. DETECCIÓN DE VIOLACIONES DE GOBERNANZA

Catálogo oficial de violaciones (**GV**). Todo agente que detecte una violación debe reportarla con [§39](#39-respuesta-oficial-del-agente) — sin atribuir intenciones ([§41](#41-principio-de-vigilancia-de-gobernanza)).

| Código | Descripción | Severidad | Consecuencia | Acción requerida |
|--------|-------------|-----------|--------------|------------------|
| **GV-001** | **Aprobación sin Product Owner** — declarar APROBADO, cerrado o validado sin POAC ni comunicación explícita PO | **CRÍTICA** | Estado oficial inválido; riesgo de acciones no autorizadas | Detener lenguaje de aprobación; revertir declaración; escalar al PO; registrar [§39](#39-respuesta-oficial-del-agente) |
| **GV-002** | **Interpretación de evidencia** — convertir observaciones en juicio de mérito, suficiencia o aprobación ([§30](#30-principio-de-evidencia)) | **ALTA** | Decisión PO usurpada | Reformular como hechos observados; marcar **Pendiente revisión PO** |
| **GV-003** | **Cambio ilegal de alcance** — ampliar ticket, fase o dominio sin autorización PO ([§7](#7-cambio-de-alcance-y-decisiones)) | **ALTA** | Deuda de gobernanza; regresiones cruzadas | Detener trabajo fuera de alcance; solicitar ticket o ampliación PO |
| **GV-004** | **Promoción ilegal de estados** — agente promueve EN VALIDACIÓN PO, APROBADO, AUTORIZADO COMMIT/PUSH/DEPLOY ([§12](#12-cambio-de-estado)) | **CRÍTICA** | Cadena de estados corrupta | Restaurar último estado válido del agente; registrar trazabilidad [§13](#13-principio-de-trazabilidad) |
| **GV-005** | **Commit sin autorización** — `git commit` sin **AUTORIZADO COMMIT** ([§28](#28-relación-con-commit--push--deploy)) | **CRÍTICA** | Historial Git no autorizado | No commit; esperar PO; documentar intento |
| **GV-006** | **Push sin autorización** — `git push` sin **AUTORIZADO PUSH** / frase **`APROBADO PUSH`** | **CRÍTICA** | Remoto alterado sin PO | No push; revertir plan; escalar PO |
| **GV-007** | **Deploy sin autorización** — deploy a producción sin **AUTORIZADO DEPLOY** / **`APROBADO DEPLOY PRODUCCIÓN`** | **CRÍTICA** | Producción expuesta | Detener deploy; rollback plan; escalar PO inmediato |
| **GV-008** | **Ausencia de validación visual** — UI/docs visibles declarados listos sin gate visual PO cuando aplica ([§8.2](#82-frontend) · [§33](#33-clasificación-oficial-de-la-evidencia)) | **ALTA** | Regresión visual no detectada por PO | Marcar **Esperando validación visual**; no lenguaje de cierre |
| **GV-009** | **Modificar elemento FROZEN** — editar activo FROZEN sin UNFREEZE PO ([§22](#22-reglas-del-estado-frozen)) | **CRÍTICA** | Integridad de baseline/freeze comprometida | Revertir cambio si posible; abrir ticket UNFREEZE [§23](#23-procedimiento-unfreeze) |
| **GV-010** | **Cerrar ticket sin Product Owner** — declarar ticket cerrado, DONE o COMPLETE sin **APROBADO PRODUCT OWNER** ([§26](#26-cierre-de-un-ticket)) | **ALTA** | Cierre ficticio | Mantener ticket abierto; estado **ENTREGADO** o **EVIDENCIA PRESENTADA** |

→ Severidad: [§38](#38-clasificación-oficial-de-severidad) · Respuesta agente: [§39](#39-respuesta-oficial-del-agente) · Incidente gobernanza: [§68](#68-cláusula-oficial-de-incidente-de-gobernanza)

---

## 38. CLASIFICACIÓN OFICIAL DE SEVERIDAD

Criterios **objetivos** para clasificar violaciones GV y desviaciones de informe.

### CRÍTICA

| Criterio | Ejemplo |
|----------|---------|
| Acción irreversible o de alto impacto en producción/remoto | Push, deploy, commit no autorizado |
| Usurpación de autoridad PO en estados finales | GV-001, GV-004 |
| Violación de FROZEN en Baseline, Constitución o nav LOCKED | GV-009 sobre Baseline v2.0 |
| Riesgo inmediato a usuarios reales V1 | Deploy sin gate |

**Acción:** detener de inmediato la acción propuesta; escalar al Product Owner; no continuar hasta instrucción explícita.

### ALTA

| Criterio | Ejemplo |
|----------|---------|
| Decisión PO sustituida sin Git/deploy | Interpretación de evidencia, cierre de ticket |
| Gate visual o funcional omitido cuando el ticket lo exige | GV-008 |
| Alcance expandido sin ticket | GV-003 |

**Acción:** corregir informe y estado declarado; abrir o ampliar ticket con PO.

### MEDIA

| Criterio | Ejemplo |
|----------|---------|
| Plantilla de cierre incompleta ([§36](#36-plantilla-oficial-de-cierre-de-informes)) | Falta observación obligatoria |
| Trazabilidad parcial ([§13](#13-principio-de-trazabilidad)) | Transición sin ticket |
| Recomendación presentada con tono imperativo | «Debe aprobarse» |

**Acción:** reemitir informe conforme al Baseline; registrar addendum si aplica.

### BAJA

| Criterio | Ejemplo |
|----------|---------|
| Referencia cruzada rota o nomenclatura menor | Enlace § incorrecto en informe |
| Formato de fecha inconsistente en trazabilidad | Sin impacto en estados |

**Acción:** corregir en siguiente entrega; no bloquea evidencia si el fondo es correcto.

→ Catálogo GV: [§37](#37-detección-de-violaciones-de-gobernanza)

---

## 39. RESPUESTA OFICIAL DEL AGENTE

Plantilla **obligatoria** cuando un agente detecte una posible violación de gobernanza ([§41](#41-principio-de-vigilancia-de-gobernanza)).

```markdown
## Respuesta oficial — Violación de gobernanza

Tipo: [Violación detectada | Desviación de informe | Riesgo de estado]
Código: GV-xxx
Severidad: [CRÍTICA | ALTA | MEDIA | BAJA]
Descripción: [Hechos observables — rutas, mensajes, estados declarados]
Regla infringida: [§x — título de sección del Baseline]
Estado correcto: [Estado que debería mantenerse según Baseline]
Acción requerida: [Detener | Escalar PO | UNFREEZE | Nuevo ticket | Revertir declaración]
Observaciones: [Limitaciones de la auditoría — sin culpas ni intenciones]
```

**Prohibido** en este bloque: atribuir mala fe, fraude, culpa personal o intención ([§41](#41-principio-de-vigilancia-de-gobernanza)).

---

## 40. AUTOAUDITORÍA OBLIGATORIA

Checklist **obligatorio** antes de cerrar cualquier informe de agente. Combinar con [§36](#36-plantilla-oficial-de-cierre-de-informes).

### Grupo A — Prohibiciones (respuesta debe ser **NO**)

| □ | Pregunta | Respuesta permitida |
|---|----------|---------------------|
| A1 | ¿Estoy **interpretando** evidencia (más allá de hechos observables)? | **NO** |
| A2 | ¿Estoy **aprobando** algo? | **NO** |
| A3 | ¿Estoy **promoviendo estados** reservados al PO? | **NO** |
| A4 | ¿Estoy **recomendando Git** (commit/push/deploy) como si estuviera autorizado? | **NO** |

### Grupo B — Requisitos PO (si el informe implica cierre, UI o Git)

| □ | Pregunta | Si falta → prohibido lenguaje de aprobación |
|---|----------|---------------------------------------------|
| B1 | ¿**Existe validación visual** PO cuando el ticket toca UI/docs visibles? | Marcar **Esperando validación visual** |
| B2 | ¿**Existe aprobación PO** explícita o POAC [§34](#34-certificado-oficial-de-aprobación)? | **NO** usar APROBADO |
| B3 | ¿**Existe autorización Commit** (**AUTORIZADO COMMIT**)? | **NO** recomendar commit |
| B4 | ¿**Existe autorización Push** (**AUTORIZADO PUSH** / **`APROBADO PUSH`**)? | **NO** recomendar push |
| B5 | ¿**Existe autorización Deploy** (**AUTORIZADO DEPLOY**)? | **NO** recomendar deploy |

### Regla de cierre

**Si alguna respuesta del Grupo A es afirmativa (SÍ)** o **alguna del Grupo B es negativa (NO) cuando el informe sugeriría cierre o despliegue**, el informe **no podrá utilizar lenguaje de aprobación** ([§35](#35-lenguaje-prohibido-para-agentes)).

→ No autoaprobación: [§42](#42-principio-de-no-autoaprobación)

---

## 41. PRINCIPIO DE VIGILANCIA DE GOBERNANZA

Todo agente tiene el **deber** de señalar posibles incumplimientos de este Baseline — propios o observados en informes/tickets.

### Límites obligatorios

El agente **solo** podrá:

| Permitido | Prohibido |
|-----------|-----------|
| **Describir** la evidencia observable | Atribuir **intenciones** |
| **Indicar** la regla infringida (§ / GV) | Atribuir **culpas** o **mala fe** |
| **Proponer** el estado correcto según Baseline | Afirmar **fraude** o conducta personal |
| Usar plantilla [§39](#39-respuesta-oficial-del-agente) | Juicios sobre personas o motivos |

**Formulación permitida:**

> «Se observa posible incumplimiento de [§x / GV-xxx]. Estado correcto según Baseline: [estado]. Acción requerida: [acción].»

→ Conflictos entre agentes: [§20](#20-resolución-de-conflictos-entre-agentes) · Multiagente M-04: evidencia objetiva [§18](#18-gobernanza-multiagente)

---

## 42. PRINCIPIO DE NO AUTOAPROBACIÓN

Un agente **nunca** podrá utilizar como evidencia suficiente para aprobar un trabajo:

- Sus **propias conclusiones**
- Sus **propias auditorías**
- Sus **propias verificaciones**

aunque sean favorables, completas o repetidas.

| Entidad | ¿Puede aprobar? |
|---------|-----------------|
| Agente (conclusión propia) | **NO** |
| Agente (auditoría propia) | **NO** — solo **VERIFICADO TÉCNICAMENTE** / **EVIDENCIA PRESENTADA** |
| Product Owner | **SÍ** — única autoridad · POAC [§34](#34-certificado-oficial-de-aprobación) |

**Toda aprobación pertenece exclusivamente al Product Owner.**

→ Complementa [§30](#30-principio-de-evidencia) · [§11](#11-suficiencia-de-evidencia) · Autoauditoría: [§40](#40-autoauditoría-obligatoria)

---

## 43. POLÍTICA OFICIAL DE BASELINE

### Declaración formal

**MIAMIDJBEAT GOVERNANCE BASELINE**

Documento: `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md`  
Versión baseline: **3.1** · cuerpo principal definitivo  
Estado: **BASELINE** · **FROZEN** · **NORMA OFICIAL DE GOBERNANZA DEL PROYECTO**

### Reglas permanentes

Una vez declarado **BASELINE** y ratificado por el Product Owner:

| Regla | Significado |
|-------|-------------|
| B-01 | El texto baseline **no podrá modificarse** directamente |
| B-02 | El baseline **no podrá sobrescribirse** ni sustituirse por otro archivo |
| B-03 | Toda evolución futura generará documentos **independientes** |

### Mecanismos de evolución permitidos

| Mecanismo | Uso | Numeración |
|-----------|-----|------------|
| **ADDENDUM** | Añadir reglas, secciones o aclaraciones **sin reescribir** el Baseline | ADDENDUM-001, ADDENDUM-002, … |
| **ENMIENDA** | Modificar el **efecto** de una regla puntual del Baseline con trazabilidad PO | ENMIENDA-001, ENMIENDA-002, … |

**Prohibido:** editar §1–§79 del Baseline v3.1 tras ratificación PO. **Prohibido:** «consolidar» versiones borrando historial ([§44](#44-política-de-preservación-de-evidencia) · [§48](#48-cadena-oficial-de-custodia)).

Los ADDENDUM y ENMIENDA deben referenciar: versión baseline afectada · ticket · fecha · PO emisor · POAC cuando aplique.

→ Estabilidad post-ratificación: [§79 — Política Oficial de Estabilidad del Baseline](#79-cláusula-de-integridad-del-baseline) · Cierre definitivo post-ratificación: [§56](#56-principio-final-del-baseline) · [§79](#79-cláusula-de-integridad-del-baseline) · [§76](#76-cláusula-final-del-product-owner) · Este protocolo v3.1 queda sujeto a **FROZEN** — UNFREEZE solo PO para ENMIENDA formal, nunca reescritura inline.

---

## 44. POLÍTICA DE PRESERVACIÓN DE EVIDENCIA

Toda versión **aprobada** o **ratificada** del Baseline y documentos de gobernanza debe **conservarse** sin eliminación.

### Ámbitos de preservación

| Ámbito | Ejemplos |
|--------|----------|
| **Repositorios** | Tags Git · ramas de snapshot · commits de docs V2 |
| **PDF** | Exportaciones firmadas por PO |
| **Copias externas** | Backup cloud acordado con PO |
| **USB / offline** | Copia de contingencia |
| **Historial documental** | NOTA-DIARIA · session summaries · addendum |

### Reglas permanentes

| Regla | Descripción |
|-------|-------------|
| PR-01 | **Nunca eliminar** versiones anteriores del Baseline (v1.0–v3.1) |
| PR-02 | **Nunca reescribir** historial de informes, métricas validadas o estados PO ([§15](#15-historial-inmutable)) |
| PR-03 | Correcciones solo vía **addendum**, ticket nuevo, ADDENDUM o ENMIENDA |
| PR-04 | ADDENDUM/ENMIENDA **acumulan** — no reemplazan silenciosamente el Baseline |

→ Cadena de custodia: [§48](#48-cadena-oficial-de-custodia) · Paridad de evidencia: [§78](#78-cláusula-de-paridad-de-evidencia) · Alineado con Constitución: trazabilidad permanente · Multiagente: [§24](#24-principio-de-protección-del-historial)

---

## 45. MATRIZ OFICIAL DE AUTORIDAD

Matriz **oficial** de acciones y autoridad. **Amplía** [§25](#25-jerarquía-de-autoridad). Las acciones marcadas **PO exclusivo** no pueden ejecutarse ni declararse por agentes.

| Acción | Autoridad | ¿PO exclusivo? |
|--------|-----------|----------------|
| **Implementar** | Agente *(con ticket **AUTORIZADO**)* | No |
| **Documentar** | Agente | No |
| **Auditar** | Agente / Arquitecto | No |
| **Recomendar** | Agente *(como opinión — no orden)* | No |
| **Aprobar** | **Product Owner** | **Sí** |
| **Commit** | **Product Owner** — estado **AUTORIZADO COMMIT** | **Sí** |
| **Push** | **Product Owner** — **AUTORIZADO PUSH** / **`APROBADO PUSH`** | **Sí** |
| **Deploy** | **Product Owner** — **AUTORIZADO DEPLOY** / **`APROBADO DEPLOY PRODUCCIÓN`** | **Sí** |
| **Freeze** | **Product Owner** — declarar **FROZEN** | **Sí** |
| **Unfreeze** | **Product Owner** — procedimiento [§23](#23-procedimiento-unfreeze) | **Sí** |
| **Cerrar proyecto** | **Product Owner** — cierre formal vía POAC / **APROBADO PRODUCT OWNER** | **Sí** |

### Acciones adicionales (referencia §25)

| Acción | Autoridad | ¿PO exclusivo? |
|--------|-----------|----------------|
| Planificar | Product Owner | **Sí** |
| Autorizar inicio (**AUTORIZADO**) | Product Owner | **Sí** |
| Verificar técnicamente | Agente | No |
| Validar funcionalmente / visualmente | Product Owner | **Sí** |
| Promover **EN VALIDACIÓN PRODUCT OWNER** | Product Owner | **Sí** |

**Ningún agente** puede asumir filas marcadas **PO exclusivo** por inferencia ([§17](#17-principio-de-no-interpretación)).

---

## 46. CLÁUSULA FINAL

### Norma oficial

Este protocolo — **MIAMIDJBEAT GOVERNANCE BASELINE v3.1** — constituye la **norma oficial de gobernanza** del proyecto MiamiDJBeat.

Todo agente, desarrollador, arquitecto y colaborador **debe respetarlo** durante:

| Fase | Aplica |
|------|--------|
| Documentación | **Sí** |
| Arquitectura | **Sí** — gobernanza de proceso; no sustituye specs |
| Desarrollo | **Sí** |
| QA | **Sí** |
| Runtime | **Sí** |
| Deploy | **Sí** |
| Operación | **Sí** |

### Precedencia

| Conflicto | Prevalece |
|-----------|-----------|
| Informe de un agente **vs** este Baseline | **Este Baseline** ([§43](#43-política-oficial-de-baseline)) |
| Este Baseline **vs** Constitución del Proyecto | **Constitución** (`MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`) |
| Este Baseline **vs** Operation Guide | **Complementarios** — Constitución > Baseline > informes agente |
| ADDENDUM/ENMIENDA **vs** Baseline v3.1 | ADDENDUM/ENMIENDA **añaden o enmiendan** — no borran Baseline |
| Interpretación agente **vs** Product Owner | **Product Owner** ([§76](#76-cláusula-final-del-product-owner)) |

### Compatibilidad declarada

Este Baseline **no contradice**:

| Documento | Relación |
|-----------|----------|
| **Constitución** | Subordinado — PO y ADR supremos |
| **Operation Guide** (`NOTA-DIARIA-OPERACION-PERMANENTE.md`) | Operacionaliza el día a día — alineado |
| **Blueprint** | No alterado — gobernanza de proceso únicamente |
| **Architecture Handbook** | No alterado — referencias cruzadas intactas |
| **Shared Core** | No alterado — specs y CONTRACTS intactos |
| **Module Catalog** | No alterado — inventario MOD intacto |
| **Gobernanza existente** | Integra v1.0–v3.1 en baseline único definitivo |

### Obligación de los agentes

Ningún agente podrá **interpretar**, **resumir sustitutivamente**, **modificar directamente** ni **sustituir** este Baseline.

Evolución **exclusivamente** mediante **ADDENDUM-XXX** o **ENMIENDA-XXX** ([§43](#43-política-oficial-de-baseline) · [§79](#79-cláusula-de-integridad-del-baseline)), preservando historial ([§44](#44-política-de-preservación-de-evidencia) · [§48](#48-cadena-oficial-de-custodia)).

Filosofía central: presentar evidencia — no aprobar, no ampliar alcance, no interpretar autorizaciones ([§47](#47-principio-de-presunción-documental) · [§50](#50-principio-de-no-contaminación-de-tickets) · [§76](#76-cláusula-final-del-product-owner)).

**Detenerse** tras toda entrega. Esperar validación explícita del Product Owner.

---

## 47. PRINCIPIO DE PRESUNCIÓN DOCUMENTAL

Ante duda, conflicto o ambigüedad durante cualquier ticket, **prevalecen siempre** (en este orden de lectura operativa):

| # | Elemento presunto válido | Significado |
|---|--------------------------|-------------|
| PD-01 | **Evidencia documentada** | Hechos en archivos, commits, informes, bitácoras — no inferencias |
| PD-02 | **Último estado registrado** | Estado oficial trazado ([§13](#13-principio-de-trazabilidad)) |
| PD-03 | **Alcance aprobado** | Lo declarado en el ticket vigente ([§52](#52-principio-de-alcance-inviolable)) |
| PD-04 | **Estado FROZEN** | Elementos congelados permanecen intocables ([§22](#22-reglas-del-estado-frozen)) |
| PD-05 | **Última decisión explícita del Product Owner** | Comunicación verificable PO — no silencio ([§17](#17-principio-de-no-interpretación)) |

**Regla permanente:** ningún agente podrá **sustituir** estos elementos mediante interpretación, opinión, conveniencia técnica o consenso entre agentes ([§54](#54-cláusula-de-gobernanza-multiagente)).

→ Complementa [§30](#30-principio-de-evidencia) · Documentos maestros: [§49](#49-documentos-maestros-protegidos)

---

## 48. CADENA OFICIAL DE CUSTODIA

**Amplía** [§44](#44-política-de-preservación-de-evidencia). Define la preservación oficial de evidencia con trazabilidad completa.

### Fuentes válidas de custodia

| Fuente | Uso |
|--------|-----|
| **Git** | Commits, tags, ramas snapshot — historial inmutable |
| **PDF** | Exportaciones firmadas o archivadas por PO |
| **Snapshot** | Copia puntual fechada del repo o docs |
| **USB** | Respaldo offline acordado |
| **Historial documental** | NOTA-DIARIA · session summaries · informes · addendum |
| **Hash** | Cuando exista — integridad verificable del artefacto |

### Metadatos obligatorios por pieza de evidencia

| Campo | Requerido |
|-------|-----------|
| **Fecha** | ISO 8601 recomendado |
| **Hora** | Con zona horaria declarada |
| **Ticket** | ID que autoriza o documenta el hecho |
| **Responsable** | Agente · Arquitecto · Product Owner |
| **Entorno** | localhost · staging · producción — declarado explícitamente |
| **Rama Git** | Cuando aplique |
| **Versión** | Baseline · build · commit hash cuando aplique |

**Reglas permanentes:**

| Regla | Descripción |
|-------|-------------|
| CC-01 | Toda evidencia debe conservar **trazabilidad** ([§13](#13-principio-de-trazabilidad)) |
| CC-02 | **Nunca** eliminar evidencia histórica |
| CC-03 | Correcciones solo vía addendum, ticket nuevo, ADDENDUM o ENMIENDA — nunca borrado silencioso |

→ Plantilla trazabilidad: [§13.1](#131-plantilla-oficial-de-trazabilidad) · Paridad de evidencia: [§78](#78-cláusula-de-paridad-de-evidencia)

---

## 49. DOCUMENTOS MAESTROS PROTEGIDOS

Los siguientes documentos y familias documentales están **protegidos**. Ningún agente podrá modificarlos **indirectamente** desde otro ticket (drive-by, consistencia, refactors colaterales).

| Documento maestro | Ruta oficial |
|-------------------|--------------|
| **Constitución** | `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` |
| **Governance Baseline** | `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` |
| **Architecture Handbook** | `docs/V2/ARCHITECTURE/ARCHITECTURE-HANDBOOK.md` |
| **Blueprint** | `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` |
| **Module Catalog** | `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` |
| **Shared Core** | `MiamiDJBeat-MigracionV2/shared/` (specs por módulo) |
| **Contracts** | `MiamiDJBeat-MigracionV2/shared/CONTRACTS.md` |
| **Operation Guide** | `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` |
| **Architecture Maps** | `docs/V2/ARCHITECTURE/` (BOOT, DEPENDENCY, EVENT, ERROR, CONTRACT, DECISION, MODULE, GLOSSARY) |
| **Session Summaries** | `docs/V2/SESSION-SUMMARIES/` |
| **Nota Diaria** | `docs/V2/NOTA-DIARIA-LAB-001.md` |

### Regla de modificación

Si un ticket **requiere** modificar uno de estos documentos:

1. Debe existir **autorización explícita del Product Owner** en el ticket.
2. Debe respetarse alcance mínimo declarado.
3. Elementos **FROZEN** adicionalmente requieren UNFREEZE ([§23](#23-procedimiento-unfreeze)).

**Prohibido:** tocar un documento maestro «porque el ticket actual lo necesitaba» sin PO ([§50](#50-principio-de-no-contaminación-de-tickets)).

→ Detención obligatoria: [§53](#53-regla-de-detención-obligatoria) · Freeze: [§21](#21-política-oficial-de-freeze)

---

## 50. PRINCIPIO DE NO CONTAMINACIÓN DE TICKETS

Todo ticket posee un **alcance cerrado**. La necesidad técnica **NO** amplía el alcance — solo el Product Owner puede ampliarlo ([§7](#7-cambio-de-alcance-y-decisiones)).

### Procedimiento obligatorio

Si durante un ticket el agente detecta que necesita modificar **otro módulo, archivo o dominio** no incluido en el alcance:

| Paso | Acción |
|------|--------|
| 1 | **DETENERSE** — no continuar el cambio ajeno |
| 2 | **Informar** al Product Owner con evidencia observable |
| 3 | **Solicitar** autorización o ampliación de alcance |
| 4 | **Abrir ticket independiente** si PO lo autoriza |

**Prohibido:** modificar componentes ajenos «porque era necesario», «por consistencia» o «para que compile».

→ Alcance inviolable: [§52](#52-principio-de-alcance-inviolable) · Detención: [§53](#53-regla-de-detención-obligatoria)

---

## 51. PRINCIPIO DE RESPONSABILIDAD SOBRE CAMBIOS

Todo cambio realizado por un agente queda bajo **responsabilidad técnica del agente** que lo ejecutó o declaró.

### Expresiones no válidas

Queda **prohibido** usar como excusa definitiva:

| Expresión inválida | Motivo |
|--------------------|--------|
| «No sé cómo apareció.» | Responsabilidad no transferida |
| «El sistema lo cambió.» | Requiere evidencia objetiva de causa externa |
| «Fue automático.» | Requiere trazabilidad del trigger |
| «No recuerdo.» | No elimina responsabilidad sobre el diff |
| «Era un efecto secundario.» | Efecto secundario fuera de alcance = violación [§50](#50-principio-de-no-contaminación-de-tickets) |

### Regla permanente

| Regla | Descripción |
|-------|-------------|
| R-01 | La **ausencia de explicación** no elimina la responsabilidad técnica |
| R-02 | Si existe **evidencia objetiva** de causa externa (CI, hook, otro agente con ticket), debe **documentarse** con rutas, logs o referencias — sin atribuir mala fe ([§41](#41-principio-de-vigilancia-de-gobernanza)) |

→ Responsabilidad ampliada: [§57](#57-principio-de-responsabilidad-absoluta) · Trazabilidad: [§13](#13-principio-de-trazabilidad) · Custodia: [§48](#48-cadena-oficial-de-custodia)

---

## 52. PRINCIPIO DE ALCANCE INVIOLABLE

Si el ticket **no menciona** un componente, el agente debe asumir que dicho componente está **protegido**.

### Protegidos por defecto (lista no exhaustiva)

| Categoría | Ejemplos |
|-----------|----------|
| **Navegación y shell** | Navegación · menú · header · footer · sidebar |
| **Portales** | Dashboard · layouts visibles |
| **Core transversal** | Autenticación · permisos · sesiones · configuración · bootstrap |
| **Arquitectura** | Contratos · arquitectura · specs Shared Core |
| **Freeze** | Componentes **FROZEN** · documentos maestros [§49](#49-documentos-maestros-protegidos) |
| **General** | **Cualquier elemento fuera del alcance aprobado** del ticket |

**Regla:** presunción de protección hasta autorización PO explícita ([§47 PD-03](#47-principio-de-presunción-documental)).

→ Alcance ampliado: [§58](#58-principio-de-no-contaminación-del-alcance) · No contaminación: [§50](#50-principio-de-no-contaminación-de-tickets) · Detención: [§53](#53-regla-de-detención-obligatoria) · [§70](#70-principio-de-detención-obligatoria)

---

## 53. REGLA DE DETENCIÓN OBLIGATORIA

Cuando un agente detecte que debe modificar un **componente protegido** ([§49](#49-documentos-maestros-protegidos) · [§52](#52-principio-de-alcance-inviolable) · **FROZEN**):

| # | Obligación |
|---|------------|
| D-01 | **Detener inmediatamente** el trabajo sobre ese componente |
| D-02 | **No continuar** hasta recibir **autorización explícita del Product Owner** |
| D-03 | Documentar hecho observable + ticket + estado correcto ([§39](#39-respuesta-oficial-del-agente) si aplica violación) |
| D-04 | Si el componente es **FROZEN**, iniciar procedimiento UNFREEZE ([§23](#23-procedimiento-unfreeze)) |

**Prohibido:** «terminar rápido» un fix colateral en nav, auth, header o documento maestro sin PO.

→ Violaciones relacionadas: GV-003 · GV-009 [§37](#37-detección-de-violaciones-de-gobernanza) · Transparencia: [§69](#69-principio-de-transparencia-total) · Detención ampliada: [§70](#70-principio-de-detención-obligatoria)

---

## 54. CLÁUSULA DE GOBERNANZA MULTIAGENTE

**Amplía** [§18](#18-gobernanza-multiagente) y [§20](#20-resolución-de-conflictos-entre-agentes).

### Las opiniones de otros agentes

| Acción | ¿Válida desde opinión de agente? |
|--------|----------------------------------|
| Modificar el Baseline | **NO** |
| Sustituir decisiones del Product Owner | **NO** |
| Aprobar tickets | **NO** |
| Autorizar cambios | **NO** |
| Ampliar alcance | **NO** |

### Resolución de conflicto entre agentes

Si existe conflicto entre agentes:

> **Permanece vigente el último estado aprobado por el Product Owner** ([§47 PD-05](#47-principio-de-presunción-documental)).

Hasta nueva decisión PO: conservar estado oficial · documentar diferencias con evidencia · no promover estados ([§12](#12-cambio-de-estado)).

---

## 55. CLÁUSULA DE EVIDENCIA VISUAL

Para cualquier trabajo con **impacto visual**:

- Frontend · navegación · layouts · componentes visibles
- Documentos de presentación · interfaces · UI copy visible

### Prohibiciones de lenguaje (agente)

Queda **prohibido** declarar sin validación visual PO:

| Prohibido | Alternativa permitida |
|-----------|----------------------|
| APROBADO | **EVIDENCIA PRESENTADA** |
| COMPLETADO | **IMPLEMENTADO** |
| FINALIZADO | **DOCUMENTADO** |
| TERMINADO | **PENDIENTE VALIDACIÓN DEL PRODUCT OWNER** |
| CERRADO | **Esperando validación visual** |
| LISTO PARA PRODUCCIÓN | **Verificación técnica realizada** — no deploy |

### Formulaciones permitidas (agente)

- **IMPLEMENTADO**
- **DOCUMENTADO**
- **EVIDENCIA PRESENTADA**
- **PENDIENTE VALIDACIÓN DEL PRODUCT OWNER**

**La aprobación visual pertenece exclusivamente al Product Owner** ([§33](#33-clasificación-oficial-de-la-evidencia) — tipo Visual).

→ Autoauditoría B1 [§40](#40-autoauditoría-obligatoria) · GV-008 [§37](#37-detección-de-violaciones-de-gobernanza) · Lenguaje: [§35](#35-lenguaje-prohibido-para-agentes) · Ampliación: [§72](#72-principio-de-evidencia-visual-obligatoria) · Interfaces: [§64](#64-principio-de-protección-de-interfaces)

---

## 56. PRINCIPIO FINAL DEL BASELINE

### Ratificación y congelamiento

Una vez **ratificado por el Product Owner**:

| Atributo | Valor |
|----------|-------|
| Documento | **MIAMIDJBEAT GOVERNANCE BASELINE** |
| Versión | **v3.1** |
| Estado | **BASELINE** · **FROZEN** · **NORMA OFICIAL DE GOBERNANZA DEL PROYECTO** |

### Evolución futura — únicos mecanismos permitidos

| Mecanismo | Numeración |
|-----------|------------|
| **ADDENDUM** | ADDENDUM-001 · ADDENDUM-002 · … |
| **ENMIENDA** | ENMIENDA-001 · ENMIENDA-002 · … |

**Queda prohibida** la reescritura directa del contenido ratificado (§1–§79).

### Filosofía central (recordatorio permanente)

> Los agentes **presentan evidencia**.  
> Los agentes **NO** aprueban trabajos.  
> Los agentes **NO** amplían alcances.  
> Los agentes **NO** interpretan autorizaciones.  
> **Solo el Product Owner** valida, aprueba y autoriza.

→ Política baseline: [§43](#43-política-oficial-de-baseline) · Integridad y estabilidad: [§79](#79-cláusula-de-integridad-del-baseline) · Precedencia PO: [§76](#76-cláusula-final-del-product-owner) · Preservación: [§44](#44-política-de-preservación-de-evidencia) · [§48](#48-cadena-oficial-de-custodia)

---

## 57. PRINCIPIO DE RESPONSABILIDAD ABSOLUTA

**Amplía** [§51](#51-principio-de-responsabilidad-sobre-cambios).

Todo cambio realizado por un agente será **responsabilidad exclusiva del agente que lo ejecutó** — incluidos cambios en archivos compartidos, refactors colaterales y efectos no declarados.

### No constituyen justificación válida

| Excusa inválida | Regla |
|-----------------|-------|
| Comportamiento automático | Responsabilidad del agente que inició la acción |
| Sugerencia automática | No sustituye autorización PO |
| Inteligencia artificial externa | El agente que aplica el cambio es responsable |
| Sincronización automática | Documentar causa externa con evidencia ([§51](#51-principio-de-responsabilidad-sobre-cambios)) |
| Refactor automático | Fuera de alcance = violación [§50](#50-principio-de-no-contaminación-de-tickets) |
| Corrección automática | Requiere ticket y alcance PO |
| Decisión implícita | Prohibida ([§17](#17-principio-de-no-interpretación)) |

**Regla permanente:** toda modificación **observable** pertenece al agente responsable de haberla producido o declarado.

---

## 58. PRINCIPIO DE NO CONTAMINACIÓN DEL ALCANCE

**Amplía** [§52](#52-principio-de-alcance-inviolable).

Todo ticket **protege automáticamente** cualquier componente **no mencionado expresamente** en el alcance del ticket.

### Componentes protegidos por omisión (ejemplos)

Header · Navigation · Footer · Dashboard · Auth · Session · Permissions · Theme · Event Bus · Portal Shell · Shared Components · Layout · Bootstrap · CSS Global · Shared JS · Roles

| Regla | Significado |
|-------|-------------|
| NC-01 | Si el ticket **no nombra** el componente → **protegido** |
| NC-02 | **No podrá modificarse** sin autorización PO explícita |
| NC-03 | Necesidad técnica **no** abre excepción ([§50](#50-principio-de-no-contaminación-de-tickets)) |

→ Archivos compartidos: [§63](#63-regla-oficial-de-archivos-compartidos) · Detención: [§70](#70-principio-de-detención-obligatoria)

---

## 59. PRINCIPIO DE PRESERVACIÓN DEL PRODUCTO

Queda **prohibido** eliminar o alterar funcionalidades existentes sin **autorización expresa del Product Owner**.

### Ámbito protegido (ejemplos)

Botones · Tabs · Menús · Páginas · Formularios · Rutas · Permisos · Widgets · Componentes

| Acción | Consecuencia gobernanza |
|--------|-------------------------|
| Eliminación no autorizada | Posible violación GV — [§37](#37-detección-de-violaciones-de-gobernanza) |
| Alteración de flujo existente | Requiere alcance PO + evidencia comparativa [§61](#61-principio-de-evidencia-comparativa) |
| Sustitución de solución | Prohibida sin PO ([§73](#73-principio-de-no-sustitución)) |

→ No sustitución: [§73](#73-principio-de-no-sustitución) · Conservación diseño: [§74](#74-principio-de-conservación-del-diseño)

---

## 60. PRINCIPIO DE REGRESIÓN CERO

Todo ticket deberá **demostrar** antes de promover **EN VALIDACIÓN PRODUCT OWNER**:

```
ANTES
      ↓
DESPUÉS
      ↓
SIN REGRESIONES
```

| Requisito | Descripción |
|-----------|-------------|
| **ANTES** | Estado observable previo (captura, ruta, comportamiento) |
| **DESPUÉS** | Estado tras el cambio acotado al ticket |
| **SIN REGRESIONES** | Áreas fuera de alcance intactas — evidencia explícita |

**Sin esta evidencia** el ticket **no podrá avanzar** hacia Validación del Product Owner ([§11](#11-suficiencia-de-evidencia)).

→ Formato comparativo: [§61](#61-principio-de-evidencia-comparativa) · Confianza cero: [§75](#75-principio-de-confianza-cero)

---

## 61. PRINCIPIO DE EVIDENCIA COMPARATIVA

**Amplía** [§9](#9-evidencia-en-informes-del-agente) y [§60](#60-principio-de-regresión-cero).

Toda evidencia de entrega deberá incluir:

| Bloque | Contenido |
|--------|-----------|
| **ANTES** | Hecho observable pre-cambio |
| **DESPUÉS** | Hecho observable post-cambio |
| **DIFERENCIA** | Qué cambió — acotado al ticket |

**No será suficiente** presentar únicamente el estado final.

→ Custodia: [§48](#48-cadena-oficial-de-custodia) · Plantilla cierre: [§36](#36-plantilla-oficial-de-cierre-de-informes)

---

## 62. CLÁUSULA DE IMPACTO GLOBAL

Antes de modificar **cualquier archivo**, el agente deberá **declarar** en el informe o ticket:

| Nivel | Significado |
|-------|-------------|
| **Impacto Local** | Un archivo o bloque acotado |
| **Impacto Compartido** | Múltiples páginas o módulos que consumen el mismo asset |
| **Impacto Global** | Header, nav, CSS global, auth, bootstrap, shared JS |

### Regla de detención

Si durante el trabajo aparece un **impacto superior** al declarado → **detener** inmediatamente ([§70](#70-principio-de-detención-obligatoria)) · informar PO · no continuar hasta autorización.

→ Dependencias: [§65](#65-declaración-obligatoria-de-dependencias) · Archivos compartidos: [§63](#63-regla-oficial-de-archivos-compartidos)

---

## 63. REGLA OFICIAL DE ARCHIVOS COMPARTIDOS

Los siguientes componentes requieren **ticket exclusivo** autorizado por Product Owner. **No podrán modificarse** desde tickets funcionales o documentales ajenos:

| Componente | Notas |
|------------|-------|
| Header | Incl. `#mainNav`, shared header |
| Navigation | Nav pública y strips pactados |
| Theme | MOD-007 · tokens |
| Auth | MOD-001 · gates |
| Session | MOD-002 |
| Permissions | MOD-003 · capabilities |
| Event Bus | MOD-004 |
| Bootstrap | Orden de boot [§5](#5-máquina-oficial-de-estados) |
| Portal Shell | Layout transversal portales |
| Shared CSS | CSS global compartido |
| Shared JS | Scripts compartidos V1/V2 según ticket |
| Layout | Shell y contenedores transversales |
| Core | Shared Core transversal |

**Violación:** modificar desde ticket no exclusivo = posible GV-003 · GV-009 [§37](#37-detección-de-violaciones-de-gobernanza).

→ Alcance: [§58](#58-principio-de-no-contaminación-del-alcance) · UNFREEZE si FROZEN: [§23](#23-procedimiento-unfreeze)

---

## 64. PRINCIPIO DE PROTECCIÓN DE INTERFACES

**Amplía** [§55](#55-cláusula-de-evidencia-visual) y [§74](#74-principio-de-conservación-del-diseño).

Todo cambio que altere cualquiera de:

Interfaz · Navegación · Orden · Posición · Jerarquía · Colores · Espaciado · Tipografía · UX

requiere **validación visual del Product Owner** antes de cualquier lenguaje de cierre o aprobación.

→ Evidencia visual obligatoria: [§72](#72-principio-de-evidencia-visual-obligatoria)

---

## 65. DECLARACIÓN OBLIGATORIA DE DEPENDENCIAS

Antes de **comenzar** un ticket el agente deberá declarar:

| Declaración | Contenido |
|-------------|-----------|
| **Archivos que modificará** | Lista explícita — rutas |
| **Archivos protegidos** | Fuera de alcance — no tocar |
| **Archivos que permanecerán intactos** | Confirmación explícita |

### Regla de detención

Si durante el desarrollo aparece un **nuevo archivo** a modificar no declarado → **detener** · informar PO · solicitar ampliación o ticket nuevo ([§50](#50-principio-de-no-contaminación-de-tickets)).

→ Impacto: [§62](#62-cláusula-de-impacto-global) · Transparencia: [§69](#69-principio-de-transparencia-total)

---

## 66. PROHIBICIÓN DE EXPANSIÓN AUTÓNOMA

Quedan **prohibidas** las siguientes formulaciones y su equivalente en acción:

| Prohibido | Motivo |
|-----------|--------|
| «Aproveché para…» | Trabajo adicional sin ticket |
| «También corregí…» | Contaminación de alcance |
| «Ya que estaba…» | Alcance no autorizado |
| «Optimicé…» | Fuera de ticket sin PO |
| «Refactoricé…» | Requiere ticket exclusivo |

**Todo trabajo adicional** requiere **ticket independiente** y autorización PO ([§50](#50-principio-de-no-contaminación-de-tickets)).

→ Violaciones: GV-003 [§37](#37-detección-de-violaciones-de-gobernanza)

---

## 67. PRINCIPIO OFICIAL DE CONGELACIÓN

**Amplía** [§21](#21-política-oficial-de-freeze).

Todo componente **aprobado por el Product Owner** pasa **automáticamente** al estado:

**FROZEN**

Hasta recibir **UNFREEZE** emitido por el Product Owner ([§23](#23-procedimiento-unfreeze)).

| Regla | Descripción |
|-------|-------------|
| CF-01 | Aprobación PO = freeze operativo del componente aprobado |
| CF-02 | Agentes no pueden «descongelar» por conveniencia |
| CF-03 | Baseline v3.1 ratificado = FROZEN permanente salvo ENMIENDA PO |

---

## 68. CLÁUSULA OFICIAL DE INCIDENTE DE GOBERNANZA

Cuando exista una **posible violación** del Baseline ([§37](#37-detección-de-violaciones-de-gobernanza)):

| Orden | Acción |
|-------|--------|
| 1 | **NO** abrir primero un ticket técnico de fix |
| 2 | Abrir previamente un **INCIDENTE DE GOBERNANZA** |
| 3 | Incluir trazabilidad completa: GV · evidencia · estado · responsable · ticket origen |

### Contenido mínimo del incidente

Ticket ID · código GV · severidad [§38](#38-clasificación-oficial-de-severidad) · hechos observables · regla infringida · estado correcto · acción requerida · plantilla [§39](#39-respuesta-oficial-del-agente)

→ Respuesta agente: [§39](#39-respuesta-oficial-del-agente) · Presunción documental: [§47](#47-principio-de-presunción-documental)

---

## 69. PRINCIPIO DE TRANSPARENCIA TOTAL

**Amplía** [§53](#53-regla-de-detención-obligatoria) y [§41](#41-principio-de-vigilancia-de-gobernanza).

Si un agente detecta que necesita modificar un **componente protegido** ([§49](#49-documentos-maestros-protegidos) · [§58](#58-principio-de-no-contaminación-del-alcance) · [§63](#63-regla-oficial-de-archivos-compartidos)):

| Obligación | Descripción |
|------------|-------------|
| T-01 | **Informarlo inmediatamente** al Product Owner |
| T-02 | **Nunca ocultarlo** en el diff o informe |
| T-03 | **Nunca modificarlo silenciosamente** |

→ Detención: [§70](#70-principio-de-detención-obligatoria)

---

## 70. PRINCIPIO DE DETENCIÓN OBLIGATORIA

**Amplía** [§53](#53-regla-de-detención-obligatoria).

Ante **cualquier** dependencia inesperada, impacto no declarado o componente protegido:

| Paso | Acción |
|------|--------|
| 1 | **Detenerse** |
| 2 | **Informar** al Product Owner con evidencia |
| 3 | **Esperar** decisión del Product Owner |

**Prohibido:** improvisar · asumir autorización · continuar «para no bloquear».

→ Impacto global: [§62](#62-cláusula-de-impacto-global) · Dependencias: [§65](#65-declaración-obligatoria-de-dependencias) · Cláusula PO: [§76](#76-cláusula-final-del-product-owner)

---

## 71. PRINCIPIO DE REVERSIBILIDAD

Todo cambio deberá poder **revertirse completamente**.

| Requisito | Gate |
|-----------|------|
| Estrategia de reversión documentada | Antes de iniciar implementación |
| Rollback identificado | Backend/deploy [§8.3](#83-backend) |
| Diff acotado | Un ticket = reversión acotada |

**Si no existe estrategia documentada de reversión**, el cambio **no deberá comenzar**.

→ Backend rollback: [§8.3](#83-backend) · Git: [§28](#28-relación-con-commit--push--deploy)

---

## 72. PRINCIPIO DE EVIDENCIA VISUAL OBLIGATORIA

**Amplía** [§55](#55-cláusula-de-evidencia-visual).

Para **cualquier modificación visual**, queda **prohibido** utilizar sin validación visual PO:

COMPLETADO · TERMINADO · LISTO · READY · DONE · APROBADO · FINISHED · PRODUCTION READY · DEPLOY READY

*(Incluye variantes en español e inglés — ver [§35](#35-lenguaje-prohibido-para-agentes).)*

### Formulaciones permitidas (agente)

IMPLEMENTADO · DOCUMENTADO · EVIDENCIA PRESENTADA · PENDIENTE VALIDACIÓN DEL PRODUCT OWNER

→ Interfaces: [§64](#64-principio-de-protección-de-interfaces) · Autoauditoría B1: [§40](#40-autoauditoría-obligatoria)

---

## 73. PRINCIPIO DE NO SUSTITUCIÓN

El agente deberá **reparar la solución existente** dentro del alcance del ticket.

**No podrá reemplazarla** por otra arquitectura, patrón o implementación diferente salvo **autorización expresa del Product Owner**.

| Permitido | Prohibido |
|-----------|-----------|
| Fix mínimo en código existente | Reescritura total «más limpia» |
| Ajuste acotado al defecto | Sustituir componente por alternativa nueva |

→ Preservación producto: [§59](#59-principio-de-preservación-del-producto)

---

## 74. PRINCIPIO DE CONSERVACIÓN DEL DISEÑO

Queda **prohibido** modificar sin autorización expresa del Product Owner:

Layout · Jerarquía · Espaciados · Alineación · Tipografía · Colores · Orden · Navegación

→ Protección interfaces: [§64](#64-principio-de-protección-de-interfaces) · Evidencia visual: [§72](#72-principio-de-evidencia-visual-obligatoria)

---

## 75. PRINCIPIO DE CONFIANZA CERO

**Amplía** [§30](#30-principio-de-evidencia) y [§32](#32-principio-de-la-duda).

| Regla | Significado |
|-------|-------------|
| CZ-01 | Toda **afirmación** deberá estar respaldada por **evidencia** observable |
| CZ-02 | **Nada** podrá presumirse |
| CZ-03 | **Nada** podrá darse por válido automáticamente |
| CZ-04 | Silencio, tiempo y auditorías favorables **no** validan ([§17](#17-principio-de-no-interpretación)) |

→ Evidencia comparativa: [§61](#61-principio-de-evidencia-comparativa) · Suficiencia PO: [§11](#11-suficiencia-de-evidencia)

---

## 76. CLÁUSULA FINAL DEL PRODUCT OWNER

### Precedencia interpretativa

Cuando exista **cualquier diferencia** entre la interpretación de un agente y la interpretación del **Product Owner**:

> **Prevalece siempre la interpretación del Product Owner.**

| Prohibido (agente) | Requerido |
|--------------------|-----------|
| Ampliar alcance aprobado | Detener y solicitar PO |
| Reducir alcance protegido | Respetar ticket y Baseline |
| Reinterpretar autorizaciones | Comunicación explícita PO |
| Modificar alcance sin autorización | Ticket nuevo o ampliación PO |

### Regla de duda

**Si existe duda**, el agente deberá **detener inmediatamente** el trabajo y **solicitar decisión del Product Owner** antes de continuar ([§70](#70-principio-de-detención-obligatoria)).

### Declaración oficial del Baseline

Este documento queda oficialmente definido como:

| Campo | Valor |
|-------|-------|
| **Nombre** | **MIAMIDJBEAT GOVERNANCE BASELINE** |
| **Versión** | **3.1** · versión definitiva del cuerpo principal |
| **Estado** | **BASELINE** · **FROZEN** · **NORMA OFICIAL DE GOBERNANZA DEL PROYECTO** |

Toda evolución futura deberá realizarse **exclusivamente** mediante **ADDENDUM-XXX** o **ENMIENDA-XXX** aprobados expresamente por el Product Owner.

**Queda prohibida** la modificación directa del cuerpo principal del Baseline (§1–§79) una vez ratificado.

→ Constitución prevalece ante conflicto · Integridad: [§79](#79-cláusula-de-integridad-del-baseline) · Política: [§43](#43-política-oficial-de-baseline) · Preservación: [§44](#44-política-de-preservación-de-evidencia) · [§48](#48-cadena-oficial-de-custodia)

---

## 77. CLÁUSULA DE PROTECCIÓN DE PRODUCCIÓN

Toda modificación que **pueda afectar** cualquiera de los siguientes ámbitos requiere **autorización expresa del Product Owner** documentada **antes** del cambio:

| Ámbito protegido | Descripción |
|------------------|-------------|
| **Producción** | V1 en operación real — usuarios y negocio |
| **Localhost previamente validado** | Entorno ya inspeccionado y aceptado por PO para el ticket |
| **Componentes aprobados** | Elementos en **APROBADO PRODUCT OWNER** / POAC |
| **Componentes FROZEN** | [§22](#22-reglas-del-estado-frozen) · [§67](#67-principio-oficial-de-congelación) |
| **Runtime existente** | Código o servicios en ejecución fuera del alcance del ticket |
| **V1** | Sitio `web/` en producción |
| **V2 validada** | Laboratorio o docs ratificados por PO |

### Reglas permanentes

| Regla | Descripción |
|-------|-------------|
| PP-01 | **Prohibido** producir efectos colaterales sobre producción como consecuencia **indirecta** de un ticket |
| PP-02 | Todo impacto sobre producción deberá **documentarse previamente** en el ticket o informe |
| PP-03 | Deploy a producción requiere **AUTORIZADO DEPLOY** ([§28](#28-relación-con-commit--push--deploy)) |

→ Detención: [§70](#70-principio-de-detención-obligatoria) · Impacto global: [§62](#62-cláusula-de-impacto-global)

---

## 78. CLÁUSULA DE PARIDAD DE EVIDENCIA

**Amplía** [§48](#48-cadena-oficial-de-custodia) y [§61](#61-principio-de-evidencia-comparativa).

Toda evidencia presentada deberá indicar **claramente**:

| Metadato | Obligatorio |
|----------|-------------|
| **Entorno utilizado** | localhost · puerto · URL · staging · producción |
| **Fecha** | ISO 8601 |
| **Hora** | Con zona horaria |
| **Rama Git** | Cuando aplique |
| **Versión** | Commit · tag · Baseline · build |
| **Ticket** | ID del ticket |
| **Responsable** | Agente · PO según rol |
| **Evidencia visual correspondiente** | Captura · grabación · N/A declarado |

### Regla de paridad

| Prohibido | Motivo |
|-----------|--------|
| Usar evidencia de **un entorno** para justificar resultados en **otro** | Paridad rota |
| «En mi máquina funciona» | No constituye evidencia suficiente |
| «En mi entorno funciona» | Entorno no verificado por PO |
| «En el sandbox funciona» | Sandbox ≠ entorno de evaluación PO |

**La evidencia deberá corresponder exactamente al entorno evaluado por el Product Owner** ([§11](#11-suficiencia-de-evidencia)).

→ Confianza cero: [§75](#75-principio-de-confianza-cero) · Clasificación visual: [§33](#33-clasificación-oficial-de-la-evidencia)

---

## 79. CLÁUSULA DE INTEGRIDAD DEL BASELINE

Una vez **ratificado por el Product Owner**, el presente Baseline constituye la **referencia normativa permanente** del proyecto.

### Prohibiciones para agentes

Ningún agente podrá:

| Prohibido | Descripción |
|-----------|-------------|
| **Omitir** el Baseline | Todo ticket e informe opera bajo este documento |
| **Reinterpretarlo** | Prevalece texto ratificado · PO interpreta ([§76](#76-cláusula-final-del-product-owner)) |
| **Resumirlo sustituyendo su contenido** | Resúmenes no reemplazan norma |
| **Crear reglas paralelas** | ADDENDUM/ENMIENDA son el único canal |
| **Declarar excepciones** | Solo PO vía POAC o ticket de gobernanza |
| **Modificar su significado** | Integridad semántica del cuerpo ratificado |

Toda evolución futura deberá realizarse **exclusivamente** mediante **ADDENDUM-XXX** o **ENMIENDA-XXX**, manteniendo **íntegro** el texto oficialmente ratificado.

→ Política baseline: [§43](#43-política-oficial-de-baseline) · Preservación: [§44](#44-política-de-preservación-de-evidencia)

### Política Oficial de Estabilidad del Baseline

Una vez **ratificado por el Product Owner**, el Baseline queda **congelado**. A partir de ese momento:

| Prohibido tras ratificación | Descripción |
|----------------------------|-------------|
| Añadir nuevas secciones al cuerpo principal | Solo vía **ADDENDUM** |
| Renumerar secciones existentes | Estructura §1–§79 inmutable |
| Reescribir cláusulas aprobadas | Solo vía **ENMIENDA** con trazabilidad |
| Eliminar apartados | Historial preservado [§44](#44-política-de-preservación-de-evidencia) |

Toda evolución futura deberá realizarse **únicamente** mediante:

| Mecanismo | Requisitos mínimos |
|-----------|-------------------|
| **ADDENDUM** | Numeración propia · fecha · ticket · trazabilidad · justificación · aprobación expresa PO |
| **ENMIENDA** | Numeración propia · fecha · ticket · trazabilidad · justificación · aprobación expresa PO |

### Declaración oficial — cierre del Baseline v3.1

| Campo | Valor |
|-------|-------|
| **Nombre** | **MIAMIDJBEAT GOVERNANCE BASELINE** |
| **Versión** | **3.1** |
| **Estado** | **BASELINE** · **FROZEN** · **NORMA OFICIAL DE GOBERNANZA DEL PROYECTO** |
| **Cuerpo principal** | **Versión definitiva** — §1–§79 |

Toda modificación futura del cuerpo ratificado: **exclusivamente ADDENDUM** o **ENMIENDA**, aprobados expresamente por el Product Owner. **Prohibida** la modificación directa del cuerpo principal una vez ratificado.

→ Cláusula PO: [§76](#76-cláusula-final-del-product-owner) · Constitución prevalece ante conflicto

**Detenerse** tras toda entrega. Esperar validación explícita del Product Owner.

---

*MIAMIDJBEAT GOVERNANCE BASELINE v3.1 · BASELINE · FROZEN · NORMA OFICIAL DE GOBERNANZA DEL PROYECTO · versión definitiva del cuerpo principal — TICKET-V2-GOVERNANCE-BASELINE-004 — 2026-07-05*
