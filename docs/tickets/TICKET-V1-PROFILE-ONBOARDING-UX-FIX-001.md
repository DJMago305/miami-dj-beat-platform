# TICKET-V1-PROFILE-ONBOARDING-UX-FIX-001

**Estado:** IMPLEMENTADO EN LOCALHOST — PENDIENTE DE VALIDACIÓN VISUAL PO — SIN COMMIT — SIN PUSH — SIN DEPLOY  
**Tipo:** V1 · Onboarding UX · login/signup + Jobs gate  
**Product Owner:** Gerardo A. Valle  
**Baseline:** `plan/v2-phase-4-api-client` · `92e12eaf0b7326bffe65f155bb096bec020deb20`

---

## Objetivo

Corregir la experiencia de selección y confirmación del tipo de cuenta en los flujos públicos de login/signup y Jobs, eliminando el default silencioso `talent` y exigiendo intención explícita antes de `signUp`.

---

## Causa del problema

| Causa | Evidencia previa |
|-------|------------------|
| Default silencioso `talent` | `#signup-usertype value="talent"` en `login.html` |
| Re-derivación URL → talent | `applySignupUserTypeFromUrl()` y `auth.js` signup usaban `signup=free`, `redirect=jobs`, roster o hidden como fallback |
| Jobs gate sin confirmación | `gateSignup()` enviaba `user_type: 'talent'` sin UI de intención |
| Sin confirmación previa | No existía checkbox/resumen antes de `auth.signUp` |

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `web/login.html` | Picker Cliente/Artista, resumen + checkbox, CSS, lógica URL sin default talent |
| `web/auth.js` | `mdjReadValidatedSignupUserType()` — solo `client`/`talent`; rechaza vacío/inválido; exige ack |
| `web/jobs.html` | Gate: explicación artística, checkbox confirmación, enlace a cuenta Cliente |

---

## Comportamiento anterior

- Signup neutral → `talent` implícito vía hidden input y fallbacks URL.
- `?signup=free` solo → preseleccionaba artista.
- `auth.js` re-escribía `user_type` desde query strings ignorando elección vacía.
- Jobs gate → `signUp` directo como `talent` sin confirmación.

---

## Comportamiento nuevo

### Flujo neutral (`/login.html` sin query válida)

- Ningún tipo preseleccionado.
- Dos tarjetas: **Contratar servicios** (`client`) / **Ofrecer servicios artísticos** (`talent`).
- Submit bloqueado con mensaje si falta selección o checkbox de confirmación.
- Nota: empresas/venues → comenzar como Cliente.

### Flujo Cliente (`?account=client`)

- Cliente preseleccionado visiblemente; usuario puede cambiar a Artista.
- Resumen + checkbox confirman cuenta Cliente.

### Flujo Artista/DJ (selección manual o `?user_type=talent|artist|dj`)

- Valor enviado: `talent`.
- Plan picker (LITE/PRO) visible solo con intent artístico.

### Flujo Jobs

- **login.html** con `?redirect=jobs` o roster en `sessionStorage` → preselecciona Artista + banner contextual editable.
- **jobs.html** gate → explicación + checkbox + enlace `./login.html?account=client`.
- `signUp` en gate solo tras confirmación explícita.

### Query inválida (`?user_type=foo`)

- Estado neutral; no fallback a `talent`.

### Login existente

- Sin cambios en pestaña Entrar ni recuperación de contraseña.

---

## Rutas verificadas (técnicas)

| Ruta | Esperado |
|------|----------|
| `http://localhost:8080/login.html` | Intent neutral |
| `http://localhost:8080/login.html?account=client` | Cliente preseleccionado |
| `http://localhost:8080/login.html?signup=free&user_type=talent&redirect=jobs` | Artista preseleccionado + contexto Jobs |
| `http://localhost:8080/login.html?user_type=invalid` | Neutral |
| `http://localhost:8080/jobs.html` (gate sin sesión) | Confirmación artística en gate |

---

## Validaciones realizadas

| Check | Resultado |
|-------|-----------|
| `node --check web/auth.js` | OK |
| `git diff --check` | Sin conflict markers |
| Archivos tocados | Solo los 4 autorizados |
| Signup real en Supabase | **No ejecutado** (validación interceptada en UI/auth) |
| Desktop/mobile visual | **PENDIENTE PO** |
| Console/Network PO | **PENDIENTE PO** |

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Usuarios acostumbrados al default talent | Mensaje claro + un paso extra (checkbox) |
| Roster Jobs en sessionStorage preselecciona artista en login neutral posterior | Comportamiento intencional para continuidad Jobs; usuario puede cambiar a Cliente |
| Copy solo en español en picker | Consistente con HTML hardcoded existente; i18n keys no añadidas (translations.js fuera de alcance) |

---

## Deuda no resuelta (fuera de alcance)

- Cambiar `dj_profiles.status` ACTIVE → PENDING_REVIEW en alta artística.
- Corrección de perfiles existentes (Ary DJ Productions, Aron Rosso).
- Motor de clasificación CRM.
- Traducciones EN dedicadas en `translations.js` para nuevos strings del picker.

---

## Rollback

Revertir cambios en:

- `web/login.html`
- `web/auth.js`
- `web/jobs.html`
- `docs/tickets/TICKET-V1-PROFILE-ONBOARDING-UX-FIX-001.md`

---

## Confirmaciones

- Localhost solamente
- Sin cambios de datos en producción
- Sin migraciones / RLS / Edge / backend
- Sin commit / push / deploy
- Pendiente aprobación visual PO
