# MIAMI DJ BEAT

# MODULE CATALOG

## CATÁLOGO OFICIAL DE MÓDULOS

**Versión:** 1.2  
**Ticket:** TICKET-V2-MODULE-CATALOG-001 · TICKET-V2-DOC-CONSOLIDATION-001  
**Proyecto:** MiamiDJBeat-MigracionV2  
**Referencia:** `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md`  
**Estado:** Inventario oficial — estados documental, runtime y validación separados

---

## SECCIÓN 1 — OBJETIVO

Este documento contiene el **inventario oficial de todos los módulos** del sistema MiamiDJBeat-MigracionV2.

| Regla | Significado |
|-------|-------------|
| **Fuente única** | Todo desarrollo futuro referencia este catálogo |
| **Registro obligatorio** | Ningún módulo se desarrolla si no está aquí |
| **Solo documentación** | Este ticket no implementa código |

Cada módulo tendrá: ID, nombre, descripción, prioridad, **estado documental**, **estado runtime**, **validación**, dependencias y portal propietario.

---

## SECCIÓN 2 — ESTADOS OFICIALES

### Dimensiones de estado (normalizado TICKET-V2-DOC-CONSOLIDATION-001)

Cada módulo registra **tres dimensiones independientes**. No mezclar en una sola columna.

| Dimensión | Valores oficiales | Significado |
|-----------|-------------------|-------------|
| **Estado documental** | PENDIENTE · DOCUMENTACIÓN PARCIAL · DOCUMENTADO | Avance de la spec en `shared/{módulo}/` o equivalente |
| **Estado runtime** | PENDIENTE · IMPLEMENTADO · OPERATIVO EN BOOT · BLOQUEADO · NO APLICA | Presencia y madurez de implementación en lab V2 |
| **Validación** | PENDIENTE · VALIDADO EN LOCALHOST · APROBADO PO · NO APLICA | Gate técnico/funcional y aprobación Product Owner |

**Reglas semánticas:**

- `VALIDADO EN LOCALHOST` pertenece **solo** a **Validación**, nunca a Estado runtime.
- Participar en el boot (`OPERATIVO EN BOOT`) **no** implica validación PO del módulo.
- `VALIDADO EN LOCALHOST` ≠ aprobado para cutover producción. V1 permanece producción.

**Convención visual en tablas:** ✅ = valor confirmado · ⏳ = pendiente · ⚙️ = operativo parcial en boot.

### Ciclo de vida del módulo (transiciones)

| Estado | Significado |
|--------|-------------|
| **PLANIFICADO** | Identificado en catálogo; sin spec técnica completa |
| **DOCUMENTACIÓN COMPLETA** | Spec técnica en `shared/{módulo}/` — implementación pendiente |
| **DISEÑADO** | *(Legacy — usar DOCUMENTACIÓN COMPLETA para Shared Core spec)* |
| **EN DESARROLLO** | Implementación activa en lab V2 |
| **QA INTERNO** | QA técnico + funcional en curso |
| **QA PRODUCT OWNER** | Validación visual y de producto pendiente o en curso |
| **APROBADO** | Listo para cutover o uso en integración |
| **CONGELADO** | Sin cambios salvo ticket crítico |
| **MIGRADO** | Reemplazó equivalente V1 en producción |
| **RETIRADO** | Obsoleto; archivado en `archive/` |

Transiciones no saltan estados sin ticket y evidencia.

---

## SECCIÓN 3 — PRIORIDADES

| Prioridad | Significado |
|-----------|-------------|
| **P0** | Bloqueante — sin esto no hay portal ni Core mínimo |
| **P1** | Alta — primer cutover o experiencia core del portal |
| **P2** | Media — valor producto; post-MVP del portal |
| **P3** | Baja — mejora, analytics, nice-to-have |

---

## SECCIÓN 4 — SHARED CORE

Tabla **única y autoritativa** — cada módulo aparece **una sola vez**.

| ID | Módulo | Descripción | Prioridad | Estado documental | Estado runtime | Validación | Dependencias | Portal propietario | Ticket spec | Carpeta spec |
|----|--------|-------------|-----------|-------------------|----------------|------------|--------------|-------------------|-------------|--------------|
| MOD-001 | Authentication | Sign-in, sign-out, provider Supabase, gates | P0 | ✅ DOCUMENTADO | ✅ IMPLEMENTADO / OPERATIVO EN BOOT (mock wiring) | ✅ VALIDADO EN LOCALHOST — Fase 5 (técnico; sin PO visual) | MOD-006, MOD-004 · Supabase futuro | SHARED / TRANSVERSAL | 012 | `shared/auth/` |
| MOD-002 | Session Manager | Hydrate, INITIAL_SESSION vs SIGNED_IN, estado sesión | P0 | ✅ DOCUMENTADO | ✅ IMPLEMENTADO / OPERATIVO | ✅ VALIDADO EN LOCALHOST — APROBADO PO (Fase 3) | MOD-001 | SHARED / TRANSVERSAL | 005 | `shared/session/` |
| MOD-003 | Permissions | Snapshot acceso, guards, matriz roles buyer/performer/staff | P0 | ✅ DOCUMENTADO | ⚙️ OPERATIVO EN BOOT | ⏳ PENDIENTE | MOD-001, MOD-002, RPC snapshot | SHARED / TRANSVERSAL | 004 | `shared/permissions/` |
| MOD-004 | Event Bus | Contratos emit/listen tipados; catch-up; once | P0 | ✅ DOCUMENTADO | ✅ IMPLEMENTADO / OPERATIVO | ✅ VALIDADO EN LOCALHOST — APROBADO PO (Fase 2) | MOD-002 | SHARED / TRANSVERSAL | 003 | `shared/events/` |
| MOD-005 | API Client | Wrapper Supabase + Edge; errores HTTP → body | P0 | ✅ DOCUMENTADO | ✅ IMPLEMENTADO / OPERATIVO | ✅ VALIDADO EN LOCALHOST — APROBADO PO (Fase 4) | MOD-006 | SHARED / TRANSVERSAL | 010 | `shared/api/` |
| MOD-006 | Configuration | Env, constants, portal ids, deploy root URLs | P0 | ✅ DOCUMENTADO | ⚙️ OPERATIVO EN BOOT | ⏳ PENDIENTE | — | SHARED / TRANSVERSAL | 006 | `shared/config/` |
| MOD-007 | Theme Manager | Tokens dark/gold, variables, THEME_CHANGED | P0 | ✅ DOCUMENTADO | ✅ IMPLEMENTADO / OPERATIVO | ✅ VALIDADO EN LOCALHOST — APROBADO PO (Fase 2) | MOD-006 | SHARED / TRANSVERSAL | 014 | `shared/theme/` |
| MOD-008 | Design System | Tipografía, spacing, primitivas visuales base | P0 | ✅ DOCUMENTADO | ⏳ PENDIENTE | ⏳ PENDIENTE | MOD-007 | SHARED / TRANSVERSAL | 016 | `shared/design-system/` |
| MOD-009 | Components Library | Botones, modales, tablas, inputs reutilizables | P1 | ✅ DOCUMENTADO | ⏳ PENDIENTE | ⏳ PENDIENTE | MOD-008 | SHARED / TRANSVERSAL | 017 | `shared/components/` |
| MOD-010 | Logging | Logs estructurados cliente; niveles; sin PII cruda | P1 | ✅ DOCUMENTADO | ⚙️ OPERATIVO EN BOOT | ⏳ PENDIENTE | MOD-006 | SHARED / TRANSVERSAL | 007 | `shared/logging/` |
| MOD-011 | Notifications | Toast, inbox hook, NOTIFICATION_CREATED | P1 | ✅ DOCUMENTADO | ⏳ PENDIENTE | ⏳ PENDIENTE | MOD-004, MOD-005 | SHARED / TRANSVERSAL | 009 | `shared/notifications/` |
| MOD-012 | Storage | Almacenamiento local client; namespaces `mdj_v2_*` | P1 | ✅ DOCUMENTADO | ⏳ PENDIENTE | ⏳ PENDIENTE | MOD-005 | SHARED / TRANSVERSAL | 011 | `shared/storage/` |
| MOD-013 | Feature Flags | Toggles cutover y módulos; env + runtime | P1 | ✅ DOCUMENTADO | ⏳ PENDIENTE | ⏳ PENDIENTE | MOD-006 | SHARED / TRANSVERSAL | 015 | `shared/feature-flags/` |
| MOD-014 | Error Handler | Surface error/detail; fallbacks UX | P0 | ✅ DOCUMENTADO | ⚙️ OPERATIVO EN BOOT | ✅ VALIDADO EN LOCALHOST — Fase 5 auth normalize (técnico) | MOD-010 | SHARED / TRANSVERSAL | 008 | `shared/errors/` |
| MOD-015 | Internationalization | EN canónico, ES fallback, LANGUAGE_CHANGED | P0 | ✅ DOCUMENTADO | ⏳ PENDIENTE | ⏳ PENDIENTE | MOD-006 | SHARED / TRANSVERSAL | 013 | `shared/i18n/` |
| MOD-016 | Responsive Engine | Breakpoints, nav mobile contract, layout helpers | P1 | ✅ DOCUMENTADO | ⏳ PENDIENTE | ⏳ PENDIENTE | MOD-008 | SHARED / TRANSVERSAL | 018 | `shared/responsive/` |

**Ubicación:** `MiamiDJBeat-MigracionV2/shared/`

**Inventario Shared Core:** 16 módulos · **16 documentados** (2026-07-05 · tickets 003–018) · **0 pendientes de spec**.

> **Fuente única de IDs:** este catálogo. `CONTRACTS.md` (ticket 002) es artefacto transversal — **no** cuenta como módulo.

Documentos transversales: `shared/CONTRACTS.md` (ticket 002).

---

## SECCIÓN 4B — ANEXO FASE 2 (BOOTSTRAP RUNTIME P0)

**Tickets:** TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 · TICKET-V2-END-OF-PHASE-002-001  
**Fecha:** 2026-07-10 · **Entorno:** `http://localhost:5173` (lab V2)

Los estados runtime y validación de módulos Shared Core están en **Sección 4** (tabla única). Este anexo registra solo evidencia transversal de Fase 2 — **sin duplicar filas de módulo**.

### Runtime Bootstrap P0 (capa transversal — no es MOD del inventario)

| Área | Estado runtime | Validación | Evidencia |
|------|----------------|------------|-----------|
| Bootstrap + Runtime Registry | ✅ IMPLEMENTADO / OPERATIVO | ✅ VALIDADO EN LOCALHOST — APROBADO PO (Fase 2) | `SYSTEM_READY` × 1 · registry · lifecycle · 3 portales |

### Portales shell validados

| Portal | URL | Validación |
|--------|-----|------------|
| Client | `http://localhost:5173/client/` | ✅ APROBADO PO |
| Artist | `http://localhost:5173/artist/` | ✅ APROBADO PO |
| Staff | `http://localhost:5173/staff/` | ✅ APROBADO PO |

### Evidencia técnica Fase 2 (referencia)

| Módulo | Evidencia localhost |
|--------|---------------------|
| MOD-004 Event Bus | `BUS_READY` · bus in-memory · 16 tests unit |
| MOD-007 Theme Manager | `THEME_READY` post-`SYSTEM_READY` · 12 tests theme |

---

## SECCIÓN 4C — ANEXO FASE 5 (MOD-001 AUTH FOUNDATION)

**Tickets:** TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 · TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-DOCS-001
**Fecha:** 2026-07-10 · **Entorno:** `http://localhost:5173` (lab V2)
**Commit técnico local:** `ded41b6d342dce21e054285cc59ecebb357171e4` — `feat(v2-auth): add MOD-001 authentication foundation`

### Foundation runtime — COMPLETADA LOCALMENTE

| Componente | Estado |
|------------|--------|
| MockAuthProvider | ✅ COMPLETADO — offline, determinístico |
| Máquina de estados (12) | ✅ COMPLETADA — 25 transiciones |
| AuthService | ✅ COMPLETADO |
| AuthPort / SessionHandoffPort | ✅ COMPLETADOS |
| Integración mock Auth → Session | ✅ VALIDADA — Event Bus `USER_LOGIN` |
| Tests MOD-001 | ✅ 13 nuevos (9 + 4) |
| Suite global | ✅ 394/394 PASS |
| Validación técnica | ✅ COMPLETADA |
| Validación visual PO | ⏳ NO APLICA — sin UI (foundation) |

### Explícitamente NO completado (foundation)

Supabase Auth real · MOD-012 Storage · `auth_ref` persistente · UI login · OAuth · refresh real de proveedor · producción · publicación remota.

**Documentación:** `docs/V2/SESSION-SUMMARIES/2026-07-10-MOD-001-AUTH-FOUNDATION.md` · `docs/V2/TICKETS/TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001.md`

---

## SECCIÓN 4E — ANEXO FASE 5 (MOD-001 AUTH BOOTSTRAP WIRING)

**Tickets:** TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-001 · TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-DOCS-001
**Fecha:** 2026-07-10 · **Entorno:** `http://localhost:5173` (lab V2)
**Commit técnico local:** `0866d19575dd63c5127a958f2cecacee293cf626` — `feat(v2-auth): wire authentication into bootstrap`
**HEAD previo:** `7a0c9e821ee07f90f3df656e69495f51d445a04f`

### Bootstrap wiring — COMPLETADO LOCALMENTE

| Componente | Estado |
|------------|--------|
| `bootstrap/initialize-auth.ts` | ✅ CREADO |
| `registerAuthForBoot()` / `activateAuthForBoot()` | ✅ OPERATIVO |
| Handoff Event Bus único (`USER_LOGIN`) | ✅ VALIDADO |
| `SessionHandoffPort` | ❌ AUSENTE (por diseño) |
| `bootScaffold()` síncrono | ✅ PRESERVADO |
| Degradación guest | ✅ DOCUMENTADA |
| Tests wiring | ✅ 12 nuevos |
| Suite global | ✅ 422/422 PASS |
| Test files | ✅ 42/42 PASS |
| Runtime Registry MOD-001 | ⏳ PENDIENTE |
| Validación visual PO | ⏳ NO APLICA |

### Cadena boot actualizada

```
Config → Bus → Logging → Error → registerAuthForBoot → Session → activateAuthForBoot → Runtime → SYSTEM_READY → Theme
```

### Explícitamente NO completado

Supabase Auth · MOD-012 Storage · Registry MOD-001 · MOD-001↔MOD-014 wiring · UI login · boot async · producción · publicación remota.

**Documentación:** `docs/V2/SESSION-SUMMARIES/2026-07-10-MOD-001-AUTH-BOOTSTRAP-WIRING.md` · `docs/V2/TICKETS/TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-001.md`

---

## SECCIÓN 4D — ANEXO FASE 5 (MOD-014 AUTH ERROR NORMALIZATION)

**Tickets:** TICKET-V2-PHASE-5-MOD-014-AUTH-ERROR-NORMALIZATION-001 · TICKET-V2-PHASE-5-MOD-014-AUTH-ERROR-NORMALIZATION-DOCS-001
**Fecha:** 2026-07-10 · **Entorno:** `http://localhost:5173` (lab V2)
**Commit técnico local:** `67843074f13aac44f22d19bcc6858e84287284e4` — `feat(v2-errors): add auth error normalization`

### Auth error normalization — COMPLETADA LOCALMENTE

| Componente | Estado |
|------------|--------|
| `normalizeAuthError()` | ✅ IMPLEMENTADO |
| Mapping ERR-AUTH-001…010 | ✅ COMPLETO |
| Catálogo runtime ERR-0100…0109 | ✅ COMPLETO |
| Redacción ampliada (`redact.ts`) | ✅ COMPLETADA |
| Tests MOD-014 auth normalize | ✅ 16 nuevos |
| Suite global | ✅ 410/410 PASS |
| Test files | ✅ 41/41 PASS |
| Validación técnica | ✅ COMPLETADA |
| Validación visual PO | ⏳ NO APLICA — sin UI ni wiring |

### Explícitamente NO completado

MOD-001 ↔ MOD-014 wiring · `normalizeApiError()` · Supabase provider mapping · UI de errores · producción · publicación remota.

**Documentación:** `docs/V2/SESSION-SUMMARIES/2026-07-10-MOD-014-AUTH-ERROR-NORMALIZATION.md` · `docs/V2/TICKETS/TICKET-V2-PHASE-5-MOD-014-AUTH-ERROR-NORMALIZATION-001.md` · `docs/V2/GOVERNANCE/INCIDENT-V2-POST-COMMIT-WORKTREE-CONTAMINATION-001.md`

---

## SECCIÓN 5 — PORTAL CLIENTE

| ID | Nombre | Descripción | Prioridad | Estado | Dependencias |
|----|--------|-------------|-----------|--------|--------------|
| MOD-101 | Client Shell | Layout buyer, nav cliente, CLIENT_SHELL_READY | P0 | PLANIFICADO | MOD-001–004, MOD-015 |
| MOD-102 | Client Dashboard | Home cuenta, resumen actividad | P1 | PLANIFICADO | MOD-101, MOD-003 |
| MOD-103 | Profile | Perfil comprador, preferencias, MDJB-C | P1 | PLANIFICADO | MOD-101, MOD-005 |
| MOD-104 | Orders | Historial y detalle órdenes propias | P1 | PLANIFICADO | MOD-101, MOD-005, Orders svc |
| MOD-105 | Invoices | Facturas/recibos visibles al cliente | P2 | PLANIFICADO | MOD-104, MOD-005 |
| MOD-106 | Payments | Métodos pago, estado transacciones buyer | P1 | PLANIFICADO | MOD-101, MOD-005, Edge |
| MOD-107 | Subscriptions | Planes buyer si aplican (≠ artist PRO) | P3 | PLANIFICADO | MOD-106 |
| MOD-108 | Shop Buyer | Catálogo, carrito, checkout | P1 | PLANIFICADO | MOD-101, MOD-106 |
| MOD-109 | Bookings | Reservas y eventos contratados | P1 | PLANIFICADO | MOD-101, MOD-104 |
| MOD-110 | Messages | Mensajes cliente ↔ marca | P2 | PLANIFICADO | MOD-101, MOD-011 |
| MOD-111 | Client Notifications | Centro alertas comprador | P2 | PLANIFICADO | MOD-101, MOD-011 |
| MOD-112 | VIP Loyalty | Crown, label VIP, cupones lealtad | P2 | PLANIFICADO | MOD-103, MOD-005 |
| MOD-113 | Client Calendar | Vista fechas eventos contratados | P2 | PLANIFICADO | MOD-109 |
| MOD-114 | Documents | Contratos/docs visibles al cliente | P2 | PLANIFICADO | MOD-104, MOD-012 |

**Ubicación futura:** `MiamiDJBeat-MigracionV2/client/`  
**Propietario:** Portal Cliente · **Nunca:** owner strip, staff admin, SFT artista

---

## SECCIÓN 6 — PORTAL ARTISTA

| ID | Nombre | Descripción | Prioridad | Estado | Dependencias |
|----|--------|-------------|-----------|--------|--------------|
| MOD-201 | Artist Shell | Layout performer, slot nav | P0 | PLANIFICADO | MOD-001–004, MOD-015 |
| MOD-202 | Artist Navigation | 10 pilares; ARTIST_NAV_READY | P0 | PLANIFICADO | MOD-201, MOD-004 |
| MOD-203 | Artist Dashboard | Home operativo artista | P1 | PLANIFICADO | MOD-201, MOD-003 |
| MOD-204 | Profile | Perfil público + owner view | P1 | PLANIFICADO | MOD-201, MOD-005 |
| MOD-205 | Jobs | Oportunidades roster, aplicación | P1 | PLANIFICADO | MOD-201, MOD-005 |
| MOD-206 | Availability | Disponibilidad / bloques agenda | P1 | PLANIFICADO | MOD-207 |
| MOD-207 | Calendar | Agenda eventos confirmados | P1 | PLANIFICADO | MOD-203, MOD-005 |
| MOD-208 | Song For Tips | Consola SFT; gate PRO | P1 | PLANIFICADO | MOD-204, MOD-003, Edge |
| MOD-209 | Cash Flow | Panel económico artista | P1 | PLANIFICADO | MOD-203, MOD-005 |
| MOD-210 | Academy | Academia artista, cursos | P2 | PLANIFICADO | MOD-201, MOD-005 |
| MOD-211 | DJ Tools | Hub herramientas profesionales | P2 | PLANIFICADO | MOD-201 |
| MOD-212 | Analytics | Métricas perfil/actividad | P3 | PLANIFICADO | MOD-204, MOD-005 |
| MOD-213 | Portfolio | Galería promocional | P2 | PLANIFICADO | MOD-204, MOD-012 |
| MOD-214 | Reviews | Reseñas / social proof | P3 | PLANIFICADO | MOD-204 |
| MOD-215 | Media | Gestión media perfil | P2 | PLANIFICADO | MOD-204, MOD-012 |
| MOD-216 | Artist Settings | Config artista (≠ staff) | P1 | PLANIFICADO | MOD-201, MOD-103 equiv |

**Ubicación futura:** `MiamiDJBeat-MigracionV2/artist/`  
**Propietario:** Portal Artista · **Nunca:** CRM staff, invoices internas como home

---

## SECCIÓN 7 — PORTAL STAFF

| ID | Nombre | Descripción | Prioridad | Estado | Dependencias |
|----|--------|-------------|-----------|--------|--------------|
| MOD-301 | Staff Shell | Auth gate, layout staff, STAFF_SHELL_READY | P0 | PLANIFICADO | MOD-001–004, MOD-003 |
| MOD-302 | Staff Dashboard | Home operaciones | P1 | PLANIFICADO | MOD-301 |
| MOD-303 | CRM | Relación comercial interna | P1 | PLANIFICADO | MOD-301, MOD-005 |
| MOD-304 | Orders Ops | Gestión órdenes (Operations Core write) | P0 | PLANIFICADO | MOD-301, MOD-005 |
| MOD-305 | Production | Coordinación eventos producción | P1 | PLANIFICADO | MOD-304, MOD-308 |
| MOD-306 | Invoices | Facturación staff | P1 | PLANIFICADO | MOD-301, MOD-003 management |
| MOD-307 | Matching | Asignación talento a eventos | P1 | PLANIFICADO | MOD-304, MOD-310 |
| MOD-308 | Events Ops | Gestión eventos interna | P1 | PLANIFICADO | MOD-304 |
| MOD-309 | Payments | Cobros, pagos, reconciliación | P1 | PLANIFICADO | MOD-306, MOD-003 management |
| MOD-310 | Customers | Vista staff clientes | P1 | PLANIFICADO | MOD-303 |
| MOD-311 | Artists Roster | Vista staff roster DJs | P1 | PLANIFICADO | MOD-307 |
| MOD-312 | Leads | Pipeline comercial | P1 | PLANIFICADO | MOD-303 |
| MOD-313 | Reports | Reportes gerenciales | P2 | PLANIFICADO | MOD-302, MOD-005 |
| MOD-314 | Users | Gestión usuarios staff | P2 | PLANIFICADO | MOD-301, MOD-003 management |
| MOD-315 | Roles | Matriz roles / permisos UI | P2 | PLANIFICADO | MOD-314, MOD-003 |
| MOD-316 | Audit | Trazabilidad acciones staff | P2 | PLANIFICADO | MOD-010, MOD-005 |
| MOD-317 | Blueprints | Plantillas flujos producción | P2 | PLANIFICADO | MOD-305 |
| MOD-318 | Seller Views | Subset limitado seller | P1 | PLANIFICADO | MOD-301, MOD-003 seller |

**Ubicación futura:** `MiamiDJBeat-MigracionV2/staff/`  
**Red zone:** MOD-306, MOD-309, MOD-312 — ticket + ADR por cambio

---

## SECCIÓN 8 — MÓDULOS TRANSVERSALES

Servicios o capacidades usadas por **más de un portal** vía Shared Core o capa de dominio compartida.

| ID | Nombre | Descripción | Prioridad | Estado | Dependencias |
|----|--------|-------------|-----------|--------|--------------|
| MOD-401 | Search | Búsqueda global acotada por portal | P2 | PLANIFICADO | MOD-005 |
| MOD-402 | Notifications Hub | Orquestación NOTIFICATION_CREATED | P1 | PLANIFICADO | MOD-011 |
| MOD-403 | Media Service | Metadatos y URLs media compartidos | P1 | PLANIFICADO | MOD-012 |
| MOD-404 | Files Service | Documentos adjuntos cross-portal | P2 | PLANIFICADO | MOD-012 |
| MOD-405 | Settings Core | Preferencias transversales (theme, lang) | P1 | PLANIFICADO | MOD-007, MOD-015 |
| MOD-406 | Help | Ayuda contextual por portal | P3 | PLANIFICADO | MOD-015 |
| MOD-407 | Support | Tickets soporte cliente/artista | P2 | PLANIFICADO | MOD-005 |
| MOD-408 | Activity Log | Log actividad usuario (lectura propia) | P2 | PLANIFICADO | MOD-010, MOD-005 |
| MOD-409 | Orders Core Service | **Una orden** — proyección Client/Artist/Staff | P0 | PLANIFICADO | MOD-005, Supabase Orders |

**Regla:** transversales viven en `shared/services/` — no duplicar en portales.

---

## SECCIÓN 9 — DEPENDENCIAS

### Módulos críticos (cadena P0)

```
Supabase
  → MOD-006 Configuration
  → MOD-001 Authentication
  → MOD-002 Session Manager
  → MOD-003 Permissions
  → MOD-004 Event Bus
  → MOD-005 API Client
  → MOD-409 Orders Core Service
  → Portales (Shells P0)
```

### Matriz de dependencias (resumen)

| Módulo | Depende de | Bloquea a |
|--------|------------|-----------|
| MOD-001 | MOD-006, Supabase | Todo |
| MOD-003 | MOD-001, MOD-002 | Shells, red zone staff |
| MOD-004 | MOD-002 | MOD-202, nav contracts |
| MOD-101 | MOD-001–004, MOD-015 | Módulos Client |
| MOD-201 | MOD-001–004, MOD-015 | Módulos Artist |
| MOD-301 | MOD-001–004, MOD-003 | Módulos Staff |
| MOD-409 | MOD-005 | MOD-104, MOD-304, MOD-209 |

### Paralelizable (post Shell + Core P0)

| Ola | Módulos |
|-----|---------|
| A | MOD-102–104, MOD-108 (Client) |
| B | MOD-203–205, MOD-207, MOD-202 (Artist) |
| C | MOD-302, MOD-318, MOD-310 (Staff read-heavy) |
| D | Red zone: MOD-306, MOD-309, MOD-312 (secuencial, ADR) |

---

## SECCIÓN 10 — ORDEN DE IMPLEMENTACIÓN

Orden **oficial** de construcción (alineado con System Blueprint):

| Fase | Módulos | Gate |
|------|---------|------|
| **0** | Catálogo + Blueprint aprobados PO | Este documento |
| **1** | MOD-006, MOD-001, MOD-002, MOD-003, MOD-014, MOD-015 | Shared Core auth |
| **2** | MOD-004, MOD-005, MOD-007, MOD-008, MOD-010 | Shared Core infra |
| **3** | MOD-009, MOD-011, MOD-012, MOD-013, MOD-016, MOD-405 | Shared Core completo |
| **4** | MOD-409 Orders Core Service | Operations Core |
| **5** | MOD-101 Client Shell + MOD-102–104 | Client MVP |
| **6** | MOD-201, MOD-202 Artist Shell + Nav | Artist MVP |
| **7** | MOD-301, MOD-302 Staff Shell + Dashboard | Staff MVP |
| **8** | Módulos P1/P2 por portal (tickets separados) | QA por módulo |
| **9** | MOD-402, MOD-403 transversales | Integración |
| **10** | Cutover módulo a módulo | PO + rollback |

---

## SECCIÓN 11 — REGLAS

| # | Regla |
|---|-------|
| R-01 | **Un módulo = un responsable** (owner en ticket) |
| R-02 | **Un módulo = un ticket** de implementación |
| R-03 | **Un módulo = un QA** completo (4–5 capas según Constitución) |
| R-04 | **No mezclar módulos** en un mismo ticket |
| R-05 | **No ampliar alcance** del módulo sin actualizar catálogo + PO |
| R-06 | **No crear módulos** sin registrar aquí primero |
| R-07 | Cambio de prioridad o estado → actualizar esta tabla + nota en ticket |
| R-08 | Módulo MIGRADO → equivalente V1 marcado deprecated, no borrado de inmediato |

---

## SECCIÓN 12 — REGLA FINAL

> **Todo nuevo módulo deberá agregarse primero a este catálogo.**  
> **Después podrá abrirse su ticket de implementación.**

**Sin registro en este documento: NO podrá desarrollarse.**

Modificaciones al catálogo (nuevo módulo, cambio P0, retiro): ticket de catálogo o ADR si impacta arquitectura.

---

## RESUMEN DE INVENTARIO

| Área | Cantidad |
|------|----------|
| Shared Core (MOD-001–016) | 16 |
| Portal Cliente (MOD-101–114) | 14 |
| Portal Artista (MOD-201–216) | 16 |
| Portal Staff (MOD-301–318) | 18 |
| Transversales (MOD-401–409) | 9 |
| **Total módulos registrados** | **73** |

---

*Module Catalog v1.2 — 2026-07-05 (origen) · consolidado 2026-07-10 — TICKET-V2-DOC-CONSOLIDATION-001*

*Referencia obligatoria para todo desarrollo V2. Sección 4: tabla única con estados documental / runtime / validación y portal propietario separados.*
