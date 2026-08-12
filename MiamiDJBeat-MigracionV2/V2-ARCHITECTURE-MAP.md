# V2 Architecture Map

**Rama:** `plan/v2-artist-agenda-matrix` (local, aislada — sin push, sin PR)
**Fecha de consolidación:** 2026-08-12
**Alcance:** `/artist/`, `/client/`, `/staff/` — los 3 portales del laboratorio de migración V2

Este documento consolida la arquitectura resultante de la reestructuración por pestañas/router (MOD-206/207/208), los artefactos V2 integrados en Agenda, y la gobernanza de datos del lab, previo a la Auditoría Visual Final.

---

## 1. Estructura por pestañas / router

Los 3 portales abandonaron el patrón de "sábana" de scroll largo y adoptan navegación real, cada uno con el mecanismo más fiel a su contraparte en `ui-v1-clone/`.

### 1.1 Artist (`/artist/`) — MOD-206

**Controlador:** [`artist/tabs/artist-tab-controller.ts`](artist/tabs/artist-tab-controller.ts) — bar de botones, clic delegado, toggle `hidden` + `.is-active`. Mirror de `dj-profile.html`'s `switchProfileTab()`.
**Layout host:** [`artist/v1-artist-portal-layout.ts`](artist/v1-artist-portal-layout.ts)

| Pestaña | Label | Contenido |
|---|---|---|
| `#profile` | Mi Perfil | Perfil + Bio (slice real), Media/Fotos, Analytics/Rendimiento, **SoundForTips™** (con botón "Configurar Métodos de Pago" → conmuta a `#wallet`) |
| `#agenda` | Agenda · Gigs | Writers · Gig & Payout (mutations reales), Schedule real, **Gig Weather Radar**, **Hero Atmosférico 3D WebGL (100vh) + Matrix de Agenda** |
| `#wallet` | Ingresos · Wallet | Wallet & Earnings real (Cash Flow, Balance SSOT, Saldo Pendiente) |

Legacy `upcoming-gigs` (array hardcodeado `ARTIST_UPCOMING_GIGS`) **eliminado outright** — superseded por el slice real de Schedule.

### 1.2 Client (`/client/`) — MOD-207

**Controlador:** [`client/tabs/client-tab-controller.ts`](client/tabs/client-tab-controller.ts) — mismo mecanismo que Artist. Mirror de `client-account.html`'s `.ca-panel` + `.is-active`.
**Layout host:** [`client/render-client-dashboard-mvp.ts`](client/render-client-dashboard-mvp.ts)

| Pestaña | Label | Contenido |
|---|---|---|
| `#overview` | Perfil y Resumen | Hero + KPIs (SSOT), Perfil/Contacto/Config real, VIP, Quick Actions, Notifications, Activity |
| `#bookings` | Eventos y Reservas | Bookings real ("My Reservations & Event Flow"), `CLIENT_RECENT_ORDERS`, formularios de mutación (booking request + payment proof), Event Weather, Documents |
| `#finance` | Pagos y Finanzas | Payment Receipts real (balance SSOT), Pending Payments (nueva sección — antes solo alimentaba el KPI strip) |

Legacy `upcoming-events` (timeline `CLIENT_UPCOMING_EVENTS`) **eliminado outright** de `#bookings` — superseded por el slice real de Bookings. La constante en sí se conserva porque sigue alimentando el KPI "Active Events" del Hero.

### 1.3 Staff (`/staff/`) — MOD-208

**Controlador:** [`staff/tabs/staff-tab-controller.ts`](staff/tabs/staff-tab-controller.ts) — **router por hash** (`window.location.hash` + `hashchange`), no botones sintéticos. Mirror exacto de `admin-dashboard.html`'s `.side-link` + `hashchange`, default `#leads`.
**Layout host:** [`staff/v1-staff-ops-layout.ts`](staff/v1-staff-ops-layout.ts)

| Ancla | Label sidebar | Contenido |
|---|---|---|
| `#profile` | Perfil | Staff identity real + Operations Preview (legacy) |
| `#leads` | Leads | Tabla "Solicitudes de Clientes" (real, badge `lab mock`) + Leads Pipeline (legacy, duplicado oculto) |
| `#actividad` | Actividad | Activity Timeline |
| `#crm` | Base CRM | CRM Snapshot |
| `#djs` | Gestión de DJs | **(reparado)** Master Schedule real (calendario/asignación de DJs) + Matching Queue (legacy) |
| `#staff` | Staff | **(reparado)** Production Tasks real (absorbe el antiguo enlace `#production`) + Weather risk + Quick Actions + Notifications (legacy) |
| `#writers` | Writers · Pagos | Payment Review & Artist Assignment (mutations reales) |
| `#finance` | Finanzas | **(nuevo)** Master Financial Ledger real + Invoices Queue + Reports Preview (legacy) |

`#djs` y `#staff` no tenían panel correspondiente antes de MOD-208 (hallazgo de la auditoría pasiva de rutas); ambos quedaron reparados. `#finance` no existía como entrada de sidebar.

### 1.4 Convención común a los 3 portales

- Slots de contenido (`data-mdj-*-section="..."`) se localizan vía `querySelector` dentro de `mainRegion`/`layout.root` — **agnósticos de posición en el DOM**. Mover un slot a otra pestaña nunca rompe su slice de montaje.
- `hidden` (atributo nativo) es el primitivo de ocultamiento de panel en los 3 controladores — no `display:none` manual, no clases ad-hoc por portal.
- Secciones MVP no asignadas a ninguna pestaña por instrucción explícita permanecen con la clase `mdj-v2-lab-legacy-mvp` (`display:none!important`) heredada de rondas anteriores a MOD-206.

---

## 2. Artefactos V2 integrados

| Artefacto | Ubicación | Descripción |
|---|---|---|
| **Hero Atmosférico 3D WebGL (100vh)** | `artist/agenda-fullpage/weather-hero-engine.ts` (montado en `#agenda`) | Motor WebGL raymarcheado (cielo/sol/luna/estrellas/ciudad/montañas + lluvia/nieve/niebla/rayo), portado verbatim desde `web/weather-experience/js/hero.js`. Astronomía real vía `shared/weather-3d/`. Fallback honesto a mock si no hay Edge Function configurada. |
| **Motor climático (Matrix de Agenda)** | `artist/agenda-fullpage/render-artist-agenda-fullpage-view.ts` | "Pronóstico 10 días" (placeholder honesto — sin fuente de datos calendario-day) + "DJ Advice" (real, reutiliza `gearAdvice` del slice de Weather del propio Artist, no contenido inventado). |
| **Matrix de scroll / smooth-scroll cue** | Mismo archivo — `#agenda-matrix` | Ancla de scroll suave desde el Hero hacia el área de Matrix. |
| **SoundForTips™** | `#profile` (Artist) → botón "Configurar Métodos de Pago" enlaza a `#wallet` | App independiente ligada a configuración de pago del perfil del DJ — explícitamente NO es un módulo financiero (decisión arquitectónica del Capitán, 2026-08-12). |
| **Gig Weather Radar** | `#agenda` (Artist), justo antes del Hero WebGL | Riesgo/pronóstico real por gig (no calendario), slice real `artist/weather/`. |

---

## 3. Gobernanza de datos y SSOT

### 3.1 Capa de adaptadores in-memory

Toda mutación en los 3 portales pasa por un **adaptador local en memoria**, sin HTTP ni Supabase:

- `shared/services/client-mutations/` → `ClientMutationsAdapter` (`submitBookingRequest`, `submitOfflinePaymentProof`)
- `shared/services/artist-mutations/` → `ArtistMutationsAdapter` (`respondGigAssignment`, `acknowledgePayout`)
- `shared/services/staff-mutations/` → `StaffMutationsAdapter` (`reviewOfflinePayment`, `assignArtistToBooking`)

Cada adaptador expone `getLabRecord` / `listLabRecords` / `getIdempotencyStore` / `clearLabState` — el estado vive y muere con la sesión del navegador, nunca persiste.

### 3.2 Comportamiento aislado de las mutaciones (hallazgo de auditoría, 2026-08-12)

Confirmado mediante barrido en vivo de los 6 formularios (booking request, payment proof, gig decision, payout ack, artist assignment, payment review):

- **Feedback**: 100% inline (párrafo `aria-live="polite"`, `data-mdj-feedback="success"/"error"`), sin toasts/snackbars.
- **Sin refresh cruzado**: ningún envío exitoso refresca la lista/listado de lectura relacionada (bookings, schedule, leads) — cada slice de mutación es un adaptador aislado, por diseño (`"Results stay in the lab adapter store"`, comentario textual en el código).
- **Cobertura de mutaciones real vs. solicitada**: Client (booking + payment) y Staff (assign DJ + approve payment) cubren el 100% de los flujos pedidos. Artist solo cubre "aceptación de gigs" — **no existe** mutación de disponibilidad ni de edición de perfil en el adaptador. Staff **no tiene** mutación de estado de leads — la tabla de Leads es de solo lectura.

### 3.3 Estándar Read-Only para vistas de perfil

Las 3 vistas de perfil (`ClientProfileReadView`, `ArtistProfileReadView`, `StaffIdentityReadView`) son explícitamente de solo lectura por contrato de código — cada archivo elimina programáticamente cualquier `form`/`button[type="submit"]`/`input`/`textarea`/`select` residual antes de montar (`for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) { el.remove(); }` en el caso de Client). Ningún dato de perfil es editable desde estas vistas.

### 3.4 SSOT (Single Source of Truth)

- KPIs derivados nunca de números estáticos duplicados, sino de los mismos fixtures que consumen los slices reales (ej.: `CLIENT_VIP` y `CLIENT_PENDING_PAYMENTS` se computan desde `LAB_CLIENT_PROFILE_DEFAULT` / `LAB_CLIENT_RECEIPTS` — mismo fixture que monta `ClientProfileReadView`/`ClientFinanceReadView`, corrigiendo una divergencia real detectada en auditoría previa: el Hero afirmaba "VIP Gold" mientras el perfil real mostraba "Cliente regular").
- Cada slice real anota su fuente honestamente vía `annotateArtistMountSourceLabel`/equivalentes — badges de "lab mock" o "session-gated" visibles en pantalla, nunca disfrazados de dato en vivo.

---

## 4. Identidad universal (MDJB-ID) y atribución de origen

Regla canónica registrada por el Capitán, 2026-08-12. Estado verificado línea por línea contra el código actual — no es aspiracional donde se marca ✅, y se marca honestamente como pendiente donde no existe todavía.

### 4.1 MDJB-ID — Identificador Único Universal — ✅ implementado para los 4 roles

`mdjbId: string | null` vive en `shared/services/profiles/profiles.types.ts` como campo canónico en:

| Rol | DTO | Línea | Mostrado en UI |
|---|---|---|---|
| Client | `ClientProfileReadDTO` | `profiles.types.ts:102` | `client/profile/render-client-profile-read-view.ts:89` |
| Artist | `ArtistProfileReadDTO` | `profiles.types.ts:126` | `artist/profile/render-artist-profile-read-view.ts:87` |
| Staff | `StaffIdentityDTO` | `profiles.types.ts:180` | `staff/identity/render-staff-identity-read-view.ts:87` |
| Owner | `AccessSnapshotSuccessDTO` (snapshot de sesión, agnóstico de rol vía `role: string \| null`) | `profiles.types.ts:52` | expuesto vía `mdj_access_snapshot()` — Owner no tiene tabla de perfil propia, es una variante privilegiada de Staff en este esquema |

Confirmado en vivo esta sesión: `MDJB-TEST-0003-A` (Artist) y `MDJB-WENDY-C` (Client) renderizando correctamente en sus respectivas vistas de perfil.

### 4.2 Trazabilidad de origen (`referrerEmployeeId` / `attributionSource`) — ⚠️ registrado, NO implementado

Búsqueda exhaustiva (`referrerEmployeeId`, `attributionSource`, `referrer_employee`, `attribution_source`) en `shared/`, `artist/`, `client/`, `staff/`, `docs/` — **cero resultados**. Estos campos no existen todavía en ningún DTO, fixture, ni tabla documentada.

Queda registrado aquí como regla canónica pendiente, a la espera de autorización explícita para implementar (no se agregó a los DTOs compartidos en esta ronda — es un cambio de esquema/tipos con impacto cruzado en los 3 portales, fuera del alcance de una corrección visual):

- `referrerEmployeeId: string | null` — staff/artist que originó la referencia, cuando aplica.
- `attributionSource: 'QR' | 'Artist Referral' | 'Organic Web'` — canal de origen del lead/cliente.

**Candidato de ubicación futura:** ambos campos encajarían naturalmente en `ClientProfileReadDTO` (junto a `sourceRef`, que ya existe como campo de origen genérico en `profiles.types.ts:98` y podría ser el precursor directo de `attributionSource`).

---

## 5. Estado de pruebas

| Verificación | Resultado |
|---|---|
| `npx vitest run` | **116/116 archivos · 1,429/1,429 tests passing (100%)** |
| `npx tsc --noEmit` | 8 errores preexistentes no relacionados (funciones factory sin uso en `artist/render-artist-dashboard-mvp.ts` y `staff/render-staff-dashboard-mvp.ts`, ninguno introducido por MOD-206/207/208) |
| E2E (`tests/e2e/scaffold.spec.ts`) | Actualizado para reflejar el nuevo sistema de pestañas (clic explícito antes de aserciones `toBeVisible()` en paneles no-default). Hallazgo pasivo no corregido: 3 secciones legacy (`leads-pipeline`, `invoices-queue`, `matching-queue`) están ocultas por `mdj-v2-lab-legacy-mvp` desde antes de esta ronda — sus aserciones de visibilidad en el e2e ya fallaban previamente, no es una regresión de esta reestructuración. |

---

## 6. Historial de commits de esta consolidación

Todos locales, aislados en `plan/v2-artist-agenda-matrix`, sin push ni PR:

```
10bd18e refactor(v2-staff): implement hash router for sidebar + fix broken #djs & #staff links + add #finance panel
12f1db4 refactor(v2-client): implement tab navigation system + distribute profile, bookings & finance modules
36b10ce refactor(v2-artist): relocate Agenda 3D Hero, Schedule & Wallet into tabs + add SoundForTips payment link
25b991a feat(v2-artist): tab navigation system + unhide full profile sections & gig weather radar
```

---

## 7. Pendientes conocidos (no bloqueantes para la Auditoría Visual Final)

- Mutación de disponibilidad y edición de perfil para Artist — no existe adaptador.
- Mutación de estado de leads para Staff — no existe adaptador.
- Refresh cruzado post-mutación (listas de lectura) en los 3 portales — arquitectura intencionalmente aislada, no cableada.
- `referrerEmployeeId` / `attributionSource` (§4.2) — regla canónica registrada, campos no implementados en los DTOs compartidos.
