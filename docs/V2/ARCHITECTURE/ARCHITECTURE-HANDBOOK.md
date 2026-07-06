# MiamiDJBeat V2 Architecture Handbook

**Ticket:** TICKET-V2-ARCHITECTURE-HANDBOOK-001  
**Proyecto:** MiamiDJBeat-MigracionV2  
**Tipo:** Meta-documentación transversal — **no es un módulo MOD**  
**Estado:** DOCUMENTACIÓN COMPLETA · Implementación: PENDIENTE  
**Última actualización:** 2026-07-05 · Reconciliado **PHASE-DOC-RECONCILIATION-001**

> **Regla de uso:** Este Handbook **no reemplaza** las fuentes oficiales. Es la **puerta de entrada** y el mapa de navegación. El contenido autoritativo permanece en cada spec, contrato y documento de gobernanza referenciado.

---

## Introducción

MiamiDJBeat-MigracionV2 es el laboratorio arquitectónico aislado de la plataforma en producción (V1). Este Handbook orienta a arquitectos, desarrolladores y Product Owner hacia la documentación correcta **sin recorrer decenas de archivos en orden aleatorio**.

**Alcance del Handbook:** índices, mapas, glosario y guía de navegación.  
**Fuera de alcance:** specs de módulo, Blueprint funcional, implementación runtime, código.

---

## Objetivos

| Objetivo | Cómo se cumple |
|----------|----------------|
| **Orientación rápida** | Punto único de entrada en `docs/V2/ARCHITECTURE/` |
| **Trazabilidad** | Enlaces a documentos oficiales, no copias |
| **Coherencia** | Refleja inventario MOD-001–016 sin alterarlo |
| **Preparación Runtime** | Boot sequence y dependency map conceptuales antes de código |
| **Gobernanza** | Jerarquía documental explícita |

---

## Principios arquitectónicos

Principios vigentes documentados en specs y Blueprint. Detalle en fuente oficial — aquí solo resumen orientativo.

### Documentation First

Metodología aprobada **DECISION-V2-002**. Ningún módulo se implementa sin Blueprint alineado, contratos, spec de módulo y gate PO.  
→ `docs/DECISIONS.md` · `docs/V2/SHARED-CORE-PROGRESS.md`

### Capability First

Permisos operativos vía **capabilities** (`hasCapability()`), no checks de rol en UI. Snapshot desde DB — no JWT solo.  
→ `MiamiDJBeat-MigracionV2/shared/permissions/PERMISSIONS-SPEC.md`

### Event Driven

Ciclo de vida y surfaces listas vía Event Bus tipado (`PORTAL_READY`, `SESSION_READY`, etc.).  
→ `MiamiDJBeat-MigracionV2/shared/events/EVENT-BUS-SPEC.md`

### Session Snapshot

Estado de sesión inmutable para consumidores; re-fetch capabilities en restore.  
→ `MiamiDJBeat-MigracionV2/shared/session/SESSION-SPEC.md`

### Single API Client

Único egress HTTP/Edge; HTTP ≠ 200 nunca asume shape de éxito.  
→ `MiamiDJBeat-MigracionV2/shared/api/API-CLIENT-SPEC.md`

### Storage Rules

Namespaces `mdj_v2_*`; sin secretos, permisos ni PII innecesaria.  
→ `MiamiDJBeat-MigracionV2/shared/storage/STORAGE-SPEC.md`

### Error Normalization

Catálogo global ERR-xxxx; módulos emiten errores locales normalizados hacia Error Handler.  
→ `MiamiDJBeat-MigracionV2/shared/errors/ERROR-HANDLING-SPEC.md`

### Dark / Gold Design Philosophy

Identidad base: dark · gold · premium · glass · alto contraste · desktop/mobile. Theme define **tokens**, no CSS final ni componentes.  
→ `MiamiDJBeat-MigracionV2/shared/theme/THEME-SPEC.md`

---

## Roadmap arquitectónico

### Niveles del Shared Core

| Nivel | Módulos | Estado documental (2026-07-05) |
|-------|---------|----------------------------------|
| **Nivel 0 — Base** | MOD-001–006, MOD-010–012, MOD-014 | ✅ **10/10 · 100%** |
| **Nivel 1 — Infraestructura** | MOD-015 i18n · MOD-007 Theme · MOD-013 Feature Flags | ✅ **3/3 · 100%** |
| **Nivel 2 — UI Foundation** | MOD-008 Design System · MOD-009 Components · MOD-016 Responsive | ✅ **3/3 · 100%** |

**Shared Core documentación:** **16/16 · 100%** · Tickets spec **001–018** · Runtime **0%**.

### Fuentes oficiales únicas (post-reconciliación)

| Tema | Documento autoritativo |
|------|------------------------|
| **Boot order** | `ARCHITECTURE/BOOT-SEQUENCE.md` |
| **Event catalog** | `shared/events/EVENT-BUS-SPEC.md` |
| **Inter-module contracts** | `shared/CONTRACTS.md` (+ specs módulo) |
| **Dependencies** | `ARCHITECTURE/DEPENDENCY-MAP.md` |
| **Module inventory** | `ARCHITECTURE/MODULE-INDEX.md` · Module Catalog |
| **Progress** | `docs/V2/SHARED-CORE-PROGRESS.md` |

→ Tablero vivo: `docs/V2/SHARED-CORE-PROGRESS.md`  
→ Inventario completo: `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md`

### Fase Runtime

**Estado:** PENDIENTE — 0 módulos implementados.  
Gate: spec completa + aprobación PO por ticket (DECISION-V2-002).

### Fase Portales

**Estado:** PLANIFICADO — MOD-101+ en Module Catalog.  
Dependen de Shared Core base + shell contracts (Blueprint Sección 3–5).

---

## Relación entre documentos maestros

```
                    CONSTITUCIÓN
                 (máxima autoridad)
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
  Operación         Arquitectura      DECISIONS
  Permanente           Viva          (ADR index)
         │               │               │
         └───────────────┼───────────────┘
                         ▼
                  SYSTEM BLUEPRINT
              (mapa funcional global)
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   MODULE CATALOG    CONTRACTS.md    ARCHITECTURE
   (73 módulos)     (transversal)     HANDBOOK ← usted está aquí
                         │
                         ▼
                  shared/{module}/
                  (specs por MOD)
```

| Documento | Rol | Ruta |
|-----------|-----|------|
| **Constitution** | Misión, reglas V1/V2, jerarquía | `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` |
| **Operation Guide** | Constitución operativa diaria | `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` |
| **Arquitectura Viva** | Estado evolutivo del diseño | `docs/V2/MiamiDJBeat-V2-ARQUITECTURA-VIVA.md` |
| **Blueprint** | Plano funcional global | `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` |
| **Module Catalog** | Inventario oficial MOD-xxx | `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` |
| **Shared Core** | Specs técnicas MOD-001–016 | `MiamiDJBeat-MigracionV2/shared/` |
| **CONTRACTS** | Contratos inter-módulo | `MiamiDJBeat-MigracionV2/shared/CONTRACTS.md` |
| **Decisions** | ADR registradas | `docs/DECISIONS.md` |
| **Session Summaries** | Bitácora por jornada | `docs/V2/SESSION-SUMMARIES/` |
| **Shared Core Progress** | Tablero % documental | `docs/V2/SHARED-CORE-PROGRESS.md` |
| **Nota Diaria Lab** | Log operativo lab V2 | `docs/V2/NOTA-DIARIA-LAB-001.md` |

---

## Cómo navegar toda la documentación

### Si necesitas…

| Necesidad | Ir primero a |
|-----------|--------------|
| Entender el producto completo | `MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` |
| Saber qué módulos existen | `MiamiDJBeat-V2-MODULE-CATALOG.md` o `ARCHITECTURE/MODULE-INDEX.md` |
| Ver progreso documental | `SHARED-CORE-PROGRESS.md` |
| Contrato entre dos módulos | `shared/CONTRACTS.md` o `ARCHITECTURE/CONTRACT-INDEX.md` |
| Eventos de un módulo | `ARCHITECTURE/EVENT-MAP.md` → spec origen |
| Errores de un módulo | `ARCHITECTURE/ERROR-MAP.md` → spec origen |
| Orden de boot | `ARCHITECTURE/BOOT-SEQUENCE.md` |
| Dependencias permitidas | `ARCHITECTURE/DEPENDENCY-MAP.md` |
| Reglas de trabajo diario | `NOTA-DIARIA-OPERACION-PERMANENTE.md` |
| Definición de un término | `ARCHITECTURE/GLOSSARY.md` |
| Decisión metodológica | `ARCHITECTURE/DECISION-INDEX.md` |

### Lectura recomendada — onboarding arquitecto

1. `MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`
2. `NOTA-DIARIA-OPERACION-PERMANENTE.md`
3. `MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md`
4. Este Handbook → `MODULE-INDEX.md` → spec del módulo objetivo
5. `shared/CONTRACTS.md` sección del módulo

---

## Documentos del Handbook

| Archivo | Propósito |
|---------|-----------|
| **ARCHITECTURE-HANDBOOK.md** | Este documento — entrada y principios |
| **MODULE-INDEX.md** | Tabla MOD-001–016 |
| **BOOT-SEQUENCE.md** | Orden conceptual de inicialización |
| **DEPENDENCY-MAP.md** | Dependencias permitidas/prohibidas |
| **EVENT-MAP.md** | Índice de eventos por módulo |
| **ERROR-MAP.md** | Índice de errores por módulo |
| **CONTRACT-INDEX.md** | Índice maestro de contratos |
| **DECISION-INDEX.md** | Constitución + ADR + plantilla futura |
| **GLOSSARY.md** | Glosario oficial |

---

## Reglas del Handbook

| Regla | Detalle |
|-------|---------|
| **No duplicar** | Enlazar; no copiar payloads, catálogos ni matrices completas |
| **No alterar inventario** | MOD-001–016 permanecen definidos en Module Catalog |
| **No alterar % documental** | Este ticket no modifica Shared Core Progress |
| **No alterar Blueprint** | Plano funcional intacto |
| **Actualización** | Solo vía ticket PO cuando cambien fuentes oficiales |

---

*Architecture Handbook v2.0 — PHASE-DOC-RECONCILIATION-001 — 2026-07-05*
