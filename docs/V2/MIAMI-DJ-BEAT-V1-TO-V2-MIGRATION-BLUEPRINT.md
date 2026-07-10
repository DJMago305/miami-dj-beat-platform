# Miami DJ Beat — V1 to V2 Migration Blueprint

**Ticket:** TICKET-V2-MIGRATION-BLUEPRINT-001  
**Versión:** 1.1  
**Fecha:** 2026-07-09  
**Estado:** APROBADO POR PRODUCT OWNER  
**Modo:** Documentación y arquitectura únicamente — cero implementación

**Referencias canónicas:**

- `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`
- `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md`
- `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md`
- `docs/architecture/MASTER-WIRING-AUDIT-V1.md`
- `docs/V2/SESSION-SUMMARIES/2026-07-06.md`
- Baseline LOCAL validada PO: **2026-07-06** · revalidada **2026-07-09**

---

## Visión

Miami DJ Beat V2 **no es un producto nuevo**. Es la **evolución natural** de Miami DJ Beat V1: misma marca, mismo ADN visual, mismos flujos de negocio — reconstruidos sobre **motores desacoplados** (Session, Permissions, Theme, Event Bus, API Client) que hacen la plataforma más rápida, mantenible y segura.

**Naturaleza de V2 (criterio PO):** V2 debe **conservar**, cuando el PO lo determine, la experiencia visual, navegación, identidad comercial y funcionalidad de V1. La nueva arquitectura corresponde **principalmente a motores internos**, separación de dominios, rendimiento, seguridad y mantenibilidad — **no** a inventar otro producto ni sustituir pantallas por rediseños arbitrarios.

**Ninguna pantalla V2 será considerada sustituto definitivo** de su equivalente V1 hasta existir:

- comparación visual V1 vs V2;
- paridad funcional;
- pruebas;
- validación PO;
- cutover explícito (`APROBADO DEPLOY PRODUCCIÓN`).

| V1 hoy | V2 mañana |
|--------|-----------|
| Monolito `web/` (~154 archivos HTML/JS entrelazados) | Tres portales independientes + Shared Core |
| Nav/auth compartido frágil (`mdj-shared-header.js`) | Permissions + Session como única fuente de verdad |
| Hub comercial `leads`-centric sin ledger unificado | Operations Core: una orden, proyección por rol |
| Staff monolítico (`admin-dashboard.html`) | Staff portal modular con gates por capability |
| Lógica mezclada en páginas | Business logic en servicios; UI en portales |

**Regla de oro:** el usuario debe sentir que sigue en **Miami DJ Beat**, no en “otra app”.

---

## Objetivos

1. **Conservar** la experiencia y el negocio V1 mientras se **moderniza** la base técnica.
2. **Migrar por módulos** acotados — nunca big bang, nunca parches sueltos V1↔V2.
3. **Proteger** legal y comercialmente a Miami DJ Beat LLC (dominio Legal/Compliance).
4. **Escalar** a cientos de artistas, múltiples venues, clientes corporativos, sellers, managers y owners.
5. **Gobernar** cada cambio con ticket PO, alcance cerrado y evidencia (Reglas 11–13, DECISION-V2-010–012).
6. **Mantener V1 en producción** hasta cutover explícito por módulo (`APROBADO DEPLOY PRODUCCIÓN`).

### Estado V2 al cierre de blueprint (2026-07-09)

| Área | Estado |
|------|--------|
| **Portales** | Client · Artist · Staff — shell + dashboard MVP en localhost |
| **Session** | READY · LOCKED (MOD-002) |
| **Permissions** | READY · LOCKED (MOD-003) |
| **Theme** | READY (MOD-007) |
| **Components** | Descriptores MVP (MOD-009) |
| **Git HEAD** | `fea5bd2` (docs) · runtime baseline `f73f9bb` |
| **Tests unitarios** | 297/297 PASS |
| **Validación visual PO** | 2026-07-09 — tres portales confirmados en Safari |
| **Durabilidad Git** | aproximadamente 82 paths untracked, según auditoría del 2026-07-09; inventario exacto pendiente del ticket Git durability — **riesgo P0** |

---

## Principios

### Principio 1 — ADN visual Miami DJ Beat

La experiencia visual conserva: dark/gold, Cinzel + Playfair, glass surfaces, status pills, navegación por portal, tono premium Miami. Los dashboards MVP V2 ya demuestran esta continuidad. **Prohibido** rediseño que parezca SaaS genérico ajeno a la marca.

### Principio 2 — Motores desacoplados

Session, Permissions, Theme, Config, Event Bus, Logging, Error Handler y API Client viven en `shared/` y se consumen por contrato. Los portales **no** reimplementan auth, roles ni theme.

### Principio 3 — Cambios sin regresión

Todo módulo congelado (MOD-002, MOD-003, boot, shell nav) requiere ticket + PO. Tests y validación visual son gate obligatorio antes de cutover.

### Principio 4 — Portales independientes

Client, Artist y Staff evolucionan en carpetas separadas. Un cambio en Staff **no** altera nav ni permisos de Client/Artist sin ticket explícito.

### Principio 5 — Escala multi-actor

La arquitectura debe soportar:

- Cientos de artistas (roster, matching, disponibilidad)
- Múltiples venues y clientes corporativos (`client.commercial`)
- Vendedores limitados (`staff.seller`)
- Managers y owners (`is_staff_management`)
- Proyección de una orden por rol sin copias divergentes

### Principio 6 — Estabilidad · Mantenibilidad · Rendimiento · Seguridad · Gobernanza

Prioridad en ese orden operativo. La gobernanza PO prevalece sobre criterio técnico (DECISION-V2-010).

---

## Inventario V1

Auditoría read-only de `web/` + `docs/architecture/`. **No se modificó ningún archivo.**

### Portal Cliente (Buyer / VIP)

| Módulo V1 | Archivos ancla | Descripción |
|-----------|----------------|-------------|
| **Dashboard** | `client-account.html`, `js/client-account.js` | Overview, eventos planificados/pasados |
| **Eventos** | `client-portal.html`, `client-portal.js` | Portal por lead: countdown, logística, paquete |
| **Órdenes** | `client-portal.js`, `shop.html` | Leads + `event_builder_orders`; shop `mdj_orders` |
| **Facturas** | `client-portal.js`, templates print | PDF invoice CTA; staff-side generation |
| **Pagos** | `client-portal.js`, `client-account.html` | Stripe checkout, Zelle, billing portal |
| **Perfil** | `client-account.html` | Profile, address, VIP crown |
| **Historial** | `client-account.html` (overview) | Past events table |
| **Chat** | `client-portal.html` `#chat-section` | `portal_messages` realtime |
| **Documentos** | Portal financial card | Sin módulo contracts dedicado |
| **Soporte** | Chat + `contact.html`, `mdj-assistant.js` | Asistente site-wide |

### Portal Artista (Performer / PRO)

| Módulo V1 | Archivos ancla | Descripción |
|-----------|----------------|-------------|
| **Perfil** | `dj-profile.html`, `account-settings.html` | Público + owner tabs, socials |
| **Calendario** | `dj-dashboard.html`, `account-settings.html` `panel-agenda` | FullCalendar + weekly schedule |
| **Cash Flow** | `flow-handler.js`, `dj-dashboard.html`, `dj-profile.html` | Ledger, health score, charts |
| **Song4Tips** | `dj-profile.html` `tab-sft`, `account-settings.html` | PRO gate · booth |
| **Trabajos** | `jobs.html` | Roster carousel, LITE/PRO signup |
| **Media** | Profile hero, `panel-products`, academia | Sin media library dedicada |
| **Analytics** | Profile visits RPC, Cash Flow KPIs | Sin página analytics dedicada |
| **Facturación** | `account-settings.html` `panel-billing`, `subscription.js` | PRO Stripe |
| **Herramientas DJ** | `dj-tools.html`, `load-root.html`, `tag-master.html`, `library-wizard.html` | MDJPRO Suite hub |
| **Academia** | `academia.html`, `courses.html`, `dj-knowledge.html` | Cursos + cultura |
| **Certificación** | `certification.html`, `practical-evaluation.html` | Teoría + práctica |

### Portal Staff (Operations)

| Módulo V1 | Archivos ancla | Descripción |
|-----------|----------------|-------------|
| **Leads** | `admin-dashboard.html` `#leads` | Pipeline, status, matching modal |
| **CRM** | `admin-dashboard.html` `#crm` | Relaciones cliente, VIP tier |
| **Invoices** | `production-module.js`, `invoice-*.html` | Manual invoices, print, Stripe |
| **Producción** | `#production`, `production-module.js`, `staff-order.html` | Event flows, payouts |
| **Matching** | Match modal en admin | DJ grid → lead/booking |
| **Reportes** | `#analytics` | KPIs pipeline, payments, reviews |
| **Usuarios** | `#djs`, `#staff`, `#create-profiles` | Roster, staff, owner create |
| **Configuración** | `#content` | Rentals catalog, platform settings |
| **Cash Flow** | Payout release en production | Separado de artist Cash Flow |
| **Operaciones** | EB orders, blueprints, `campaign-center.html` | Event builder orders, promos |

### Sistema global V1

| Sistema | Archivos ancla | Descripción |
|---------|----------------|-------------|
| **DJ Tools / MDJPRO** | `dj-tools.html`, `downloads.html`, `manuals/` | Mac suite + licensing |
| **Marketplace / Jobs** | `jobs.html`, `artist-onboarding.html` | Artist onboarding |
| **Rentals / Talent** | `rentals.html`, `js/rentals.js`, `services.html` | Talent selector hub, Event Builder |
| **Shop** | `shop.html` | E-commerce buyer |
| **Cursos** | `courses.html`, `course-data.js` | Certification modules |
| **Certificación** | `certification.html`, `verify.html`, `registry.html` | Exam + verify + registry |
| **Directorio** | `directory.html`, `find-dj.html` | Certified DJ discovery |
| **Login / Auth** | `login.html`, `auth.js`, `mdj-identity.js` | Multi-building routing |
| **Servicios públicos** | `index.html`, `services.html`, `events.html`, `contact.html` | Marketing + lead capture |
| **Contratos** | *(implícito)* | Lead notes + invoice/flow — **sin módulo legal dedicado** |
| **Verificación** | `verify.html`, `security-shield.js` | Certs + devices |
| **Eventos** | `events.html`, Event Builder JS family | Venues + builder → leads |
| **Legal público** | `legal.html` | Páginas legales estáticas |

### Hallazgos estructurales V1 (migración)

1. **Hub `leads`** — verdad comercial central; sin ledger unificado (TICKET-004 no implementado).
2. **Staff monolith** — `admin-dashboard.html` concentra operaciones.
3. **Finance split** — pagos cliente ≠ wallet artista (`dj_ledger`).
4. **Sin dominio Legal** — documentación fiscal y contratos no modelados como sistema.
5. **Nav dual** — `mdj-shared-header.js` + artist strip (`mdj_nav=profile`) — frágil pero funcional.

---

## Matriz de migración

Clasificación: **Conservar** · **Modernizar** · **Reemplazar** · **Fusionar** · **Dividir** · **Eliminar** · **Posponer**

> **Nota:** Ningún módulo se clasifica como **Eliminar** sin decisión explícita del PO.

### Portal Cliente

| Sistema V1 | Estado V1 | Destino V2 | Prioridad | Clasificación | Notas |
|------------|-----------|------------|-----------|---------------|-------|
| Account hub | Operativo | MOD-101 Shell + MOD-102 Dashboard + MOD-103 Profile | P0–P1 | **Modernizar** | MVP dashboard V2 ya existe; falta wiring real |
| Event portal (`client-portal`) | Operativo | MOD-109 Bookings + MOD-104 Orders | P1 | **Dividir** | Separar hub multi-evento de detalle booking |
| Shop | Operativo | MOD-108 Shop Buyer | P1 | **Modernizar** | Mantener flujo; nuevo checkout service |
| Payments / Stripe | Operativo | MOD-106 Payments + Edge | P1 | **Modernizar** | Sin cambiar proveedor; nueva capa API |
| VIP / Loyalty | Operativo | MOD-112 VIP Loyalty | P2 | **Conservar** | Crown + cupones — paridad producto |
| Chat | Operativo | MOD-110 Messages | P2 | **Modernizar** | Realtime vía Supabase; UI en client shell |
| Documents | Parcial | MOD-114 Documents + **LEGAL-DOMAIN-PROVISIONAL** | P1 | **Reemplazar** | Hoy embebido en portal; futuro módulo legal |
| Support / assistant | Operativo | MOD-110 + site assistant (transversal) | P3 | **Posponer** | `mdj-assistant.js` fuera de primer corte |
| Client billing legacy | Legacy | MOD-106 | P2 | **Fusionar** | `client-billing.html` → account payments |

### Portal Artista

| Sistema V1 | Estado V1 | Destino V2 | Prioridad | Clasificación | Notas |
|------------|-----------|------------|-----------|---------------|-------|
| Public profile | Operativo | MOD-204 Profile | P1 | **Modernizar** | Conservar owner strip contract |
| Dashboard + calendar | Operativo | MOD-203 Dashboard + MOD-207 Calendar | P1 | **Modernizar** | FullCalendar → servicio agenda |
| Cash Flow | Operativo | MOD-209 Cash Flow | P1 | **Modernizar** | `flow-handler.js` → API + proyección |
| Song4Tips | Operativo PRO | MOD-208 Song For Tips | P1 | **Conservar** | Gate PRO obligatorio — sin regresión |
| Jobs marketplace | Operativo | MOD-205 Jobs | P1 | **Modernizar** | Carousel V1 → roster service |
| Media | Disperso | MOD-215 Media + MOD-403 | P2 | **Reemplazar** | Consolidar uploads |
| Analytics | Parcial | MOD-212 Analytics | P3 | **Posponer** | KPIs hoy en Cash Flow |
| Billing / PRO | Operativo | MOD-216 Settings + subscriptions | P1 | **Modernizar** | Stripe checkout existente |
| DJ Tools / MDJPRO | Operativo | MOD-211 DJ Tools + licensing | P2 | **Conservar** | Mac suite separada; web hub |
| Academia / courses | Operativo | MOD-210 Academy | P2 | **Modernizar** | Certificación legal name vs stage |
| Artist nav strip | Operativo | MOD-202 Artist Navigation | P0 | **Conservar** | `mdj_nav=profile` — SEALED |

### Portal Staff

| Sistema V1 | Estado V1 | Destino V2 | Prioridad | Clasificación | Notas |
|------------|-----------|------------|-----------|---------------|-------|
| Leads pipeline | Operativo | MOD-312 Leads | P1 | **Modernizar** | MVP placeholder V2 existe |
| CRM | Operativo | MOD-303 CRM | P1 | **Modernizar** | |
| Invoices | Operativo | MOD-306 Invoices + **LEGAL-DOMAIN-PROVISIONAL** | P0 | **Dividir** | Red zone — management only |
| Production | Operativo | MOD-305 Production + MOD-317 Blueprints | P1 | **Dividir** | Separar blueprints de production ops |
| Matching | Operativo | MOD-307 Matching | P1 | **Modernizar** | |
| Reports / Analytics | Operativo | MOD-313 Reports | P2 | **Modernizar** | |
| Users / roster | Operativo | MOD-314 Users + MOD-311 Artists Roster | P1 | **Modernizar** | |
| Config / catalog | Operativo | MOD-304 Orders Ops + content admin | P2 | **Fusionar** | Rentals catalog hoy en `#content` |
| Cash Flow (payouts) | Operativo | MOD-309 Payments | P1 | **Modernizar** | Staff release ≠ artist wallet; payout gate fiscal |
| Operations / EB | Operativo | MOD-304 Orders Ops + MOD-308 Events Ops | P0 | **Reemplazar** | Operations Core target |
| Admin monolith | Operativo | MOD-301 Shell + módulos | P0 | **Dividir** | Descomponer `admin-dashboard.html` |
| Seller views | Parcial | MOD-318 Seller Views | P1 | **Conservar** | Subset limitado seller |

### Sistema global

| Sistema V1 | Estado V1 | Destino V2 | Prioridad | Clasificación | Notas |
|------------|-----------|------------|-----------|---------------|-------|
| Auth / login | Operativo | MOD-001 Authentication | P0 | **Reemplazar** | Supabase Auth + Session handoff |
| Shared header / nav | Operativo | Shell per portal + Permissions | P0 | **Reemplazar** | Anti-CLS rules V1 → shell V2 |
| i18n | Operativo | MOD-015 i18n | P1 | **Modernizar** | EN canonical |
| Event Builder | Operativo | Operations Core + MOD-405 Orders | P0 | **Modernizar** | `leads` + `event_builder_orders` |
| Rentals / Talent hub | Operativo | Public site + staff catalog | P1 | **Conservar** | Design contract talent hub |
| Shop (global) | Operativo | MOD-108 + public entry | P1 | **Modernizar** | |
| Certification | Operativo | MOD-210 + verify service | P2 | **Conservar** | Legal name on certificates |
| Directory | Operativo | MOD-401 Search + public | P3 | **Posponer** | |
| MDJPRO downloads | Operativo | MOD-211 + Edge licensing | P2 | **Conservar** | Ver `docs/mdjpro-licensing-architecture.md` |
| Legal pages | Estático | LEGAL-DOMAIN-PROVISIONAL + public legal | P1 | **Reemplazar** | De estático a sistema documental |
| Site marketing | Operativo | V1 hasta cutover público | P3 | **Posponer** | `index.html` permanece V1 largo plazo |
| Contracts (implícito) | Fragmentado | **LEGAL-DOMAIN-PROVISIONAL** | P0 | **Reemplazar** | Mayor brecha V1→V2 |

### Páginas V1 omitidas — auditoría ampliada (corrección PO)

| Página V1 | Función V1 | Destino V2 provisional | Prioridad | Clasificación | Auditoría adicional |
|-----------|------------|------------------------|-----------|---------------|---------------------|
| `party-planner.html` | Wizard MDJPRO Party Planner (planificación evento paso a paso) | MOD-211 DJ Tools / MDJPRO hub | P3 | **Posponer** | PENDIENTE DE AUDITORÍA FUNCIONAL — uso producción vs herramienta interna |
| `booth.html` | The AI Booth — central ops prospectos eventos/DJs | MOD-110 Messages + Staff Leads / ops assistant | P3 | **Modernizar** | PENDIENTE DE AUDITORÍA FUNCIONAL — relación con `mdj-assistant.js` |
| `wedding-planning.html` | Landing servicio planificación bodas (lead capture editorial) | Public site + MOD-109 Bookings / Event Builder | P2 | **Conservar** | No — función marketing clara |
| `account-profile.html` | Redirect a `account-settings.html` | MOD-216 Settings (Artist) | P2 | **Fusionar** | No — alias/redirect; no pantalla independiente |
| `admin.html` | Admin certificación / gestión contenido académico | MOD-314 Users + MOD-210 Academy admin | P3 | **Dividir** | PENDIENTE DE AUDITORÍA FUNCIONAL — overlap con `admin-dashboard.html` |
| `weather-lab.html` | Lab agenda/control MDJPRO (FullCalendar, weather, DJ panel) | MOD-207 Calendar + ops weather/logistics | P3 | **Posponer** | PENDIENTE DE AUDITORÍA FUNCIONAL — ¿prod o lab interno? |
| `cash-flow.html` | Página standalone Cash Flow artista (health & economics) | MOD-209 Cash Flow | P1 | **Modernizar** | No — paridad con `flow-handler.js` / dashboard |
| `find-dj.html` | Búsqueda y contratación DJs certificados (filtros, disponibilidad) | MOD-401 Search + MOD-205 Jobs / public discovery | P2 | **Modernizar** | No — complementa `directory.html` |

### Shared Core V2 (ya iniciado)

| Motor V2 | Estado 2026-07-09 | Relación V1 |
|----------|-------------------|-------------|
| MOD-002 Session | LOCKED · READY | Reemplaza `auth.js` checks dispersos |
| MOD-003 Permissions | LOCKED · READY | Reemplaza `role-guard.js`, JWT trust |
| MOD-007 Theme | Operativo · READY | Reemplaza tokens CSS ad-hoc |
| MOD-008 Portal Shell (lab) | MVP visual | Reemplaza `mdj-shared-header` per portal |
| MOD-009 Components | Descriptores | Reemplaza markup repetido |
| MOD-004 Event Bus | Disco, parcial Git | Nuevo — no existía en V1 |
| MOD-006 Config | Disco, parcial Git | Reemplaza env disperso |
| MOD-001 Auth | Pendiente | Reemplaza `login.html` flows |
| MOD-005 API Client | Pendiente | Reemplaza `supabase` calls directos |
| MOD-012 Storage | Spec only | Nuevo facade local |
| **LEGAL-DOMAIN-PROVISIONAL** (`MOD-TBD — Legal / Compliance / Contracts`) | No existe | **Nuevo dominio** — ver § Legal; ID definitivo **no aprobado** |

---

## Portal Cliente — destino V2

### Ya construido (baseline LOCAL)

- Shell + navegación (Dashboard · Event Planning · Orders · Payments · Documents · VIP)
- Dashboard MVP: Hero · KPIs · Quick Actions · Events · Orders · Payments · VIP · Notifications · Activity
- Session/Theme/Permissions READY (12 capabilities wired)

### Pendiente migración funcional

1. Wiring Supabase real (leads, orders, payments) vía MOD-005
2. Portal multi-evento (`client-portal.js` hub) → MOD-109
3. Chat → MOD-110
4. VIP crown + tier → MOD-112
5. Documents + legal consent → MOD-114 + LEGAL-DOMAIN-PROVISIONAL

### NO tocar sin ticket

- MOD-002 Session core · MOD-003 Permissions maps · shell nav copy frozen

---

## Portal Artista — destino V2

### Ya construido (baseline LOCAL)

- Shell + nav (Dashboard · Profile · Calendar · Cash Flow · Song4Tips · Jobs · Media & Analytics)
- Dashboard MVP: Profile · Gigs · Calendar · Cash Flow · Song4Tips · Jobs · Media · Analytics
- Permissions READY (14)

### Pendiente migración funcional

1. `dj-profile.html` public + owner → MOD-204 (preservar strip SEALED)
2. FullCalendar → MOD-207
3. `flow-handler.js` + `cash-flow.html` → MOD-209 (read-map CFMOVEMENT primero)
4. SFT PRO gate → MOD-208 + `dj_soundfortips_plan_ok`
5. Jobs carousel → MOD-205
6. MDJPRO / DJ Tools → MOD-211

### Artist / Provider workflow — documentación fiscal

- Subida de documentación fiscal aplicable (W-9 u otro formulario según evaluación administrativa).
- Consulta de estado de revisión fiscal (`required` → `approved` / `not_applicable` / `exception_approved`).
- Firma de contratos artísticos y acuerdos comerciales.
- **Sin desembolso** hasta aprobación fiscal o excepción autorizada (ver § Compliance · Payout gate).

### NO tocar sin ticket

- Artist strip `mdj_nav=profile` contract · SFT PRO rules · Cash Flow product definition V1 doc

---

## Portal Staff — destino V2

### Ya construido (baseline LOCAL)

- Shell + nav (Dashboard · Leads · Invoices · CRM · Production · Matching · Reports · Users)
- Dashboard MVP: Leads · Invoices · CRM · Production · Matching · Reports
- Permissions READY (26) · Leads visible en sidebar

### Pendiente migración funcional

1. Descomponer `admin-dashboard.html` en módulos MOD-301–318
2. `production-module.js` → MOD-305 + MOD-306 (red zone)
3. Matching modal → MOD-307
4. Analytics panel → MOD-313
5. Legal admin → LEGAL-DOMAIN-PROVISIONAL Staff (ver § Legal)

### Funciones Staff — dominio legal y fiscal

- Aprobar documentos contractuales y consentimientos.
- Validar documentación fiscal (W-9 u otra aplicable) por tipo de talento/proveedor.
- Revisar contratos y versiones.
- Bloquear perfiles por incumplimiento documental o contractual.
- Ver vencimientos y alertas fiscales.
- Auditoría de visualización, descarga y cambios de estado.
- **Staff Seller:** sin acceso al archivo fiscal completo; solo metadata autorizada.
- **Owner/Manager** o capability `staff.legal.*` para revisión fiscal completa.

### Payment / Payout gate (Staff)

- Liberación de desembolsos condicionada a estado fiscal `approved`, `not_applicable` o `exception_approved`.
- Integración con MOD-309 Payments y MOD-305 Production (red zone).
- Sin exposición de datos fiscales completos en dashboards generales.

### NO tocar sin ticket

- `is_staff` / `is_staff_management` Postgres truth · payout release logic · invoice RLS

---

## Dominio Legal

### Objetivo

Proteger **legal y comercialmente** a Miami DJ Beat LLC mediante un sistema documental centralizado, auditable y con estados formales — hoy **inexistente** como módulo en V1 (contratos viven en leads, invoices y notas).

### Identificador provisional del dominio

| Campo | Valor |
|-------|-------|
| **Referencia provisional** | **LEGAL-DOMAIN-PROVISIONAL** |
| **Alias documental** | **MOD-TBD — Legal / Compliance / Contracts** |
| **Estado del concepto** | **Aprobado como concepto arquitectónico** (dominio Legal/Compliance/Contracts) |
| **ID definitivo en catálogo** | **NO aprobado** — se asignará tras resolver colisión de numeración (D3 + D4 pendientes) |
| **Nombre** | Legal / Compliance / Contracts |
| **Ubicación** | `shared/services/legal/` (dominio) + superficies en tres portales |
| **Dependencias** | MOD-003 Permissions · MOD-005 API · MOD-012 Storage · MOD-404 Files · MOD-316 Audit |
| **Red zone** | Sí — junto MOD-306, MOD-309 · **zona roja de seguridad** (documentos fiscales) |

> **D3 continúa pendiente:** registrar el ID definitivo en catálogo oficial solo después de PO + Architect + resolución D4.

### Alcance de gestión fiscal

La gestión fiscal comprende, según evaluación administrativa, a:

- DJs
- Artistas
- Músicos
- MCs
- Bailarines
- Técnicos
- Proveedores independientes
- Empresas o entidades que reciban pagos de Miami DJ Beat cuando corresponda

**Política propuesta (no implementada):** Todo talento o proveedor sujeto a documentación fiscal deberá completar y obtener aprobación de la documentación aplicable **antes de recibir desembolsos**, salvo estado `not_applicable` o excepción aprobada por personal autorizado (Owner/Manager o capability legal específica).

**No se afirma** que el W-9 aplica universalmente a todas las personas y entidades sin evaluación administrativa previa.

### Documentos obligatorios

#### Artistas y talento (incl. proveedores independientes sujetos a fiscal)

| Documento | Portal primario | Staff admin |
|-----------|-----------------|-------------|
| Documentación fiscal aplicable (ej. W-9) | Artist/Provider upload | Staff validate — estado fiscal |
| Contrato artístico | Artist/Provider sign | Staff approve |
| Acuerdo comercial | Artist/Provider sign | Staff approve |
| Política de privacidad | Consent | — |
| Consentimiento de datos | Consent | Audit |
| Acuerdo de pagos | Sign | Staff link to payout gate |

#### Clientes

| Documento | Portal primario | Staff admin |
|-----------|-----------------|-------------|
| Contrato de servicio | Client sign | Staff generate |
| Facturas | Client view | Staff (MOD-306) |
| Términos y condiciones | Client accept | Version control |
| Política de cancelación | Client accept | — |
| Política de privacidad | Client accept | — |

#### Empresas / Venues

| Documento | Portal primario | Staff admin |
|-----------|-----------------|-------------|
| Contratos corporativos | Commercial client | Manager approve |
| Contratos recurrentes | Commercial client | Manager approve |
| Acuerdos comerciales | Staff + client | Owner approve |
| Documentación fiscal | Entity upload | Compliance review — tipo según evaluación |

### Estados documentales generales

Separados de la revisión fiscal. Valores documentales (sin implementar enums):

```
pending → sent → received → signed → rejected → expired → archived
```

Cada transición documental:

- Evento Event Bus (payload sin datos fiscales sensibles)
- Entrada Audit (MOD-316)
- Capability check (`staff.legal.*`, `artist.legal.*`, `client.documents.*`)

### Estados de revisión fiscal

Separados de los estados documentales generales. Valores de validación fiscal (sin implementar enums):

```
required → submitted → under_review → approved → rejected → expired → not_applicable → exception_approved
```

- `not_applicable` — sujeto evaluado; documentación fiscal no requerida.
- `exception_approved` — excepción explícita por personal autorizado; desembolso permitido con registro auditado.

### Protección comercial — defensa multicapa (anti-bypass / no elusión)

La plataforma **no puede garantizar** la prevención absoluta de toda negociación fuera de la plataforma. La arquitectura propone **defensa multicapa** para reducir elusión y bypass entre:

- artista ↔ venue
- artista ↔ cliente
- venue ↔ artista
- proveedor ↔ venue
- proveedor ↔ cliente

**Capas de defensa (diseño, no implementación):**

1. **Cláusulas contractuales** de no elusión / no bypass e intermediación MDJB.
2. **Consentimiento y aceptación versionada** (términos, políticas, acuerdos).
3. **Restricción de exposición de contactos** según rol y fase del evento.
4. **Matching y mensajería dentro de la plataforma** (MOD-307, MOD-110).
5. **Auditoría de asignación y relación comercial** (MOD-316).
6. **Procedimiento administrativo** ante incumplimientos detectados.
7. **Suspensión o bloqueo** sujeto a políticas aprobadas por PO (no automático sin governance).

**Descargo:** Las cláusulas y plantillas contractuales definitivas requieren revisión de asesoría legal competente antes de producción. Este blueprint define arquitectura y flujo; **no constituye asesoramiento jurídico**.

### Firma electrónica futura

Arquitectura preparada para:

- Proveedor e-sign (Edge function + webhook)
- Evidencia legal (timestamp, IP hash, document hash, version ID)
- Versionado de contratos (inmutable storage + MOD-404 Files)
- Historial de versiones y firmas
- Auditoría post-firma (MOD-316 + Postgres RLS)

**No implementar** hasta ticket PO + proveedor seleccionado (D6).

---

## Seguridad y privacidad de documentos legales y fiscales

**Zona roja de seguridad** — mismo nivel de rigor que invoices, payouts y permisos sensibles.

| Control | Requisito |
|---------|-----------|
| **Mínimo privilegio** | Acceso por capability; deny-by-default |
| **Almacenamiento** | Archivos privados; **nunca** públicos ni CDN abierto |
| **URLs** | Firmadas y temporales; sin links permanentes expuestos |
| **Auditoría** | Registro de visualización, descarga y cambio de estado |
| **Separación** | Metadata en DB; archivo original en storage aislado |
| **Cifrado** | Controles del proveedor de almacenamiento + políticas de acceso |
| **Retención** | Política de retención y eliminación documentada (PO + counsel) |
| **Dashboards** | Prohibido mostrar datos fiscales completos en vistas generales |
| **Staff Seller** | Sin acceso al archivo fiscal completo |
| **Revisión fiscal** | Owner/Manager o `staff.legal.*` para archivo completo |
| **Masking** | Redacción o masking de datos sensibles en UI cuando corresponda |
| **Logs / analytics / Event Bus** | Prohibido incluir datos fiscales completos en payloads |

---

## Contratos

### V1 hoy

- Contratos **no** tienen entidad dedicada.
- Términos en: lead notes, portal financial summary, production invoice/flow prints, `legal.html` estático.

### V2 objetivo

| Entidad conceptual | Owner | Storage |
|--------------------|-------|---------|
| `legal_document` | Operations Core | Supabase + MOD-404 Files |
| `legal_document_version` | LEGAL-DOMAIN-PROVISIONAL | Immutable blob + historial |
| `legal_signature` | LEGAL-DOMAIN-PROVISIONAL | Audit + e-sign provider |
| `legal_obligation` | Link to order/lead/artist/client/provider | FK a Operations Core |
| `fiscal_document_review` | LEGAL-DOMAIN-PROVISIONAL | Estados fiscales separados |

---

## Compliance

| Área | V1 | V2 target |
|------|-----|-----------|
| Documentación fiscal | Manual / ad hoc | Workflow por tipo: DJs, artistas, músicos, MCs, bailarines, técnicos, proveedores, entidades |
| W-9 / formularios | Sin sistema | Aplicable según evaluación administrativa — no universal |
| Privacy consent | Static pages | Tracked consent records per user |
| Tax documents | Staff knowledge | Estados fiscales + expiry alerts |
| Payout gate | Partial in production | Sin desembolso sin `approved`, `not_applicable` o `exception_approved` |
| Audit trail | Logs dispersos | MOD-316 Audit + Event Bus (sin datos fiscales en payload) |
| Data retention | No policy encoded | MOD-012 Storage + legal retention rules |
| Off-platform deals | Sin sistema | Defensa multicapa — ver § Protección comercial |

---

## Roadmap

Secuencia propuesta — **cada etapa requiere aprobación PO explícita.**

### Etapa 1 — Blindaje Git y baseline

| Acción | Gate |
|--------|------|
| Ticket durabilidad Git (aproximadamente 82 paths untracked, según auditoría del 2026-07-09; inventario exacto pendiente) | Lista archivos PO |
| Revalidación localhost + tests | PO visual 2026-07-09 ✅ |
| Commit infra boot/shell/config | Sin push hasta `APROBADO PUSH` |
| Actualizar `SHARED-CORE-PROGRESS.md` | Doc ticket |

**Exit:** `git clone` + `npm install` reproduce baseline LOCAL.

### Etapa 2 — Documento V1 → V2

| Acción | Gate |
|--------|------|
| **Este blueprint** — revisión y aprobación PO | TICKET-V2-MIGRATION-BLUEPRINT-001 |
| Asignar ID definitivo LEGAL-DOMAIN en catálogo | PO + Architect (D3, tras D4) |
| Resolver colisión IDs lab vs catálogo (010/011/012) | ADR PO |
| Matriz de migración priorizada por trimestre | PO roadmap |

**Exit:** PO aprueba blueprint; tickets hijos autorizados.

### Etapa 3 — Legal / Compliance

| Acción | Gate |
|--------|------|
| Spec LEGAL-DOMAIN-PROVISIONAL completa | Documentation First |
| Templates legales (PO + counsel) | Fuera de código |
| Capabilities `staff.legal.*`, `artist.legal.*`, `client.documents.*` | MOD-003 ticket |
| Workflow documentación fiscal (todos los tipos de talento/proveedor) | PO |
| E-sign provider ADR | PO (D6) |

**Exit:** Spec + PO; **sin UI** hasta Etapa 4.

### Etapa 4 — Migración funcional (por módulo)

Orden sugerido dentro de etapa:

1. MOD-001 Auth + login V2
2. MOD-005 API Client + Supabase wiring
3. Client: Bookings + Orders (reemplaza `client-portal` hub)
4. Staff: Leads + CRM (reemplaza `#leads`, `#crm`)
5. Staff: Production + Invoices (red zone — `production-module.js`)
6. Artist: Profile + Calendar
7. Artist: Cash Flow (CFMOVEMENT read-map)
8. Artist: Song4Tips (PRO gate)
9. Client/Staff: LEGAL-DOMAIN-PROVISIONAL surfaces

**Regla:** un módulo V1 se retira solo tras cutover PO + monitor window + paridad validada.

### Etapa 5 — Marketplace y operaciones

| Módulo | V1 anchor |
|--------|-----------|
| Jobs / roster | `jobs.html` |
| Rentals / Talent hub | `rentals.html` |
| Event Builder | `mdj-event-builder.js` |
| Shop | `shop.html` |
| Matching ops | admin match modal |
| Páginas omitidas auditadas | Ver matriz § Páginas V1 omitidas |

### Etapa 6 — Integración completa

| Acción | Descripción |
|--------|-------------|
| Operations Core ledger | TICKET-004 north star |
| Public site V2 o híbrido | `index.html` — último o paralelo |
| MDJPRO licensing sync | Edge + downloads |
| Academy + certification | Courses + verify |
| Retire V1 modules | Solo tras ventana estabilidad + validación PO |
| Decommission `web/` módulos | Constitución — PO only |

---

## Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|--------|---------|------------|
| R1 | Infra V2 untracked en Git (aprox. 82 paths, inventario exacto pendiente) | Pérdida baseline en clone | Etapa 1 obligatoria — P0 |
| R2 | Big bang temptation | Regresión producción | Constitución — módulo a módulo |
| R3 | Staff monolith split | Pérdida ops invoice/production | Red zone tickets + QA paralelo V1 |
| R4 | Legal gap | Exposición LLC | Etapa 3 antes de payouts V2 |
| R5 | ID collision MOD lab/catálogo | Confusión tickets | ADR numeración (D4) |
| R6 | Nav/auth regression | INCIDENT-001 repeat | Permissions + frozen shells |
| R7 | Off-platform deals | Revenue leakage | Defensa multicapa LEGAL-DOMAIN + matching gate |
| R8 | SFT PRO gate regression | Revenue + product trust | `dj_soundfortips_plan_ok` parity |
| R9 | Cash Flow conflation | Client payment ≠ DJ wallet | Product definition V1 doc |
| R10 | PO bandwidth | Slow migration | Roadmap por trimestre, no paralelo infinito |
| R11 | Exposición datos fiscales | Legal + reputacional | § Seguridad y privacidad — zona roja |

---

## Gobernanza

| Regla | Fuente |
|-------|--------|
| Alcance cerrado por ticket | Regla 11 · DECISION-V2-011 |
| Informe Técnico antes de prerrequisitos | Regla 12 |
| Mensajes commit exactos · sin trailers | Regla 13 · DECISION-V2-012 |
| Gobernanza > criterio técnico | DECISION-V2-010 |
| No push sin `APROBADO PUSH` | `no-auto-deploy.mdc` |
| No prod cutover sin `APROBADO DEPLOY PRODUCCIÓN` | Constitución |
| V1 `web/` LOCKED salvo ticket | `.cursorrules` |
| MOD-002/003 congelados | DECISION-V2-005/009 |
| Red zone: permissions, invoices, leads RLS, docs fiscales | Zona roja `.cursorrules` |

### Naturaleza de V2 — regla de sustitución

V2 conserva, cuando el PO lo determine, experiencia visual, navegación, identidad comercial y funcionalidad de V1. La arquitectura nueva es **principalmente interna** (motores, dominios, seguridad, rendimiento). Ninguna pantalla V2 reemplaza definitivamente su equivalente V1 sin comparación visual, paridad funcional, pruebas, validación PO y cutover explícito.

### Flujo por módulo migrado

```
Blueprint PO → Ticket módulo → Implementación lab → Tests + visual QA
→ Comparación V1 vs V2 → PO validación → Commit local → (APROBADO PUSH)
→ Preview Vercel → (APROBADO DEPLOY PRODUCCIÓN) → Monitor → Retire V1 módulo
```

---

## Decisiones pendientes del Product Owner

| # | Decisión | Estado | Bloquea |
|---|----------|--------|---------|
| D1 | **APROBADA** — Blueprint V1 → V2 aprobado por Product Owner el 2026-07-09 | **Aprobada** | Tickets Etapa 4+ (autorización PO por ticket; no auto-aprobados) |
| D2 | Autorización ticket Git durability (lista exacta archivos) | **Pendiente** | Reproducibilidad repo |
| D3 | Asignar **ID definitivo** del dominio Legal en catálogo oficial (hoy LEGAL-DOMAIN-PROVISIONAL / MOD-TBD) | **Pendiente** | Etapa 3 — tras D4 |
| D4 | Resolver numeración MOD-010/011/012 lab vs catálogo | **Pendiente** | Claridad tickets · prerequisito D3 |
| D5 | Prioridad trimestre: ¿Legal antes o después de Client Bookings? | **Pendiente** | Roadmap Etapas 3–4 |
| D6 | Proveedor e-sign futuro (DocuSign, Dropbox Sign, etc.) | **Pendiente** | Arquitectura firma |
| D7 | ¿Public site (`index.html`) migra en Etapa 6 o permanece V1 indefinido? | **Pendiente** | Scope public |
| D8 | `APROBADO PUSH` para baseline LOCAL a remoto | **Pendiente** | Backup equipo |
| D9 | Operations Core ledger (TICKET-004) — ¿prioridad P0 o post-Legal? | **Pendiente** | Orden Etapas 4–6 |
| D10 | Validación visual baseline localhost | **SATISFECHA** — Validación visual PO realizada el 2026-07-09 en Client, Artist y Staff. El blueprint solo modificó documentación y no alteró runtime. | — |

---

## Anexo — Validación PO 2026-07-09

Evidencia visual confirmada por Product Owner:

| Portal | URL | Confirmado |
|--------|-----|------------|
| Client | `http://localhost:5173/client/` | Shell · nav · dashboard MVP · Session/Theme/Permissions ready |
| Artist | `http://localhost:5173/artist/` | Shell · nav · dashboard MVP · DJMago305 profile · gigs |
| Staff | `http://localhost:5173/staff/` | Shell · nav · Leads sidebar · KPIs · leads pipeline |

**Nota:** `http://localhost:5173/` (raíz) no tiene `index.html` — HTTP 404 esperado. Portales activos solo en `/client/`, `/artist/`, `/staff/`.

---

*TICKET-V2-MIGRATION-BLUEPRINT-001 — APROBADO POR PRODUCT OWNER — 2026-07-09 — Documentation only — cero implementación*
