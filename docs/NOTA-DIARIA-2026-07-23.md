# Nota Diaria — 2026-07-23

Registro operativo del día — V1 Profile onboarding, Employment intent, inspección read-only remota.

**Rama:** `plan/v2-phase-4-api-client`  
**HEAD al cierre:** `cc1969c502ae78124a79e175d5dae586aa8334f1` — `docs(profile): record read-only inspection findings`

---

## Onboarding

**Ticket:** TICKET-V1-PROFILE-ONBOARDING-UX-FIX-001  
**Commit:** `a787220` — `feat(auth): improve onboarding account intent selection`

### Trabajo completado

| Área | Resultado |
|------|-----------|
| Selector de intención | Picker explícito Cliente / Artista en `login.html`; sin default silencioso `talent` |
| Creación silenciosa | Eliminada: hidden `user_type=talent`, fallbacks URL y re-derivación en `auth.js` sin ack |
| Selección manual | Preservada al cambiar pestañas y al navegar con query params válidos; usuario puede corregir preselección |
| Jobs gate | Checkbox de confirmación artística antes de `signUp` en `#auth-gate` |
| Validación PO | Validación visual del Product Owner — **aprobada** |

### Archivos (runtime — ya commiteados)

- `web/login.html`
- `web/auth.js`
- `web/jobs.html` (gate únicamente)

### Documentación

- `docs/tickets/TICKET-V1-PROFILE-ONBOARDING-UX-FIX-001.md`

---

## Employment Signup

**Ticket:** TICKET-V1-JOBS-EMPLOYMENT-ACCOUNT-INTENT-FIX-001  
**Commit:** `07785ae` — `feat(jobs): improve employment account intent flow`

### Trabajo completado

| Área | Resultado |
|------|-----------|
| Confirmación explícita | Bloque `#employment-artist-intent-block` + checkbox `#employment-artist-intent-ack` antes de `auth.signUp()` |
| Selector de estado real | `#job-state` (`<select>` US) en employment; `#signup-address-state` corregido en login (Safari `menulist`) |
| Banner redundante | Eliminado `#mdj-signup-intent-context` (“Llegaste desde Jobs…”) de `login.html` |
| Cliente autenticado | `jobsEmploymentBlockSilentClientArtist()` bloquea upsert artístico silencioso si `client_profiles` ∧ ¬`dj_profiles` |
| Safari | Selector de estado validado en Safari |
| UX PO | **Aprobada** |

### Visual Correction Pass 001 (mismo commit)

- Estados desde `window.MDJ_US_STATES` (`account-address-data.js`)
- Validación `submitProForm()` para `#job-state`

### Archivos (runtime — ya commiteados)

- `web/jobs.html`
- `web/login.html` (selector estado signup + retiro banner)

### Documentación

- `docs/tickets/TICKET-V1-JOBS-EMPLOYMENT-ACCOUNT-INTENT-FIX-001.md`

---

## READ ONLY PROFILE INSPECTION

**Ticket origen:** TICKET-V1-PROFILE-DATA-RECONCILIATION-001 (discovery)  
**Inspección remota:** pasada anterior autorizada — solo SELECT, sin cambios remotos.

| Campo | Valor |
|-------|--------|
| Proyecto Supabase | `hkuvuqupbxwkiykxvqdr` |
| Método | `supabase db query --linked` |
| Operaciones | Solo SELECT |
| Cambios remotos | **Ninguno** |

### Distribución (Q15 — 15 auth users)

| Bucket | Cantidad |
|--------|----------:|
| ARTIST_ONLY | 6 |
| CLIENT_ONLY | 3 |
| DUAL | 4 |
| MISSING | 2 |

### Casos prioritarios PO

| Usuario | Clasificación | Conclusión |
|---------|---------------|------------|
| **Ary DJ Productions** (`741a2a8a-138a-4c5b-9ed2-6e9e522c07f6`) | **CLIENT_ONLY** | JWT `client`, `client_profiles` presente, sin `dj_profiles`, MDJB `MDJB-48AC-5FC3-C` |
| **Aron Rosso** (`4bf2cf75-9e4f-49b0-8b30-b8b0a9986da4`) | **ARTIST_ONLY** | JWT `talent`, `dj_profiles` ACTIVE, sin `client_profiles`, MDJB `MDJB-BCBE-FF67-A` |

### Consultas adicionales (pasada remota)

| Consulta | Resultado |
|----------|-----------|
| Q8 EMPTY_DJ | 0 |
| Q2 Dual profiles | 4 (owner/Gerardo, DJMago305, DJYuyo, Alexander Reyes) |
| Q6 JWT `client` + `dj_profiles` | 2 |
| Q7 JWT `talent` + solo `client_profiles` | 0 |
| Q3 Sin ningún perfil | 2 (`perezshakira97@gmail.com`, `gerardoa4@hotmail.com`) |
| Q5 Client huérfano | 0 |
| Q10 Emails duplicados | 0 |

### Conclusión

1. **El CRM clasifica correctamente** según datos persistidos (`client_profiles` / `dj_profiles` / JWT).
2. La deuda es **histórica** y proviene del **flujo de alta anterior** (default silencioso `talent` / employment sin confirmación).
3. Clasificación documentada: **`HISTORICAL SIGNUP INTENT MISALIGNMENT`** — no es error de heurística CRM posterior.
4. Fixes `a787220` y `07785ae` protegen **altas futuras**; no corrigen registros históricos.

### Limitaciones

Pooler remoto: circuit breaker temporal tras consultas consecutivas. Pendiente en pasada futura read-only: detalle Q6, export Q1, Q13, Q14, `identity_audit_contradictions.sql`. No invalida hallazgos principales.

---

## Documentación creada

| Ticket | Archivo | Commit |
|--------|---------|--------|
| TICKET-V1-PROFILE-READONLY-DATA-INSPECTION-001 | `docs/tickets/TICKET-V1-PROFILE-READONLY-DATA-INSPECTION-001.md` | `cc1969c` — `docs(profile): record read-only inspection findings` |

Estado del ticket: **READ-ONLY REMOTE INSPECTION COMPLETE** — reconciliación **no autorizada**.

---

## Commits locales del día

| # | Hash | Mensaje |
|---|------|---------|
| 1 | `a787220` | `feat(auth): improve onboarding account intent selection` |
| 2 | `07785ae` | `feat(jobs): improve employment account intent flow` |
| 3 | `cc1969c` | `docs(profile): record read-only inspection findings` |

---

## Estado del repositorio

| Item | Estado |
|------|--------|
| Working tree | **Limpio** (baseline verificado al inicio de cierre de jornada) |
| Push | **NO** |
| PR | **NO** |
| Deploy | **NO** |

---

## Próximo trabajo

**TICKET-V1-PROFILE-RECONCILIATION-PLAN-001**

| Campo | Valor |
|-------|--------|
| Autorización | **No autorizado aún** |
| Alcance | Solo planificación / dry-run documental |
| Prohibido | Reconciliar datos, INSERT/UPDATE/DELETE remoto, migraciones, runtime |

Alcance esperado del plan (cuando PO autorice):

- Definir fuente de verdad
- Revisar Ary y Aron
- Clasificar 2 MISSING
- Revisar 4 DUAL caso por caso
- Matriz before/after + rollback
- **Sin** ejecutar cambios remotos

---

## Cierre de jornada

**TICKET-V1-END-OF-DAY-DOCUMENTATION-2026-07-23-001**

- Documentación de cierre actualizada (este archivo)
- Sin modificación de código fuente en esta pasada
- Sin consulta Supabase en esta pasada
- Sin commit / push / PR / deploy en cierre EOD

### Próxima sesión (obligatorio al inicio)

1. `git branch --show-current` + `git rev-parse HEAD` + `git status --short`
2. Lectura de esta nota y tickets V1 profile abiertos
3. Esperar autorización PO antes de abrir reconciliación o tocar runtime

---

## Sin tocar (esta jornada EOD)

- Supabase schema / migraciones / Edge
- CRM runtime / admin-dashboard
- Header / Nav global
- V2 laboratorio (salvo índice documental)
