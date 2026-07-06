# MIAMI DJ BEAT

# SYSTEM BLUEPRINT

## ARQUITECTURA FUNCIONAL GLOBAL

**Versión:** 1.0  
**Ticket:** TICKET-V2-SYSTEM-BLUEPRINT-001  
**Proyecto:** MiamiDJBeat-MigracionV2  
**Estado:** Diseño — sin implementación  
**Modificación futura:** Solo vía ADR aprobada por Product Owner

---

## SECCIÓN 1 — OBJETIVO DEL BLUEPRINT

Este documento es el **plano completo del sistema** MiamiDJBeat-MigracionV2.

Su finalidad es definir **toda la arquitectura funcional** — portales, Shared Core, backend conceptual, eventos, permisos, módulos y orden de construcción — **antes** de implementar el Shared Core.

| Qué es | Qué no es |
|--------|-----------|
| Mapa funcional del producto V2 | Código, HTML, CSS, JS |
| Contrato entre PO, arquitectura e implementación | Especificación de framework o build |
| Base para TICKET-V2-SHARED-CORE-001 | Migración o cutover ejecutado |

Ningún módulo se implementa hasta **aprobación PO** de este Blueprint (Sección 14).

---

## SECCIÓN 2 — VISIÓN GENERAL

### Diagrama conceptual

```
                     SUPABASE
              Auth · Profiles · Orders
              Invoices · Payments · RLS
              RPC · Edge · Realtime · Storage
                         │
                         ▼
                  SHARED CORE
        ┌────────────────────────────────┐
        │ Auth          Permissions      │
        │ Session       Services         │
        │ Components    Theme            │
        │ Design System Events           │
        │ API Client    Notifications    │
        │ Logging       Error Handling   │
        │ Storage       i18n · Responsive│
        │ Configuration Feature Flags    │
        └────────────────┬───────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
       CLIENT         ARTIST          STAFF
      (buyer)      (performer)    (operations)
```

### Flujo de datos (Operations Core)

Una **orden** (evento/contrato comercial) nace **una vez** en Supabase. Cada portal consume una **proyección** según rol — nunca una copia divergente.

---

## SECCIÓN 3 — PORTAL CLIENTE

### Objetivo

Portal independiente para **compradores y clientes VIP**: cuenta, contratación, historial y lealtad. Sin herramientas de artista ni staff.

### Tipos de usuarios

> **Taxonomía oficial V2:** `PROFILE-TAXONOMY.md` §1 — Client Profile Types (TICKET-V2-PROFILE-TAXONOMY-001).

| Tipo | Identidad | Descripción |
|------|-----------|-------------|
| **Regular Client** | `client_profiles` · MDJB **C** | Cliente inicial / estándar |
| **VIP Client** | `client_profiles` + reglas lealtad | Recurrente; crown + label VIP; cupones |
| **Commercial Client** | `client_profiles` + entidad comercial | Contrata vía empresa (club, venue, corp., etc.) |
| **Invitado** | Sin sesión | Browse limitado; checkout con registro |

### Módulos

| Módulo | ID | Descripción |
|--------|-----|-------------|
| Account | `M-CL-ACCT` | Perfil, preferencias, MDJB ID |
| Bookings | `M-CL-BOOK` | Reservas y estado de eventos contratados |
| Shop Buyer | `M-CL-SHOP` | Catálogo comprador, carrito, checkout |
| Orders History | `M-CL-ORD` | Historial de pedidos y recibos |
| VIP Loyalty | `M-CL-VIP` | Estado VIP, beneficios, cupones |
| Notifications | `M-CL-NOTIF` | Alertas de pedido, evento, promoción |

### Pantallas (conceptual)

- Login / registro cliente
- Dashboard cuenta
- Detalle de reserva / evento contratado
- Shop y checkout
- Historial de órdenes
- Perfil y preferencias
- Centro de notificaciones

### Permisos

| Acción | Regular | VIP | Commercial | Invitado |
|--------|---------|-----|------------|----------|
| Ver catálogo shop | ✅ | ✅ | ✅ | ✅ limitado |
| Checkout | ✅ | ✅ | ✅ | tras registro |
| Ver propias órdenes | ✅ | ✅ | ✅ | ❌ |
| Ver panel artista | ❌ | ❌ | ❌ | ❌ |
| Ver panel staff | ❌ | ❌ | ❌ | ❌ |
| Editar `dj_profiles` | ❌ | ❌ | ❌ | ❌ |

### Eventos emitidos (portal)

| Evento | Propósito |
|--------|-----------|
| `CLIENT_SHELL_READY` | Shell cliente hidratado |
| `CLIENT_CHECKOUT_STARTED` | Inicio checkout |
| `CLIENT_ORDER_VIEWED` | Detalle orden abierto |

### Servicios utilizados (Shared Core + Supabase)

- Auth / Session
- Permissions (snapshot buyer)
- Orders API (lectura propia)
- Shop / checkout Edge (futuro)
- Notifications
- i18n, Theme

### Qué puede hacer

- Gestionar cuenta de comprador
- Reservar y pagar servicios
- Ver historial propio
- Acceder beneficios VIP cuando aplique

### Qué nunca podrá hacer

- Acceder owner strip o STAFF
- Editar perfil artístico de DJ
- Ver leads, facturación interna, CRM staff
- Ejecutar RPC/Edge de staff management
- SoundForTips™ artist console

---

## SECCIÓN 4 — PORTAL ARTISTA

### Objetivo

Portal independiente para **DJs y performers**: presencia pública, operación de agenda, economía del artista y herramientas PRO.

### Tipos de artista

> **Categorías artísticas V2:** `PROFILE-TAXONOMY.md` §3 — Artist Categories.  
> **Tier comercial** (LITE/PRO/ELITE) permanece ortogonal a la categoría.

| Categoría (ejemplos) | ID taxonomía |
|----------------------|--------------|
| DJ | `artist.dj` |
| Singer / Solo Artist | `artist.singer_solo` |
| Band / Orchestra / Group | `artist.band_group` |
| MC / Host | `artist.mc_host` |
| Dancer / Performer | `artist.dancer_performer` |
| Clown / Kids Entertainment | `artist.clown_kids` |
| Musician | `artist.musician` |
| Other Custom Artist Category | `artist.custom` |

#### Tier comercial (señal de pago)

| Tier | Señal comercial | Acceso |
|------|-----------------|--------|
| **LITE** | `mdj_artist_commercial_tier=0` | Base gratis |
| **PRO** | tier `1` | PRO badge, SFT elegible |
| **ELITE** | tier `2` | Máximo nivel artista |

Principal: `performer` · Fila: `dj_profiles` · MDJB **A**

### Módulos

| Módulo | ID | Descripción |
|--------|-----|-------------|
| Public Profile | `M-AR-PROF` | Perfil público + owner view |
| Artist Navigation | `M-AR-NAV` | 10 pilares; contrato surface-ready |
| Dashboard / Agenda | `M-AR-DASH` | Calendario, eventos asignados |
| Jobs | `M-AR-JOBS` | Oportunidades roster |
| DJ Tools | `M-AR-TOOLS` | Utilidades profesionales |
| Cash Flow | `M-AR-FLOW` | Panel económico artista |
| SoundForTips™ | `M-AR-SFT` | PRO only · `dj_soundfortips_plan_ok` |
| Academia | `M-AR-ACAD` | Formación artista |
| Profile Settings | `M-AR-CFG` | Config artista (≠ staff admin) |

### Pantallas

- Perfil público (`?view=public` fan/QR)
- Perfil owner (tabs gestión)
- Dashboard / Agenda
- Jobs board
- Shop (contexto artista navegación)
- DJ Tools hub
- Cash Flow tab
- SoundForTips™ console
- Academia hub
- Account settings (artista)

### Dashboard · Agenda · Jobs · Tools · Cash Flow · SFT · Academia

| Área | Función |
|------|---------|
| **Dashboard** | Home operativo; entradas a agenda y flow |
| **Agenda** | Eventos confirmados, disponibilidad |
| **Jobs** | Listado oportunidades; aplicación roster |
| **DJ Tools** | Enlaces/herramientas PRO/LITE según tier |
| **Cash Flow** | Ingresos/gastos artista (≠ facturación staff) |
| **SoundForTips™** | Fan requests, night log; gate PRO |
| **Academia** | Cursos, certificados (nombre legal en docs oficiales) |

### Eventos

| Evento | Propósito |
|--------|-----------|
| `ARTIST_NAV_READY` | Strip 10 pilares listo (generaliza OWNER_STRIP_READY) |
| `ARTIST_PROFILE_READY` | Perfil cargado; owner gate resuelto |
| `ARTIST_DASHBOARD_READY` | Dashboard hidratado |
| `SFT_SURFACE_READY` | Consola SFT montada |

### Servicios

- Auth / Session / snapshot performer
- Profile API (`dj_profiles`)
- Agenda / events projection
- Cash Flow module
- SFT Edge + RPC (gate PRO)
- Navigation contracts
- i18n, Theme

### Permisos

| Acción | Owner perfil | Artista roster | Público |
|--------|--------------|----------------|---------|
| Ver owner strip | ✅ si owner/admin perfil | ❌ | ❌ |
| Editar perfil propio | ✅ | ✅ propio | ❌ |
| Cash Flow | ✅ owner | según producto | ❌ |
| SFT | ✅ si PRO ok | ✅ si PRO ok | ❌ |
| Staff admin | ❌ | ❌ | ❌ |

### Limitaciones

- Sin CRM staff, invoices internas, leads pipeline
- Sin checkout buyer como home
- STAFF tab → enlace a Staff Portal (`admin-dashboard#staff` equivalente V2), no embed admin
- No confiar `subscription_status` solo para SFT

---

## SECCIÓN 5 — PORTAL STAFF

### Objetivo

Operación interna: **Owner, Admin, Manager, Seller** en un portal con permisos por rol.

### Roles

> **Taxonomía recuperable V2 (PO):** Owner · Manager · Seller — ver `PROFILE-TAXONOMY.md` §2.

| Rol | Función Postgres | Escritura producción |
|-----|------------------|----------------------|
| **Owner** | `is_staff_management` | Plena |
| **Manager** | `is_staff_management` | Plena |
| **Seller** | `is_staff` sin management | Limitada |
| **Admin** | `is_staff_management` | Plena (par Blueprint; ver nota taxonomía) |

MDJB **M** (admin/owner/manager) · **S** (seller)

### Módulos

| Módulo | ID | Descripción | Red zone |
|--------|-----|-------------|----------|
| Staff Shell | `M-ST-SHELL` | Auth gate; layout staff | Sí |
| Dashboard | `M-ST-DASH` | Home operaciones | Sí |
| CRM | `M-ST-CRM` | Relación comercial | Sí |
| Production | `M-ST-PROD` | Coordinación eventos | Sí |
| Invoices | `M-ST-INV` | Facturación | Sí |
| Events Ops | `M-ST-EVT` | Gestión eventos interna | Sí |
| Matching | `M-ST-MATCH` | Asignación talento | Sí |
| Leads | `M-ST-LEAD` | Pipeline comercial | Sí |
| Payments | `M-ST-PAY` | Pagos, cobros | Sí |
| Blueprints | `M-ST-BP` | Plantillas producción | Sí |
| Reports | `M-ST-RPT` | Reportes gerenciales | Media |
| Seller Views | `M-ST-SELL` | Vistas limitadas seller | Sí |

### Operaciones por dominio

| Dominio | Owner/Admin/Manager | Seller |
|---------|---------------------|--------|
| Leads | CRUD | lectura / acciones limitadas |
| Invoices | CRUD | lectura según política |
| Production | CRUD | limitado |
| Matching | CRUD | limitado |
| Payments | CRUD | ❌ escritura |
| Reports | full | subset |

### Eventos

| Evento | Propósito |
|--------|-----------|
| `STAFF_SHELL_READY` | Auth gate cleared; shell visible |
| `STAFF_MODULE_READY` | Módulo staff montado |

### Permisos por rol (resumen)

- **Gate:** no staff en DB → signOut + redirect público
- **Management writes:** solo `is_staff_management`
- **Seller:** UI oculta/deshabilita writes en red zone

### Qué nunca debe contener

- Owner strip artista como nav principal
- Shop checkout cliente
- Editor perfil artístico como landing default

---

## SECCIÓN 6 — SHARED CORE

Definición exacta del núcleo transversal. **Sin páginas de portal.**

| Capacidad | Responsabilidad | No incluye |
|-----------|-----------------|------------|
| **Auth** | Sign-in/out, hydrate, provider Supabase | Pantallas login portal-específicas (shell en portal) |
| **Permissions** | Snapshot, guards, role matrix | Lógica CRM |
| **Session** | Estado sesión, `INITIAL_SESSION` vs `SIGNED_IN` | Redirects de negocio por portal |
| **Theme** | Tokens dark/gold, variables CSS | Layouts de portal |
| **Design System** | Tipografía, spacing, botones, modales | Nav 10 pilares |
| **Components** | Primitivas UI reutilizables | Feature screens |
| **Services** | Módulos dominio (orders, profiles…) | Writes staff sin guard |
| **Utilities** | Helpers genéricos | Globals V1 `window.__mdj*` |
| **API Client** | Supabase + Edge wrapper, errores HTTP | SQL migrations |
| **Configuration** | Env, constants, portal ids | Secrets committed |
| **Feature Flags** | Toggles cutover / módulo | Product rules sin PO |
| **Event Bus** | Registro emit/listen tipado | Poll-based nav |
| **Logging** | Client logs estructurados | PII en claro |
| **Error Handling** | Surface `error`/`detail` Edge | Silenciar fallos |
| **Storage** | Abstracción buckets | Políticas RLS (Supabase) |
| **Internationalization** | EN canónico, ES fallback | Copy legal sin revisión |
| **Responsive** | Breakpoints, nav mobile contract | Page-specific CSS |
| **Notifications** | Toast, inbox client, push hook | Templates staff CRM |

**Regla:** `shared/` no importa `client/`, `artist/`, `staff/`.

---

## SECCIÓN 7 — SUPABASE (Conceptual)

Sin implementación en este ticket. Capas lógicas:

| Área | Uso V2 |
|------|--------|
| **Authentication** | Email/OAuth; sesión JWT |
| **Profiles** | `client_profiles`, `dj_profiles`, MDJB IDs |
| **Orders** | Operations Core — una orden, proyecciones |
| **Invoices** | Staff; RLS `is_staff_management` |
| **Payments** | Stripe/Edge; estados pago |
| **Subscriptions** | Artist PRO/ELITE; SFT gate |
| **Storage** | Media perfil, assets evento |
| **RPC** | `mdj_access_snapshot`, guards server-side |
| **Edge Functions** | Checkout, SFT, notificaciones |
| **Realtime** | Opcional: orden status, notificaciones |
| **Policies (RLS)** | Única verdad operativa staff; red zone |

V2 **consume** el proyecto Supabase existente; migraciones SQL = tickets separados, no lab scaffold.

---

## SECCIÓN 8 — EVENT BUS

Contratos explícitos. Estado inicial: **Especificado — no implementado**.

| Evento | Emisor | Receptor | Propósito | Estado |
|--------|--------|----------|-----------|--------|
| `USER_LOGIN` | Auth (Shared) | Portales, Analytics | Sesión activa post SIGNED_IN | Especificado |
| `USER_LOGOUT` | Auth (Shared) | Portales, Nav | Limpieza estado | Especificado |
| `SESSION_HYDRATED` | Auth (Shared) | Guards, Shells | INITIAL_SESSION resuelto | Especificado |
| `ORDER_CREATED` | Services / Staff | Client, Artist, Staff | Nueva orden Operations Core | Especificado |
| `ORDER_UPDATED` | Services / Staff | Client, Artist, Staff | Cambio estado orden | Especificado |
| `PAYMENT_COMPLETED` | Services / Edge | Client, Staff | Pago confirmado | Especificado |
| `PROFILE_UPDATED` | Portal / Services | Nav, Cache | Invalidar proyección UI | Especificado |
| `JOB_ASSIGNED` | Staff Matching | Artist | Oportunidad asignada | Especificado |
| `NOTIFICATION_CREATED` | Services | Client, Artist, Staff | Nueva alerta | Especificado |
| `THEME_CHANGED` | Theme (Shared) | Components | Aplicar tokens | Especificado |
| `LANGUAGE_CHANGED` | i18n (Shared) | Shells | Cambio locale | Especificado |
| `ARTIST_NAV_READY` | Artist surfaces | Shared Navigation | Strip listo; reorder once | Especificado |
| `STAFF_SHELL_READY` | Staff Shell | Staff modules | Gate cleared | Especificado |
| `CLIENT_SHELL_READY` | Client Shell | Client modules | Buyer shell listo | Especificado |

**Reglas del bus:**

1. `{ once: true }` donde aplique reorder único  
2. Catch-up flag si emit precede listener  
3. Prohibido poll para orden nav primario  

---

## SECCIÓN 9 — MATRIZ DE RESPONSABILIDADES

| Módulo | ID | Portal propietario | Consumidores | Dependencias | Estado |
|--------|-----|-------------------|--------------|--------------|--------|
| Shared Auth | `M-SC-AUTH` | Shared Core | All | Supabase Auth | Blueprint |
| Shared Permissions | `M-SC-PERM` | Shared Core | All | Auth, RPC snapshot | Blueprint |
| Shared Event Bus | `M-SC-EVT` | Shared Core | All | Auth | Blueprint |
| Artist Navigation | `M-AR-NAV` | Artist | Artist satellites | Auth, Perm, Event Bus | Blueprint |
| Client Account | `M-CL-ACCT` | Client | — | Auth, Perm | Blueprint |
| Client Shop | `M-CL-SHOP` | Client | — | Auth, Orders svc | Blueprint |
| Artist Profile | `M-AR-PROF` | Artist | — | Auth, Perm, Profile svc | Blueprint |
| Artist SFT | `M-AR-SFT` | Artist | — | PRO gate, Edge | Blueprint |
| Staff Shell | `M-ST-SHELL` | Staff | Staff modules | Auth, Perm | Blueprint |
| Staff Invoices | `M-ST-INV` | Staff | — | Shell, RLS management | Blueprint |
| Staff Leads | `M-ST-LEAD` | Staff | — | Shell, CRM svc | Blueprint |
| Orders Core | `M-SC-ORD` | Shared Services | Client, Artist, Staff | Supabase orders | Blueprint |

---

## SECCIÓN 10 — DEPENDENCIAS ENTRE MÓDULOS

### Diagrama de dependencias (críticas)

```
Supabase
    │
    ▼
Auth ──► Permissions ──► Event Bus
    │           │
    └─────┬─────┴─────┬─────────────┐
          ▼           ▼             ▼
    Client Shell  Artist Nav   Staff Shell
          │           │             │
          ▼           ▼             ▼
    Client mods   Artist mods   Staff mods
```

### Críticos (bloquean todo lo demás)

| Módulo | Razón |
|--------|-------|
| Auth | Sin sesión no hay portal |
| Permissions | Sin snapshot no hay gates |
| Event Bus | Sin contratos, drift nav |
| API Client | Sin servicios no hay datos |

### Paralelizable (post Shared Core mínimo)

| Track A | Track B | Track C |
|---------|---------|---------|
| Client Account | Artist Profile | Staff Shell read-only |
| Client Shop | Artist Dashboard | Staff Reports read |
| Client VIP | Artist Jobs | Seller views |

**Regla:** no paralelizar red zone staff (Invoices, Leads, Payments) sin Shell + Perm + ADR.

---

## SECCIÓN 11 — ORDEN DE CONSTRUCCIÓN

| Orden | Fase | Entregable |
|-------|------|------------|
| **1** | Shared Core | Auth, Perm, Session, Event Bus, API Client, i18n, Theme, DS mínimo |
| **2** | Client | Shell + Account + Orders read |
| **3** | Artist | Nav contract + Profile + Dashboard |
| **4** | Staff | Shell + gate + Dashboard; luego red zone por ADR |
| **5** | Integración | Operations Core proyecciones cruzadas |
| **6** | QA | Técnico, Visual, Funcional, PO, Producción |
| **7** | Cutover | Módulo por módulo; rollback plan |

Alineado con `docs/V2-LAB/04-MIGRATION-PLAN.md` y Constitución DECISIÓN CONSTITUCIONAL-001.

---

## Estado actual del Shared Core

**Fecha corte:** 2026-07-05 · **Metodología:** Documentation First (DECISION-V2-002)

| MOD | Módulo | Estado documental |
|-----|--------|---------------------|
| MOD-001 | Authentication | DOCUMENTACIÓN COMPLETA |
| MOD-002 | Session Manager | DOCUMENTACIÓN COMPLETA |
| MOD-003 | Permissions | DOCUMENTACIÓN COMPLETA |
| MOD-004 | Event Bus | DOCUMENTACIÓN COMPLETA |
| MOD-005 | API Client | DOCUMENTACIÓN COMPLETA |
| MOD-006 | Configuration | DOCUMENTACIÓN COMPLETA |
| MOD-007 | Theme Manager | DOCUMENTACIÓN COMPLETA |
| MOD-008 | Design System | DOCUMENTACIÓN COMPLETA |
| MOD-009 | Components Library | DOCUMENTACIÓN COMPLETA |
| MOD-010 | Logging | DOCUMENTACIÓN COMPLETA |
| MOD-011 | Notifications | DOCUMENTACIÓN COMPLETA |
| MOD-012 | Storage | DOCUMENTACIÓN COMPLETA |
| MOD-013 | Feature Flags | DOCUMENTACIÓN COMPLETA |
| MOD-014 | Error Handler | DOCUMENTACIÓN COMPLETA |
| MOD-015 | Internationalization | DOCUMENTACIÓN COMPLETA |
| MOD-016 | Responsive Engine | DOCUMENTACIÓN COMPLETA |

**Tablero maestro:** `docs/V2/SHARED-CORE-PROGRESS.md`

| Métrica | Valor |
|---------|-------|
| Total módulos Shared Core | **16** |
| Documentados | **16** |
| Pendientes | **0** |
| Avance documental | **100%** (16 ÷ 16) |
| Tickets spec completados | **001–018** |
| Nivel 0 Base | **100%** |
| Nivel 1 Infraestructura | **100%** |
| Nivel 2 UI Foundation | **100%** |
| Shared Core spec | **COMPLETO** |
| Implementación runtime | **0** módulos |
| Próxima fase | **Runtime Shared Core** o **Portal Shell spec** (pendiente PO) |

---

## SECCIÓN 12 — RIESGOS

| Categoría | Riesgo | Mitigación |
|-----------|--------|------------|
| **Técnico** | Event bus mal implementado → nav drift | Contratos + tests; prohibir poll |
| **Técnico** | Shared Core importa portal | Lint boundaries en ticket Shared Core |
| **Migración** | Big bang tentación | Constitución; olas con rollback |
| **Migración** | Copia V1 arrastra deuda | ADR reuse; reimplement from spec |
| **Integración** | Orden duplicada Client/Staff | Operations Core single source |
| **Integración** | Edge URLs `/web/` prefix | Env deploy root en API Client |
| **Permisos** | JWT-only staff UI | Snapshot + RLS; signOut gate |
| **Permisos** | Seller writes red zone | `is_staff_management` UI + RLS |
| **Regresión** | Header/nav V1 afectado | Lab aislado; zero V1 diff |
| **Regresión** | Doble barra nav artist | Satellite routing contract |

---

## SECCIÓN 13 — CRITERIOS PARA INICIAR SHARED CORE

Antes de abrir **TICKET-V2-SHARED-CORE-001** deben cumplirse:

| # | Criterio | Estado esperado |
|---|----------|-----------------|
| 1 | Blueprint aprobado por PO | Pendiente firma este doc |
| 2 | Scaffold físico existe | ✅ `MiamiDJBeat-MigracionV2/` |
| 3 | Constitución + Arquitectura Viva vigentes | ✅ |
| 4 | DECISION-V2-001 registrada | ✅ |
| 5 | Alcance Shared Core acotado en ticket hijo | Ticket siguiente |
| 6 | ADR stack (TS/build) si aplica | ADR pendiente o en ticket SC |
| 7 | Cero diff en V1 | Verificado por ticket |
| 8 | PO autoriza inicio Shared Core | Frase en ticket SC |

**Hasta PO apruebe este Blueprint, Shared Core NO inicia.**

---

## SECCIÓN 14 — REGLA FINAL

> **Ningún módulo podrá comenzar su implementación hasta que este Blueprint sea aprobado por el Product Owner.**

> **Toda modificación futura de este Blueprint deberá documentarse mediante una ADR aprobada.**

Jerarquía documental: Constitución > Arquitectura Viva > **System Blueprint** > ADR > implementación.

---

*System Blueprint v1.0 — 2026-07-05 — TICKET-V2-SYSTEM-BLUEPRINT-001*

*Sin implementación. Esperando aprobación Product Owner antes de TICKET-V2-SHARED-CORE-001.*
