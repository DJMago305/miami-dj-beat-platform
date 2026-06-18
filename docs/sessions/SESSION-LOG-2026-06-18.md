# SESSION LOG — 2026-06-18
**Plataforma:** Miami DJ Beat LLC  
**Rama base:** `main`  
**PR mergeado a main:** `feat/pro-flow-tickets-2026-06-18` — commit `3edc85d`  
**Edge Functions deployadas:** `create-checkout` + `stripe-webhook` (producción Supabase `hkuvuqupbxwkiykxvqdr`)  
**Sesión:** 2026-06-18 02:56 — 03:45 UTC-4

---

## CONFIRMACIÓN DE ARQUITECTURA — PLANTILLAS UNIVERSALES

La plataforma opera con **3 plantillas maestras reutilizables**. Cada cuenta carga la misma plantilla de su categoría; los datos personales, plan y estado se inyectan dinámicamente desde Supabase. Arreglos hechos en una plantilla aplican a **todos los perfiles existentes y futuros** de esa categoría.

| Plantilla | Archivos maestros | Aplica a |
|---|---|---|
| **Artista** | `dj-profile.html` / `dj-dashboard.html` / `account-settings.html` | DJMago305, DJYuyo, bartenders, músicos, MCs, cualquier artista nuevo |
| **Cliente** | `client-portal.html` | Wendi, clientes actuales y futuros |
| **Staff** | `admin-dashboard.html` | Owner, manager, seller — acceso según `is_staff` / `is_staff_management` |

> Regla operativa: nunca construir perfiles uno por uno. Todo cambio en `dj-profile.html` es un cambio para el 100% de los artistas de la plataforma.

---

## TICKETS COMPLETADOS

### TICKET-ROLE-REDIRECT-002 — `web/mdj-shared-header.js`

**Problema:** Artista con `dj_profiles` era clasificado como cliente (`isClient = true`) cuando la consulta a su perfil devolvía un error de red, causando que "Mi Perfil" redirigiera a la página de cliente.

**Fix:** Se añadió `!djProfileErr` como condición adicional en la lógica de `isClient`. Solo se marca como cliente puro si no hay fila en `dj_profiles` Y la consulta no tuvo error.

**Beneficio:** El artista (DJYuyo, DJMago305, cualquier artista) siempre llega a su perfil artístico. El menú de artista se muestra correctamente desde el header.

---

### TICKET-NAV-ARTIST-003 — `web/account-settings.html`

**Problema:** El panel `#panel-account` tenía clase `active` hardcodeada en el HTML estático, causando flash visual antes de que JavaScript cargara. Además, 3 botones de upgrade PRO llamaban `mdjCheckoutPro('monthly')` directo, forzando checkout mensual sin opción de elegir periodo.

**Fix:**
- Eliminada clase `active` estática del HTML
- Los 3 CTAs de upgrade redirigen a `./dj-dashboard.html#panel-billing` (caja central de planes)

**Beneficio:** Sin flash visual al entrar a Configuración. El artista elige mensual / 6 meses / anual antes de que Stripe abra.

---

### TICKET-DJTOOLS-006 — `web/dj-tools.html`

**Problema (4 partes):**
1. Contenido PRO aparecía antes de resolver sesión (flash)
2. Artista LITE veía pantalla de bloqueo total sin poder explorar
3. No había forma de comprar PRO ni la app desde DJ Tools
4. Botón "Acceso Anticipado" apuntaba a anchor muerto `#early-access`

**Fix:**
1. **Anti-flash spinner** — `#dj-tools-gate-loader` visible mientras JS resuelve sesión; desaparece al terminar
2. **Gate LITE rediseñado** — Artista LITE ve todo el contenido; solo "Descargar MDJPRO" aparece con 🔒, deshabilitado, `pointer-events:none`
3. **Sección de planes** — Bloque `#djt-plan-section` con 3 tarjetas estilizadas (Mensual $100 / 6 meses $480 / Anual $840), badge "Mejor valor" en Anual, badges de ahorro, botón ⚡ Activar PRO Artist, línea de garantía. Conectado a `mdjCheckoutPro(billing)`
4. **Acceso Anticipado** — `onclick` llama `mdjCheckoutPro('app_monthly')` → Stripe $19.99/mes MDJPRO App standalone

**Beneficio:** Artista LITE explora DJ Tools, entiende qué desbloquea PRO, elige periodo y compra sin salir de la página. La app MDJPRO tiene su propio checkout independiente del plan PRO artístico.

---

### TICKET-PRO-CHECKOUT-004 — `web/dj-dashboard.html` + `web/dj-profile.html`

**Problema:** Links de upgrade PRO desde el perfil artístico y SoundForTips mandaban a `jobs.html` (página de TRABAJOS/reclutamiento — contexto incorrecto). El panel `#panel-billing` del dashboard no se activaba al llegar con hash `#panel-billing`.

**Fix en `dj-dashboard.html`:**
- Añadido dentro de `#panel-billing`: selector de periodo (Mensual / 6 meses / Anual) + botón ⚡ Activar PRO Artist + función `mdjCheckoutPro(billing)`
- Script de activación por hash: lee `window.location.hash` al cargar y llama `showPanel(panelId)` con `setTimeout(0)` para correr después de todos los listeners

**Fix en `dj-profile.html` (3 links):**
- Línea 5558, 6304, 6514: `./dj-dashboard.html#panel-billing` → `./dj-tools.html?mdj_nav=profile#djt-plan-section`

**Beneficio:** "Ver planes" en SoundForTips lleva directamente a la sección de compra dentro de DJ Tools (la casa natural de MDJPRO), con scroll automático. Centralizado para toda la plantilla artística.

---

### TICKET-JOBS-AUTOSELECT — `web/jobs.html`

**Problema:** Artistas que llegaban con `?plan=pro` en la URL aterrizaban en el hero de TRABAJOS sin que se preseleccionara el plan PRO.

**Fix:** `DOMContentLoaded` lee `?plan=pro` y ejecuta `selectPlan(proPortalEl, 'pro')` con delay de 500ms.

**Beneficio:** Links externos con `?plan=pro` llevan al artista directamente al plan PRO preseleccionado.

---

### TICKET-EVENTBUILDER-006A — `web/js/mdj-event-builder.js`

**Problema:** El upsert a `event_builder_orders` usaba `.catch(() => {})` — catch silencioso. El usuario veía "✓ Orden guardada" aunque la orden nunca llegara a Supabase. El staff recibía órdenes fantasma o ninguna orden.

**Fix:** Flujo cambiado a `await`:
- Si falla → `console.error` + toast de error + NO se limpia el carrito + NO se cierra el drawer
- Si funciona → toast "✓ Orden guardada para el cliente y visible en el tablero" + limpia carrito + cierra drawer

**Beneficio:** El cliente sabe si su orden se guardó. El carrito no se pierde ante errores. El staff board refleja el estado real.

---

### TICKET-BACKEND-STRIPE-SECURITY — `supabase/functions/create-checkout` + `supabase/functions/stripe-webhook`

**Problema (crítico):** `product_line` en create-checkout era siempre `mdj_artist_pro`. Una compra de MDJPRO App $19.99 hubiera convertido al artista en PRO de plataforma $100/mes — brecha de seguridad confirmada.

**Fix en `create-checkout/index.ts`:**
```
billing: app_monthly | app_annual → product_line: mdjpro_app
billing: monthly | semestral | annual → product_line: mdj_artist_pro
```

**Fix en `stripe-webhook/index.ts`:**
- Rama explícita `if (productLine === 'mdjpro_app')`:
  - Llama `supabase.rpc('mdjpro_issue_license', { p_uid: userId, p_plan_source: 'manual' })`
  - **NO toca `dj_profiles.plan`** — SECURITY WALL
  - `break` sale del switch sin ejecutar el flujo PRO Artist
- Rama `mdj_artist_pro` intacta: actualiza `dj_profiles.plan = 'PRO'` normalmente

**Beneficio:** Los dos productos están separados a nivel de webhook. Ninguna compra puede suplantar a la otra. Licencia MDJPRO App se emite automáticamente tras el pago sin requerir plan PRO activo.

**Deploy:** Ambas funciones deployadas a producción en esta sesión.

---

## PENDIENTES PARA PRÓXIMAS SESIONES

| Ticket | Descripción | Prioridad |
|---|---|---|
| STRIPE-SECRETS-CHECK | Confirmar `STRIPE_PRICE_APP_MONTHLY = price_1TjV9aDtBrAhSobylMVTFqV0` activo en Supabase Secrets | Alta |
| FASE-6B-QA | QA manual Event Builder: toast + SQL `event_builder_orders` + Staff Board | Alta |
| TICKET-COUPON-001 | Cupón primera compra $80 — crear en Stripe + secreto `STRIPE_COUPON_MONTHLY` + conectar en `create-checkout` | Media |
| TICKET-REFERRAL-001 | Códigos de referido de manager con descuento | Media |
| TICKET-COMMS-001 | Staff Communication System (notificaciones + alertas) | Estratégico |

---

## REGLAS ANTI-REGRESIÓN ESTABLECIDAS

1. **Plantillas universales** — Nunca arreglar perfiles uno por uno. `dj-profile.html` es la maqueta de todos los artistas.
2. **`product_line` en create-checkout es condicional** — No cambiar a hardcoded `mdj_artist_pro`. App purchases deben emitir `mdjpro_app`.
3. **`dj_profiles.plan` solo se toca en rama `mdj_artist_pro`** — La rama `mdjpro_app` del webhook tiene SECURITY WALL permanente.
4. **`mdjCheckoutPro(billing)` en dj-tools.html solo acepta `monthly | semestral | annual`** — Guard activo, `app_monthly` y `app_annual` están bloqueados para el selector PRO Artist.
5. **Botón "Acceso Anticipado"** — Llama `mdjCheckoutPro('app_monthly')`. No reemplazar por link estático.
6. **Catch silencioso en Event Builder prohibido** — Cualquier `upsert` a `event_builder_orders` debe ser `await` con manejo explícito de error.
7. **Hash activation en dj-dashboard.html** — El script usa `setTimeout(0)` para correr después de todos los DOMContentLoaded. No mover ni eliminar.
