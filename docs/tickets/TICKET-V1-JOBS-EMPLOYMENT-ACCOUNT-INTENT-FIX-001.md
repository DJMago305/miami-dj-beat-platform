# TICKET-V1-JOBS-EMPLOYMENT-ACCOUNT-INTENT-FIX-001

**Estado:** IMPLEMENTADO EN LOCALHOST — PENDIENTE DE VALIDACIÓN VISUAL PO  
**Tipo:** V1 · Jobs · Employment form · account intent gate  
**Product Owner:** Gerardo A. Valle  
**Baseline:** `plan/v2-phase-4-api-client` · `a787220d5ef92776e43edfbec6ba76ae367327bb`  
**Relacionado:** TICKET-V1-PROFILE-ONBOARDING-UX-FIX-001 · TICKET-V1-PROFILE-DATA-RECONCILIATION-001 (H-01 / MED-002)

---

## Hallazgo H-01 / MED-002

| Campo | Detalle |
|-------|---------|
| **Severidad** | HIGH |
| **Ubicación** | `web/jobs.html` — `submitProForm()` / formulario `#employment-form` |
| **Síntoma** | Tras el fix del gate principal, el formulario employment seguía llamando `auth.signUp()` con `user_type: 'talent'` sin confirmación explícita de intención artística. |
| **Impacto** | Cuentas artísticas/profesionales creadas involuntariamente desde el flujo de solicitud de empleo. |

---

## Causa

El ticket anterior (onboarding UX) cerró el gate `#auth-gate` (`gateSignup`) pero dejó intacto el camino paralelo del formulario largo `#employment-form`, que crea cuenta + upsert `dj_profiles` (`status: PENDING_REVIEW`) en un solo envío.

---

## Flujo afectado

1. Usuario invitado completa carrusel de roles → activa plan → `#pro-form-section`.
2. Rellena `#employment-form` (identidad, contraseña, roles, foto, redes).
3. Clic en `#pro-submit-btn` → `submitProForm()`.
4. **Antes:** validación de campos → `auth.signUp({ user_type: 'talent' })` → upsert `dj_profiles`.
5. **Ahora:** validación de campos → **gate de intención artística** → `signUp` solo si checkbox confirmado.

---

## Comportamiento anterior

- Sin explicación visible de que se crearía cuenta artística.
- Sin checkbox de confirmación.
- `user_type: 'talent'` en `signUp` inmediato tras validar contraseña.
- Usuario autenticado como Cliente (`client_profiles` sin `dj_profiles`) podía recibir upsert artístico silencioso.

---

## Comportamiento nuevo

### A. Usuario no autenticado

- Bloque `#employment-artist-intent-block` visible (explicación + checkbox `#employment-artist-intent-ack`).
- Error dedicado `#employment-artist-intent-error` si falta confirmación.
- Enlaces visibles:
  - `./login.html?redirect=jobs` — iniciar sesión
  - `./login.html?account=client` — crear cuenta Cliente
- `auth.signUp()` **no** se ejecuta hasta marcar el checkbox.
- Payload tras confirmación mantiene `user_type: 'talent'` (sin cambio de contrato Supabase).

### B. Usuario autenticado

- Bloque de intención oculto; **no** se llama `auth.signUp()`.
- Flujo de upsert conservado para perfiles artísticos existentes o usuarios sin fila `client_profiles`.
- **`jobsEmploymentBlockSilentClientArtist()`:** consulta Postgres (`client_profiles` + `dj_profiles` por `user_id`). Si hay Cliente y no hay DJ → detiene el envío con mensaje explícito (no provisiona perfil artístico silenciosamente).
- Clasificación basada en filas DB, no en DOM manipulable.

### C. Estado y repetición

- Checkbox se reinicia al abrir el formulario (`activatePlan`) y al ocultar el bloque (sesión activa).
- Error se limpia al marcar el checkbox (`change` listener).
- Guard `submitBtn.disabled` evita doble envío.
- Botón se restaura en errores de Supabase (signup o upsert) — patrón existente preservado.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `web/jobs.html` | UI intent employment, helpers JS, validación pre-signUp, bloqueo Cliente silencioso pre-upsert |
| `docs/tickets/TICKET-V1-JOBS-EMPLOYMENT-ACCOUNT-INTENT-FIX-001.md` | Este documento |

**No modificados (por alcance IMPLEMENTATION PASS):** `auth.js`, Supabase, migraciones, RLS, CRM.

**Modificados además en VISUAL CORRECTION PASS 001:** `web/login.html` (selector estado signup + retiro mensaje Jobs).

---

## Visual Correction Pass 001

**Estado:** IMPLEMENTADO EN LOCALHOST — PENDIENTE DE VALIDACIÓN VISUAL PO

### Hallazgo 1 — Selector «Estado o provincia» (Safari)

| Campo | Detalle |
|-------|---------|
| **Síntoma PO** | El control no abría menú de estados; parecía desplegable pero no funcionaba. |
| **Causa** | En signup (`login.html`) el campo era `<input type="text">` con placeholder `FL`, visualmente igual al `<select>` de país adyacente. En Employment (`jobs.html`) no existía selector dedicado (ciudad combinaba «Miami, FL» en un solo input). |
| **Tipo antes** | Texto libre (`input`) / sin campo state en employment. |
| **Tipo después** | `<select>` nativo poblado desde `window.MDJ_US_STATES` (`account-address-data.js`), formato `Florida (FL)`, default `FL`, `-webkit-appearance: menulist` en Safari. |
| **Employment** | Nuevo `#job-state` en `#employment-form`; validación en `submitProForm()`; valor enviado = código `FL`, `GA`, etc. (compatible con contrato actual de dirección). |
| **Signup login** | `#signup-address-state` → `<select>` US; texto libre `#signup-address-state-intl` si país ≠ United States (id conmutable para `auth.js` sin modificarlo). |

### Hallazgo 2 — Mensaje contextual Jobs redundante

| Campo | Detalle |
|-------|---------|
| **Texto eliminado** | «Llegaste desde Jobs: este registro crea o activa tu perfil artístico…» |
| **Causa** | Duplicaba la elección ya visible en tarjetas Cliente / Artista. |
| **Solución** | Eliminado `#mdj-signup-intent-context` del markup y la lógica en `mdjUpdateSignupIntentConfirmBlock()`. |
| **Conservado** | Preselección Artista con `?redirect=jobs`; tarjetas; checkbox final; selección manual (`mdjSignupIntentManuallySelected`); hidden `#signup-usertype`; sin default silencioso. |

### Validaciones (pass 001)

| Caso | Resultado |
|------|-----------|
| A — Employment state Safari | PASS por código: `<select>` nativo + `MDJ_US_STATES`; PO revalidación visual pendiente |
| B — `login.html?redirect=jobs` | PASS por código: sin mensaje Jobs; Artista sugerido vía URL |
| C — `login.html` neutral | PASS por código: sin mensaje contextual |
| D — `login.html?account=client` | PASS por código: Cliente preseleccionado; sin mensaje Jobs |
| E — Mobile | PENDIENTE PO visual |

### Archivos tocados (pass 001)

| Archivo | Cambio |
|---------|--------|
| `web/jobs.html` | `#job-state` select + `jobsInitEmploymentStateSelect()` + script `account-address-data.js` |
| `web/login.html` | Select US/intl state, init sync, CSS Safari; retiro mensaje Jobs |
| `docs/tickets/TICKET-V1-JOBS-EMPLOYMENT-ACCOUNT-INTENT-FIX-001.md` | Esta sección |

---

## Casos de prueba

| # | Caso | Esperado | Verificación |
|---|------|----------|--------------|
| 1 | Employment sin sesión, sin confirmar | Signup bloqueado, error visible, sin `signUp` | Código + PO visual |
| 2 | Employment sin sesión, confirmado | Flujo continúa; payload `user_type: 'talent'` | Revisión de código (~L5020) |
| 3 | Enlace Cliente | `./login.html?account=client` | Enlace estático en bloque intent |
| 4 | Iniciar sesión | `./login.html?redirect=jobs` | Enlace estático; no auto-signup |
| 5 | Usuario autenticado Cliente | Sin `signUp`; upsert bloqueado si `client_profiles` ∧ ¬`dj_profiles` | Código `jobsEmploymentBlockSilentClientArtist` |
| 6 | Doble envío | Botón disabled durante operación | Guard + disabled en handler |
| 7 | Error Supabase | Botón rehabilitado | Patrón existente en ramas de error |
| 8 | Mobile | Bloque legible, sin overflow | PO visual localhost |

---

## Limitaciones

- Validación runtime de Network tab no ejecutada con cuenta real en esta pasada (evitar altas innecesarias). Payload `user_type: 'talent'` confirmado por inspección de código post-checkbox.
- Usuario Cliente autenticado que **ya** tenga `dj_profiles` puede actualizar vía employment (comportamiento previo conservado).
- No se reconcilian cuentas históricas creadas antes de este fix.

---

## Deuda histórica no corregida

- Perfiles artísticos creados involuntariamente vía employment **antes** de este ticket permanecen en base; requiere ticket de reconciliación separado (`TICKET-V1-PROFILE-DATA-RECONCILIATION-001` / inspección remota autorizada).
- Ary DJ Productions / Aron Rosso: fuera de alcance.

---

## Relación con reconciliación de perfiles

Este ticket **solo** impide nuevas creaciones silenciosas. La corrección de datos históricos, auditoría Q1–Q15 y SELECT remoto requieren autorización explícita del PO en ticket dedicado.

---

## Rollback

Revertir únicamente los cambios en `web/jobs.html` de este ticket (bloque HTML + funciones `jobsResetEmploymentArtistIntent`, `jobsSyncEmploymentArtistIntentVisibility`, `jobsEmploymentBlockSilentClientArtist`, validación en `submitProForm`).

---

## Confirmaciones de entrega

- Sin datos modificados en Postgres remoto
- Sin commit / push / deploy
- HEAD sin mover: `a787220d5ef92776e43edfbec6ba76ae367327bb`
