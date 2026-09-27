# TICKET CONSOLIDADO — Hallazgos del worktree `dj-profile-engine-hardening`
Creado 2026-09-27 a pedido del PO. Fuente: `.worktrees/dj-profile-engine-hardening` (rama `fix/dj-profile-engine-hardening`, sin comitear desde el 13 de septiembre; worktree y rama siguen vivos, sin tocar).

## ⚠️ CORRECCIÓN 2026-09-27 (mismo día) — el diagnóstico original de este ticket estaba mal
La primera versión de este ticket afirmó, como "bug P0 confirmado hoy en producción", que `find-dj.html` seguía consultando `public_dj_profiles` (sin filtro de elegibilidad) y por eso exponía la cuenta de prueba `DJ PRO TEST`. **Eso era falso.** El error: verifiqué las vistas de la base de datos por SQL directo, pero nunca leí el `find-dj.html` real antes de concluir la causa raíz.

Al leer el archivo actual para reintegrar el arreglo del worktree, encontré que **ese arreglo exacto ya está en `main` desde el 23 de septiembre** — commit `6676b4f9` *"fix(find-dj): conectar el buscador a la Public Talent Projection"*, cuyo propio mensaje cita textualmente: *"eso dejaba pasar cuentas de prueba e incompletas a la búsqueda pública en vivo (confirmado: 'DJ PRO TEST' aparecía con botón de reserva activo)"* — es decir, otra sesión ya encontró y cerró este mismo hallazgo del documento de auditoría, 4 días antes de que yo lo "redescubriera" hoy. `find-dj.html` en producción ya consulta `public_dj_talent`, ya usa `canonicalHref()`/`renderResultCardHTML()` de `find-dj-search.mjs`, y ya enlaza siempre a `/dj/<slug>.html`.

**Consecuencia real:** la cuenta `DJ PRO TEST` que borré de producción (ver más abajo) era un resto huérfano en la tabla base — su borrado estuvo bien igual (cero referencias en 10 tablas, limpieza correcta), pero **no estaba realmente expuesta en el buscador en vivo en el momento en que la borré**, como afirmé entonces. DEF-01/DEF-02/DEF-03 (los 3 P0 del documento de auditoría) están **CERRADOS desde el 23 de septiembre**, no pendientes.

## Regla aplicada (CLAUDE.md #9)
Nada del worktree se borra ni se fusiona sin revisión — se documenta aquí y se revisa poco a poco.

## 0. Ya resuelto en sesiones anteriores (no requiere acción)
- Las 3 migraciones SQL del worktree (`beatport_url`, `seo_publish_status`, `check_dj_availability`) rescatadas, corregidas y aplicadas a producción en PR #512.
- Los 3 defectos P0 (DEF-01/02/03: fuente de verdad de elegibilidad pública + enlaces canónicos) — PR/commit `6676b4f9`, 23 de septiembre, ya en `main`.
- La cuenta de prueba `DJ PRO TEST`/`QA AUTO Test` — eliminada de producción por completo (`dj_profiles`, `identity.users`, `auth.users`, `identity.user_roles`), sin referencias huérfanas.

## 1. Lo que SÍ queda genuinamente sin construir: búsqueda en vivo (tipeo progresivo)
El worktree, además del arreglo de elegibilidad (ya obsoleto, ver arriba), agregaba una función que el `find-dj.html` de hoy **no tiene**: un campo de búsqueda con filtro en memoria mientras se escribe (sin una consulta por tecla — debounce de 120ms, sobre los datos ya traídos). Es una mejora de UX, no un arreglo de seguridad. Reintegrarla contra el archivo actual es viable — usa las mismas funciones (`tokenize`, `matchesQuery`, `filterByNameQuery`) que ya existen en `find-dj-search.mjs`.

## 2. Los otros cambios menores del worktree (bajo riesgo, sin urgencia, siguen sin aplicar)
| Archivo | Cambio | Nota |
|---|---|---|
| `web/dj/directorio.html`, `web/equipo.html`, `web/dj/djsolitario.html`, `web/dj/djyuyo.html` | Meta tags Open Graph + Twitter Card | Inofensivo, mejora de SEO/compartir en redes |
| `web/dj/directorio.html` | `📍 homestead` → `📍 Homestead` | Corrección trivial de capitalización |
| `web/dj/djsolitario.html`, `web/dj/djyuyo.html` | Quita el `★ 1 (0)` (rating falso, 0 reseñas reales) + corrige el botón "Consultar Disponibilidad" (hoy apunta a `client-portal.html?dj_name=...`; `djmago305.html` ya usa el patrón correcto `dj-profile.html?id=...`) | Inconsistencia real entre páginas del propio sitio, no relacionada con el bug de seguridad ya cerrado |
| `web/form-handler.js`, `web/index.html` | Recibe 3 campos de `sessionStorage` (`mdj_avail_start_time/end_time/result`) de una página `dj-availability.html` que **nunca se construyó** | Scaffolding huérfano pero seguro (no-op sin esa página). El RPC `check_dj_availability` que alimentaría esto ya está en producción (PR #512), sin frontend que lo llame |

## Cómo aplicar
1. La búsqueda en vivo (sección 1) es la única pieza con valor real pendiente de este worktree — construir solo si el PO lo pide explícitamente, sin urgencia.
2. Los cambios menores (sección 2) pueden ir en el mismo PR o aparte, a discreción del PO.
3. El documento de auditoría completo (`docs/audit-dj-public-profiles-master-2026-09-13-FINAL.md`, 352 líneas) tiene además 4 P1 y 9 P2 — algunos probablemente también ya resueltos por trabajo posterior no relacionado con este worktree; no asumir que siguen abiertos sin verificar contra el código actual primero.
