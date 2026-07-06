# GLOSSARY.md

**Ticket:** TICKET-V2-ARCHITECTURE-HANDBOOK-001 · Reconciliado **PHASE-DOC-RECONCILIATION-001**  
**Tipo:** Glosario oficial MiamiDJBeat-MigracionV2

> Definiciones orientativas. En caso de conflicto, prevalece Constitución > Blueprint > spec del módulo.

---

## A

### ADR (Architecture Decision Record)

Registro formal de una decisión arquitectónica aprobada por Product Owner. Almacenadas en `docs/DECISIONS.md`. Modifican metodología o arquitectura solo tras aprobación explícita.

### Architecture Handbook

Conjunto de documentos en `docs/V2/ARCHITECTURE/` que indexan y navegan la documentación V2. **No** es un módulo MOD. **No** altera specs ni inventario.

---

## B

### Blueprint

Documento `MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md`. Plano funcional global: portales, Shared Core, backend conceptual, orden de construcción. No contiene código.

### Bootstrap

Secuencia conceptual de inicialización del cliente V2 desde Configuration hasta Portal Shell. Ver `BOOT-SEQUENCE.md`. Distinto de deploy o build pipeline.

### Brand Token

Token visual de marca (color gold, tipografía marca, etc.). Definido en `theme/TOKEN-CONTRACT.md`. Parte de la identidad dark/gold premium.

---

## C

### Capability

Permiso operativo atómico evaluado vía `hasCapability()` en runtime futuro. Fuente única: snapshot Permissions (DB), no JWT solo. Catálogo: `permissions/CAPABILITY-CATALOG.md`.

### Client Portal

Portal MOD-101+ para compradores. Subtipos recuperables: **Regular Client**, **VIP Client**, **Commercial Client** — ver `PROFILE-TAXONOMY.md` §1.

### Components Library

MOD-009. Biblioteca de UI reutilizable (botones, modales, inputs). Consume Design System y tokens Theme. **DOCUMENTACIÓN COMPLETA** · `components/COMPONENTS-SPEC.md` · Implementación **PENDIENTE**.

### Contract

Acuerdo escrito de inputs, outputs, estados, errores y límites entre módulos. Transversal: `CONTRACTS.md`. Especializados: `*-CONTRACT.md`.

### Commercial Client

Subtipo Client Portal (`client.commercial`): comprador que contrata vía entidad comercial (club, venue, corporación). Ver `PROFILE-TAXONOMY.md`.

---

## D

### Design System

MOD-008. Tipografía, spacing, primitivas visuales base. Consume tokens Theme. **DOCUMENTACIÓN COMPLETA** · `design-system/DESIGN-SYSTEM-SPEC.md` · Implementación **PENDIENTE**.

### Documentation First

Metodología DECISION-V2-002: spec + contratos + PO antes de implementación runtime.

---

## E

### Event Bus

MOD-004. Infraestructura publish/subscribe tipada para Shared Core y portales. Envelope estándar en `EVENT-BUS-SPEC.md`.

---

## F

### Feature Flag

MOD-013. Toggle de funcionalidad por env o runtime. **DOCUMENTACIÓN COMPLETA** · `feature-flags/FEATURE-FLAGS-SPEC.md` · `CONTRACTS.md` §8 · Implementación **PENDIENTE**.

---

## I

### Internationalization (i18n)

MOD-015. Resolución y entrega de Translation Keys. EN canónico, ES primer soporte. **No** decide locale solo — Session/Config orchestrate.

---

## L

### Lifecycle

Conjunto de estados discretos y transiciones de un módulo (ej. `THEME_READY`, `SESSION_AUTHENTICATED`). Documentado en `*-LIFECYCLE.md`.

---

## M

### Module (MOD)

Unidad catalogada con ID `MOD-xxx`. Shared Core: MOD-001–016. Portales y servicios: MOD-101+. Fuente: Module Catalog.

### Module Catalog

`MiamiDJBeat-V2-MODULE-CATALOG.md`. Inventario oficial de 73 módulos. **Fuente única de IDs.**

---

## O

### Operations Core

Principio Blueprint: una orden nace una vez en Supabase; cada portal consume proyección según rol. No copias divergentes.

### Orders Core

Dominio de órdenes/contratos comerciales en backend. Referenciado en Blueprint; specs de servicio pendientes.

---

## P

### Performer Profile

Plantilla recuperable Artist Portal (`dj_profiles`, MDJB **A**). Subtipos por **Artist Category** — ver `PROFILE-TAXONOMY.md` §3. Distinto de tier comercial LITE/PRO/ELITE.

### Portal

Superficie de producto independiente: **Client**, **Artist** o **Staff**. Cada uno con shell propio (MOD-101, MOD-201, MOD-301).

### Portal Shell

Layout, navegación y gates de un portal. Emite `PORTAL_READY` cuando surface lista. Depende de Session + Theme + i18n.

### Profile Taxonomy

Taxonomía oficial de subtipos recuperables por portal. Canónico: `docs/V2/PROFILE-TAXONOMY.md` (TICKET-V2-PROFILE-TAXONOMY-001). Prerrequisito MOD-003.

### Provider

Proveedor externo de identidad (futuro Supabase Auth). Contrato: `auth/AUTH-PROVIDER-CONTRACT.md`.

---

## R

### Regular Client

Subtipo Client Portal por defecto (`client.regular`): comprador estándar sin VIP ni entidad comercial. Ver `PROFILE-TAXONOMY.md`.

### Responsive Engine

MOD-016. Breakpoints, contrato nav mobile, layout helpers. **DOCUMENTACIÓN COMPLETA** · `responsive/RESPONSIVE-SPEC.md` · Implementación **PENDIENTE**. Coordina con MOD-008 vía Event Bus — no import directo.

---

## S

### Semantic Token

Token con significado funcional (ej. `color.text.primary`, `surface.glass`). Mapea a brand tokens. Ver `TOKEN-CONTRACT.md`.

### Session Snapshot

Vista inmutable del estado de sesión para consumidores: user, portal, capabilities ref. MOD-002. No mutar directamente.

### Shared Core

Núcleo transversal MOD-001–016 en `MiamiDJBeat-MigracionV2/shared/`. Común a los tres portales. Nunca importa desde portales.

### Shell

Ver **Portal Shell**.

### Snapshot (Permissions)

Resultado de RPC/`mdj_access_snapshot` conceptual: rol efectivo, capabilities, mdjb_id. MOD-003 authority.

---

## T

### Theme Manager

MOD-007. Define, resuelve y distribuye tokens visuales. No CSS final, no componentes, no UI, no i18n, no permisos.

### Theme Token

Valor atómico del sistema visual (color, radius, shadow, motion, etc.). Fuente única visual — ver `TOKEN-CONTRACT.md`.

### Translation Key

Identificador de cadena i18n (ej. `error.auth.login_failed`). **Prohibido** hardcoded UI copy en Shared Core. Ver `TRANSLATION-CONTRACT.md`.

---

## V

### V1

Producción actual (`web/`). Intacta durante lab V2. No modificada por tickets documentales V2.

### V2 / MigracionV2

Laboratorio aislado `MiamiDJBeat-MigracionV2/`. Documentación y scaffold. Sin cutover hasta PO.

### VIP Client

Subtipo Client Portal (`client.vip`): cliente recurrente con historial de múltiples rentas/contrataciones; crown + label VIP. Ver `PROFILE-TAXONOMY.md`.

---

*GLOSSARY v2.0 — PHASE-DOC-RECONCILIATION-001 — 2026-07-05*
