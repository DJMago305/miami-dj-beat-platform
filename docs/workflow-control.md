# Protocolo de control de trabajo (MDJB)

Objetivo: **menos accidentes** entre desarrollo local, Git y producción (Vercel + Supabase).

La regla automática para asistentes IA está en [`.cursor/rules/workflow-control.mdc`](../.cursor/rules/workflow-control.mdc). Este documento amplía el checklist para personas.

---

## 0. Alcance pactado (Capitán + Arquitecto)

- **Capitán:** define *qué* se pide (producto). **Arquitecto:** define *dónde* puede tocarse el código sin romper el resto.
- Cada tarea debe nombrar **zona permitida** (p. ej. “solo bloque X en `jobs.html`”). Fuera de eso: **sin cambios**, salvo ampliación explícita del ticket.
- **Protección de UI ya cableada:** botones, header (login/logout), formularios de pago y auth no se reescriben “por coherencia”; solo se tocan si el ticket lo incluye y se valida el comportamiento.

---

## 1. Cierre de tarea (Definition of Done)

| Paso | Acción |
|------|--------|
| Código | Cambios acotados al alcance acordado; respetar `.cursorrules` (locked files). |
| Git | `git status` limpio o commit local; push solo con **`APROBADO PUSH`**; prod solo con **`APROBADO DEPLOY PRODUCCIÓN`** tras preview OK. |
| Deploy | En Vercel: deployment **Ready** del commit correcto (solo tras aprobación explícita; ver §7). |
| Caché | Probar producción con recarga forzada o ventana privada si el fix “no se ve”. |

---

## 2. Auth, header y sesión

- **`#header-login-btn`** y **`#header-login-btn-mobile`**: `auth.js` y `mdjb-shared-header.js` los reutilizan como **Logout** con `doLogout`. **No** ocultarlos con estilos inline si hay sesión sin ofrecer otra salida clara (p. ej. menú cuenta).
- **`login.html`**: cuidado con `onAuthStateChange` + `redirect=` — no expulsar a invitados al hidratar sesión; ver implementación actual ( `INITIAL_SESSION` vs `SIGNED_IN` + `getSession()` ).
- **Logout global**: `window.doLogout` en `mdjb-shared-header.js`; debe poder ejecutarse y recargar / limpiar storage según corresponda.

---

## 3. Rutas y hosting

- Repo: HTML estático bajo **`web/`**.
- Si Vercel usa **Root Directory = `web`**, las URLs públicas son **`https://dominio/pagina.html`**, no `/web/pagina.html`.
- Revisar `fetch` a `.../functions/v1/...` y cuerpos JSON (`successUrl`) al depurar checkout.

---

## 4. Supabase

- **Migraciones** en `supabase/migrations/`: aplicar en el proyecto remoto (CLI o SQL) cuando toquen datos o RLS.
- **Edge Functions** (p. ej. `create-checkout`): código en repo ≠ desplegado hasta **deploy** de funciones; secretos (`STRIPE_*`, `SITE_URL`, etc.) en el dashboard del proyecto.

---

## 5. Incidentes de referencia (aprendizajes)

1. Botón de logout invisible en Jobs por `display:none` en el control compartido con “Logout”.
2. Mezcla local/prod por commits no pusheados.
3. Paths `/web/...` en cliente incompatibles con sitio servido en raíz.
4. Respuestas de checkout sin manejar HTTP error → UX “no hace nada”.

---

## 6. Roles sugeridos (equipo ligero)

| Rol | Responsabilidad |
|-----|------------------|
| **Implementación** | Cambios en repo según ticket; PR/commit claro. |
| **Revisión rápida** | Auth + header + un flujo crítico (login/logout/jobs o checkout) antes de merge urgente. |
| **Deploy** | Confirmar Vercel + secretos Supabase si el cambio toca backend. |

No sustituye CI/CD completo; reduce regresiones obvias en un sitio estático con muchas páginas compartidas.

---

## 7. Gate de deploy (sin automatización)

**Regla máxima:** construir no es desplegar.

Ningún agente ni implementador debe subir cambios a remoto ni producción sin autorización explícita del **Capitán** (producto) en el ticket o en el chat de la tarea.

### Prohibido sin orden literal

| Acción | Requiere |
|--------|----------|
| `git push` (cualquier rama) | Texto exacto: **`APROBADO PUSH`** |
| Merge a `main` / producción / deploy Vercel / secretos Supabase en prod | Texto exacto: **`APROBADO DEPLOY PRODUCCIÓN`** |
| Cambios fuera del alcance pactado | Ampliación escrita del ticket (Capitán + Arquitecto) |
| Tocar archivos no listados en el ticket | **OK** explícito con lista de archivos |

Variantes ambiguas («sube cuando puedas», «deploya», «publícalo») **no** sustituyen las frases anteriores.

### Flujo obligatorio por tarea

1. **Diagnóstico** — causa raíz, sin parches a ciegas.
2. **Lista exacta de archivos** autorizados — esperar **OK** del Capitán.
3. **Cambio mínimo** — solo zona pactada; respetar `.cursorrules` y archivos LOCKED.
4. **Reporte** — archivos tocados, `git diff --stat`, BEFORE/AFTER, instrucciones de **rollback**.
5. **QA local** — hard refresh; flujo crítico según ticket (header/auth/checkout si aplica).
6. **Commit** — solo con autorización explícita del Capitán.
7. **Push** — solo tras **`APROBADO PUSH`** (autorización separada del commit).
8. **Merge / deploy producción** — solo tras **`APROBADO DEPLOY PRODUCCIÓN`**, y **después** de validar preview (Vercel Preview o entorno acordado).

### Producción

- Producción = `origin/main` desplegado en Vercel **Ready** + backend remoto si el ticket lo incluye.
- **No** asumir que «está en el Mac» = producción.
- Tras deploy: recarga forzada o ventana privada antes de dar por cerrado.

### Referencia para agentes IA

Regla automática: [`.cursor/rules/no-auto-deploy.mdc`](../.cursor/rules/no-auto-deploy.mdc).
