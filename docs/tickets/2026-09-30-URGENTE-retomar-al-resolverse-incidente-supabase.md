# TICKET — CERRADO — Retomar apenas se resuelva el incidente de Supabase

Creado 2026-09-30 a pedido del PO. **Estado: ✅ CERRADO (confirmado 2026-10-02)** -- el incidente de Supabase se marcó resuelto el 2026-10-01 20:23 UTC ("networking partners have implemented a mitigation... significant improvement"), y los dos archivos del Paso 1 (`web/dj-profile.html`, `web/mdjb-shared-header.js`) ya fueron confirmados visualmente por el PO y comiteados el mismo día (commit `4f8bca3a`, ver `docs/ESTADO_MAESTRO.md` -- "Con esto, `dj-profile.html` queda sin cambios pendientes de confirmación visual"). El login real de Wendy se repitió con éxito muchas veces a lo largo de esa sesión y las siguientes. Dueño original: hilo maestro. Se deja el contenido original abajo como registro histórico.

## Contexto

Incidente activo de Supabase ("Intermittent latency in Eastern US", sin resolver a la fecha de creación de este ticket, confirmado en status.supabase.com y con un 504 "upstream request timeout" reproducido en vivo contra `/auth/v1/token`) dejó dos archivos sin poder confirmarse visualmente bajo la Regla 7, y bloqueó el login real de al menos una cuenta (Wendy, vendedora). Nada de esto se puede resolver con código — es infraestructura de Supabase, coordinando con sus proveedores de red.

**No ejecutar nada de lo de abajo mientras el incidente siga activo** — cualquier prueba durante la degradación no es confiable (puede "fallar" o "funcionar" al azar según el segundo exacto).

## Paso 0 — Confirmar que el incidente está resuelto de verdad

- Revisar https://status.supabase.com — el incidente "Intermittent latency in Eastern US" debe aparecer como **Resolved**, no solo "mitigado" o sin actualizaciones nuevas.
- Repetir la prueba dura ya usada hoy para confirmar (no asumir por la sola palabra del status page): request directa a `/auth/v1/token?grant_type=password` con credenciales inválidas y medir el tiempo de respuesta — debe volver en <1-2s con un error 400, no un 504 ni tardar >5s.

## Paso 1 — Confirmación visual pendiente (Regla 7), en pestaña nueva y limpia

Dos archivos siguen en el working tree, sin comitear, código ya escrito y revisado, pendientes SOLO de que el PO los vea funcionar con sus propios ojos:

1. **`web/dj-profile.html`** — arregla el "Cargando…" colgado al ver el perfil de OTRO artista (antes esperaba indefinidamente una consulta de rol del visitante bajo degradación de Supabase).
   - URL de prueba: `http://localhost:8000/dj-profile.html?dj=djmago305` (o cualquier ficha de artista real que NO sea la cuenta con la que se inició sesión, para disparar la rama "visitante ve perfil de otro").
   - Qué mirar: la ficha debe cargar en segundos, sin quedarse en "Cargando…" indefinido.

2. **`web/mdjb-shared-header.js`** — "MI PERFIL" para una cuenta de staff ya no duplica el destino/etiqueta de "⚙️ CONFIG"; apunta a `staff.html?vista=miperfil`.
   - Cómo probar: con sesión de staff (Owner o Wendy), comparar el botón "MI PERFIL" de la barra superior en cualquier página que use el header compartido — debe llevar a la ficha propia de staff, no a account-settings.html con la etiqueta "⚙️ CONFIG".

## Paso 2 — Empaquetar y PR (solo tras el Paso 1 confirmado)

- Rama nueva desde `origin/main` actualizado: `git checkout main && git pull origin main && git checkout -b fix/dj-profile-and-header-mi-perfil`.
- `git add` por archivo explícito (nunca `-A`): `web/dj-profile.html web/mdjb-shared-header.js`.
- Commit semántico, push, `gh pr create` — reportar el link del PR. **No mergear sin la palabra explícita del PO.**

## Paso 3 — Reverificar login real

- Repetir el login de Wendy (`wendy.miamidjbeat@gmail.com`) end-to-end en `localhost:8000/login.html?next=staff.html` — debe entrar sin quedarse en "VERIFYING…".

## Paso 4 — Cerrar la bitácora

- Anotar en `docs/ESTADO_MAESTRO.md` la hora real de resolución del incidente (según status.supabase.com) y el resultado de los pasos 1-3.
