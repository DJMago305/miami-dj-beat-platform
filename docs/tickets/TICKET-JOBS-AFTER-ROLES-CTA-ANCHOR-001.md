# TICKET-JOBS-AFTER-ROLES-CTA-ANCHOR-001
## Jobs — "Crea tu cuenta" anchor href="#" rebota al top sin preventDefault

**Estado:** ABIERTO  
**Prioridad:** MEDIA  
**Archivo afectado:** `web/jobs.html`  
**Fecha:** 2026-06-23  
**Detectado en:** MODO FORENSE / Debug JS Click Handlers  

---

## Problema

En `web/jobs.html`, el enlace "Crea tu cuenta" (`#jobs-after-roles-cta`, L2297) se convierte en `href="#"` cuando el usuario está logueado (`updateJobsAfterRolesCta()` L3014). Si el usuario hace click y el `data-jobs-cta-mode` no es exactamente `'account'` ni `'signup'` (por race condition o modo inesperado), ninguna rama del listener llama a `e.preventDefault()`, y el browser navega al anchor `#` → **scroll nativo al top de la página** ("rebotar al principio").

---

## Causa raíz

### Flujo del listener (L3108–3123)

```javascript
el.addEventListener('click', function (e) {
    var mode = el.getAttribute('data-jobs-cta-mode');
    if (mode === 'account') {
        e.preventDefault();
        void jobsAfterRolesCtaAccountNavigate();
        return;
    }
    if (mode === 'signup') {
        var href = ...;
        e.preventDefault();
        window.location.assign(href);
    }
    // ← Si mode no es 'account' ni 'signup': SIN e.preventDefault()
    // → href="#" dispara scroll al top
});
```

### Cuándo ocurre el modo inesperado

| Escenario | `data-jobs-cta-mode` | Resultado |
|---|---|---|
| Antes de `updateJobsAfterRolesCta()` | `signup` | ✅ Controlado |
| Después de `updateJobsAfterRolesCta()` con sesión | `account` | ✅ Controlado |
| Race condition: href ya es `#` pero mode no fue seteado aún | `signup` con `href="#"` | Navega a login (fallback JOBS_GUEST_SIGNUP_URL) |
| `data-jobs-cta-mode` ausente o valor inesperado | `null` / otro | ❌ **Sin preventDefault → scroll top** |

### Fuente de scroll confirmada adicionalmente

`activatePlan()` (L3848) llama `window.scrollTo({ top: 0, behavior: 'smooth' })`. Este scroll es **intencional** (muestra el formulario que aparece arriba), pero puede confundirse con el bug del anchor.

---

## Problema adicional en scope (mismo archivo, misma función)

`updateJobsAfterRolesCta()` L3017–3021 no incluye `'owner'` en la guardia de roles staff:

```javascript
} else if (role === 'admin' || role === 'manager' || role === 'seller') {
    key = 'jobs-after-roles-cta-staff-panel';
}
// 'owner' cae al bloque artista — incorrecto para el Capitán/owner
```

Para DJMago305 (owner), el CTA se comporta como si fuera un artista en lugar de staff. No es un crash, pero produce UX incorrecta.

---

## Patch mínimo propuesto

**Archivo:** `web/jobs.html`  
**Líneas:** 3108–3123 (listener del CTA)  
**Cambio 1:** Agregar safety `e.preventDefault()` al final del listener.  
**Cambio 2:** Agregar `'owner'` a la guardia de roles staff.

### Cambio 1 — Safety net `e.preventDefault()` (L3122 aprox)

```javascript
// ANTES:
el.addEventListener('click', function (e) {
    var mode = el.getAttribute('data-jobs-cta-mode');
    if (mode === 'account') { e.preventDefault(); void jobsAfterRolesCtaAccountNavigate(); return; }
    if (mode === 'signup') { ... e.preventDefault(); window.location.assign(href); }
});

// DESPUÉS:
el.addEventListener('click', function (e) {
    var mode = el.getAttribute('data-jobs-cta-mode');
    if (mode === 'account') { e.preventDefault(); void jobsAfterRolesCtaAccountNavigate(); return; }
    if (mode === 'signup') { ... e.preventDefault(); window.location.assign(href); return; }
    e.preventDefault(); // safety: nunca dejar href="#" navegar nativo al top
});
```

### Cambio 2 — Owner en guardia staff (L3020)

```javascript
// ANTES:
} else if (role === 'admin' || role === 'manager' || role === 'seller') {

// DESPUÉS:
} else if (role === 'admin' || role === 'manager' || role === 'seller' || role === 'owner') {
```

---

## Alcance y prohibiciones

**Autorizado (cuando el Capitán apruebe):**
- `web/jobs.html` — únicamente las dos líneas descritas arriba

**Prohibido:**
- No tocar `create-checkout`
- No tocar Stripe / Supabase schema
- No tocar `jobsStartProStripeCheckout()`
- No tocar header / nav / `mdj-shared-header.js`
- No tocar `account-settings.html`, `dj-profile.html`, `find-dj.html`
- No commit sin orden del Capitán
- No push sin `APROBADO PUSH`
- No deploy sin `APROBADO DEPLOY PRODUCCIÓN`

---

## Criterios de éxito (QA)

1. Logueado como artista LITE → click en "Crea tu cuenta" → NO scroll al top → navega correctamente.
2. Logueado como owner (DJMago305) → CTA muestra texto de staff, no de artista.
3. Guest → click en "Crea tu cuenta" → redirige a `login.html?signup=free...`.
4. `activatePlan()` → scroll al top intencional sigue funcionando (no regresión).
5. `git diff --stat` muestra solo `web/jobs.html` con ≤3 líneas cambiadas.

---

## Riesgo

| Factor | Valor |
|---|---|
| Archivos tocados | 1 (`web/jobs.html`) |
| Líneas cambiadas | ≤3 |
| Riesgo de regresión | BAJO — cambio defensivo, no altera lógica de negocio |
| Impacto en checkout | NINGUNO |
| Impacto en nav/header | NINGUNO |
