# MIAMI DJ BEAT

# CONSTITUCIÓN DEL PROYECTO

**Versión:** 1.0  
**Estado:** Documento Permanente  
**Ticket:** TICKET-V2-PROJECT-CONSTITUTION-001  
**Autoridad:** Máxima autoridad documental del proyecto  
**Modificación:** Solo mediante ADR aprobada por el Product Owner

> Ningún documento inferior puede contradecir esta Constitución.  
> Toda decisión futura deberá respetarla.

---

## SECCIÓN 1 — MISIÓN

La misión permanente de Miami DJ Beat es:

**Construir una plataforma tecnológica estable, escalable y profesional para la industria del entretenimiento, protegiendo siempre la continuidad operativa del negocio.**

Esto implica:

- Servir a clientes, artistas y operación interna con confianza
- Mantener producción operativa mientras evoluciona la arquitectura
- Priorizar calidad y evidencia sobre velocidad aparente
- Documentar decisiones para que el proyecto trascienda a cualquier colaborador individual

La misión **no** es rehacer el negocio desde cero. Es **fortalecer la base tecnológica** que lo sostiene.

---

## SECCIÓN 2 — VISIÓN

**Visión a largo plazo:**

Convertir Miami DJ Beat en una **plataforma modular** capaz de **evolucionar durante muchos años** sin perder estabilidad ni calidad.

Cuando la visión esté cumplida:

- Tres portales independientes (Cliente, Artista, Staff) sobre un Shared Core sólido
- Una sola fuente de verdad operativa (Operations Core: una orden, proyección por rol)
- Migración completada por módulos, sin big bang
- Arquitectura fácil de mantener, probar y extender
- Producción protegida en cada fase del camino

V1 cumple el negocio hoy. V2 cumple la visión de mañana. Coexisten hasta que la migración lo autorice el Product Owner.

---

## SECCIÓN 3 — VALORES DEL PROYECTO

Valores **fundamentales** e inmutables salvo ADR:

| Valor | Significado en la práctica |
|-------|----------------------------|
| **Calidad** | Cuatro capas de QA + PO antes de cierre |
| **Transparencia** | Alcance, riesgo y evidencia visibles en tickets |
| **Evidencia** | Diff, capturas, logs — no opiniones |
| **Estabilidad** | Producción primero; regla de oro (Sección 14) |
| **Escalabilidad** | Módulos y portales, no monolito |
| **Responsabilidad** | Cada cambio tiene autor y validación |
| **Modularidad** | Una responsabilidad por módulo |
| **Documentación** | Conocimiento permanece en el repo |
| **Respeto por Producción** | V1 protegida; deploy solo con autorización |
| **Mejora continua** | Lecciones aprendidas tras cada incidente |

---

## SECCIÓN 4 — AUTORIDAD

| Nivel | Poder |
|-------|-------|
| **Product Owner** | Aprobación final de alcance, cierre, migración y producción |
| **Arquitecto** | Validación de contratos, ADR y límites estructurales |
| **Implementación** | Ejecuta solo lo autorizado |

**Reglas de autoridad:**

1. Toda implementación requiere **validación visual del Product Owner** cuando corresponda (UI, nav, flujos visibles).
2. Toda decisión **estratégica** requiere **documentación** (memoria, ticket, nota).
3. Toda decisión **arquitectónica** requiere **ADR** aprobada por Product Owner.

Frases exactas para acciones críticas:

- Push: **`APROBADO PUSH`**
- Deploy producción: **`APROBADO DEPLOY PRODUCCIÓN`**

---

## SECCIÓN 5 — JERARQUÍA DOCUMENTAL

Orden oficial de autoridad. **Ningún documento inferior puede contradecir uno superior.**

| Nivel | Documento | Ruta |
|-------|-----------|------|
| **1** | **Constitución del Proyecto** | `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` |
| **2** | Arquitectura Viva | `docs/V2/MiamiDJBeat-V2-ARQUITECTURA-VIVA.md` |
| **3** | Memoria V2 | `docs/V2/MiamiDJBeat-MigracionV2-MEMORIA.md` |
| **4** | Operación Permanente | `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` |
| **5** | ADR | Tabla en Arquitectura Viva + `portal-v2-lab/docs/adr/` (futuro) |
| **6** | Roadmap | `docs/V2-LAB/08-PROJECT-ROADMAP.md` |
| **7** | Tickets | `docs/tickets/` |
| **8** | Notas diarias | Complementarias; nunca contradicen niveles 1–4 |

En caso de conflicto: prevalece el nivel **más alto**. Si hay duda, escalar al Product Owner antes de implementar.

---

## SECCIÓN 6 — REGLAS DE GOBERNANZA

| # | Regla |
|---|-------|
| G-01 | **Nunca** trabajar fuera del alcance autorizado en el ticket |
| G-02 | **Nunca** modificar producción sin aprobación explícita |
| G-03 | **Nunca** cerrar tickets sin evidencia |
| G-04 | **Nunca** implementar arquitectura sin ADR |
| G-05 | **Nunca** mezclar dominios (header, invoice, portal, docs, supabase) |
| G-06 | **Nunca** aumentar deuda técnica deliberadamente |
| G-07 | **Nunca** ocultar riesgos técnicos |
| G-08 | **Nunca** reemplazar evidencia por opiniones |

Violación de gobernanza invalida el cierre del ticket y puede bloquear merge o deploy.

---

## SECCIÓN 7 — PROTECCIÓN DE PRODUCCIÓN

**Producción tiene prioridad absoluta.**

| Principio | Aplicación |
|-----------|------------|
| V1 protegida | Hasta completar migración módulo por módulo |
| Migración reversible | Rollback planificado en cada cutover |
| Sin Big Bang | Olas controladas; nunca reemplazo total de un día para otro |
| Módulo retirable | Todo módulo migrado debe poder volver atrás sin destruir datos |

Desarrollo V2 en laboratorio **no puede afectar V1** durante la construcción. Coexistencia paralela es el modelo normal hasta autorización de cutover.

---

## SECCIÓN 8 — PRINCIPIOS DE DESARROLLO

Los **siete principios** guían todo trabajo:

| Principio | Regla |
|-----------|-------|
| **Un módulo** | Un ticket, un propósito, un diff acotado |
| **Una responsabilidad** | Cada módulo hace una cosa bien |
| **Una fuente de verdad** | Datos y órdenes no se duplican |
| **Una arquitectura** | Shared Core + tres portales; sin atajos paralelos |
| **Un contrato** | Interfaces explícitas entre módulos; eventos, no polling |
| **Una validación** | Plan de QA declarado antes de implementar |

*(El séptimo principio implícito en calidad: ver Sección 9.)*

---

## SECCIÓN 9 — PRINCIPIOS DE CALIDAD

Todo desarrollo debe cumplir **cinco validaciones** antes de declararse terminado:

| # | Validación | Qué confirma |
|---|------------|--------------|
| 1 | **QA Técnico** | Código, consola, red, permisos, diff |
| 2 | **QA Funcional** | Flujo completo del ticket |
| 3 | **QA Visual** | Desktop, móvil, identidad, sin layout shift no autorizado |
| 4 | **QA Product Owner** | Aprobación visual y de producto |
| 5 | **QA Producción** | Comportamiento en entorno real tras deploy autorizado |

**Sin estas validaciones el trabajo no podrá declararse terminado.**

Informes de implementación **no sustituyen** QA Visual ni QA Product Owner.

---

## SECCIÓN 10 — GESTIÓN DEL RIESGO

Todo ticket debe clasificar:

| Campo | Contenido |
|-------|-----------|
| **Impacto** | Usuarios, roles y superficies afectadas |
| **Complejidad** | Baja / media / alta; archivos y dominios tocados |
| **Riesgo** | Auth, permisos, red zone, regresión visual |
| **Rollback** | Cómo revertir en ≤ 15 min si falla cutover |
| **Dependencias** | Tickets, ADR, módulos o infra bloqueantes |
| **Validación** | Plan QA con evidencia esperada |

Ticket sin clasificación de riesgo → **no implementar**.

---

## SECCIÓN 11 — GESTIÓN DEL CONOCIMIENTO

| Obligación | Dónde vive |
|------------|------------|
| Decisión importante | Ticket + ADR si es arquitectónica |
| Incidente | Lección aprendida en Arquitectura Viva §9 o Constitución Operativa §13 |
| Cambio arquitectónico | ADR con motivo, alternativas y riesgos |
| Conocimiento operativo | Memoria V2, Operación Permanente, tickets |

**El conocimiento permanece en el proyecto, no en las personas.**

Sin registro escrito, la decisión **no existe** para efectos de gobernanza.

---

## SECCIÓN 12 — PROTECCIÓN CONTRA DEUDA TÉCNICA

| Prohibición | Razón |
|-------------|-------|
| Soluciones temporales como definitivas | Se convierten en permanente sin ADR |
| Dependencias ocultas | Globals, imports cruzados, acoplamiento V1↔V2 |
| Duplicar lógica | Dos fuentes de verdad divergen |
| Duplicar navegación | Múltiples contratos = drift (lección V1) |
| Duplicar responsabilidades | Módulos imposibles de probar |
| Módulos gigantes | Repite el monolito V1 |

Deuda detectada fuera del ticket: **documentar y detenerse** — no “arreglar de paso”.

---

## SECCIÓN 13 — REGLAS PARA IA Y DESARROLLADORES

Antes de **cualquier** trabajo, lectura obligatoria en este orden:

1. **Esta Constitución** — `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`
2. **Arquitectura Viva** — `docs/V2/MiamiDJBeat-V2-ARQUITECTURA-VIVA.md`
3. **Memoria V2** — `docs/V2/MiamiDJBeat-MigracionV2-MEMORIA.md`
4. **Operación Permanente** — `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md`
5. **ADR vigentes** — tabla en Arquitectura Viva §7
6. **Tickets activos** — alcance, archivos autorizados y bloqueados

Antes de escribir código:

7. **Revisar git** — `git status` y `git diff`
8. **Declarar alcance** — archivos autorizados, bloqueados, riesgo
9. **Esperar autorización** — si el ticket no está aprobado para implementar, detenerse

Los agentes IA obedecen las mismas reglas que los humanos. Iniciativa propia fuera de alcance está **prohibida**.

---

## SECCIÓN 14 — REGLA DE ORO

> **Si una decisión mejora la velocidad pero pone en riesgo la estabilidad del producto, la decisión deberá rechazarse.**

**La estabilidad siempre tendrá prioridad sobre la velocidad.**

| Elegir | Rechazar |
|--------|----------|
| Una solución validada con evidencia | Varias implementaciones rápidas sin QA |
| Ticket acotado + rollback | Big bang en producción |
| Detenerse y pedir OK al PO | Ampliar scope en silencio |
| Rollback planificado | “Arreglamos en prod después” |

---

# DECISIÓN CONSTITUCIONAL-001

## Separación permanente entre V1 y V2

A partir de la aprobación de esta Constitución queda establecido lo siguiente:

Miami DJ Beat V1 continuará siendo el sistema oficial de producción.

MiamiDJBeat-MigracionV2 será un proyecto completamente independiente destinado exclusivamente a construir la nueva arquitectura del sistema.

Todo desarrollo estratégico nuevo deberá evaluarse primero para determinar si pertenece a V1 o a V2.

Las correcciones críticas relacionadas con producción, seguridad, errores operativos o continuidad del negocio continuarán realizándose en V1 mientras la migración no haya concluido.

Las nuevas funcionalidades, cuando exista una alternativa razonable, deberán desarrollarse directamente en V2 para evitar aumentar la deuda técnica de V1.

La migración nunca se realizará mediante una sustitución completa del sistema.

La migración será progresiva.

Cada módulo deberá cumplir el siguiente ciclo obligatorio:

1. Diseño.
2. Desarrollo.
3. Pruebas técnicas.
4. Pruebas funcionales.
5. Validación visual.
6. Aprobación del Product Owner.
7. Migración.

Solo después de completar este proceso un módulo de V2 podrá reemplazar al equivalente existente en V1.

Hasta ese momento V1 continuará siendo el sistema oficial.

## Regla Constitucional

Ningún desarrollador, IA o colaborador podrá iniciar una implementación estratégica directamente sobre V1 sin haber documentado previamente por qué dicho desarrollo no puede realizarse dentro de MiamiDJBeat-MigracionV2.

Esta evaluación deberá quedar registrada dentro del ticket correspondiente.

---

## SECCIÓN 15 — CLÁUSULA FINAL

Esta Constitución representa el **contrato permanente de desarrollo** de Miami DJ Beat.

- **Todo desarrollo futuro deberá respetarla.**
- **Solo podrá modificarse mediante una ADR aprobada por el Product Owner.**
- **Ningún documento, ticket, agente IA o desarrollador puede contradecirla.**

Ante duda entre velocidad y estabilidad, entre alcance y evidencia, entre opinión y diff: **prevalece esta Constitución** hasta que una ADR aprobada la enmiende explícitamente.

---

*Constitución del Proyecto v1.0 — 2026-07-05 — TICKET-V2-PROJECT-CONSTITUTION-001*

*Esperando aprobación del Product Owner.*

*No commit · No push · No deploy*
