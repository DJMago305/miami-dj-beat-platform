# Acta de Saneamiento y Reorganización de Worktrees — 2026-08-25

| | |
|---|---|
| **Ámbito** | Escritorio (`~/Desktop`) + repo `miami-dj-beat-platform` |
| **Ejecutor** | Hilo Maestro (Claude Code) |
| **Aprobación** | PO — explícita en cada fase (auditoría, rescate, desvinculación, merge) |
| **Resultado** | 11 worktrees huérfanos eliminados, cero pérdida de código, cero secretos expuestos |

## 1 · Origen

El escritorio acumuló 11 worktrees de git (`mdjb-*`, `cajero-central`, `mrm-3d`) creados por sesiones anteriores directamente en `~/Desktop`, en lugar de un directorio aislado. Convivían con proyectos ajenos al repo y, en un caso (`MiamiDJBeat-MigracionV2/`), con un `.env` y un `node_modules/` de 1.6GB a un `git add -A` de distancia de entrar al historial.

## 2 · Auditoría (solo lectura)

Para cada una de las 11 carpetas se comparó su rama contra `origin/main` (`git log`/`git diff --stat`) y se revisó su estado de trabajo (`git status --porcelain`). Veredicto: 5 idénticas a main (sin commits ni cambios propios), 6 con contenido único — el mayor caso, `feature/v2-artist-dj-profiles`, con **242 commits** sin fusionar (rama V2: staff portal, BFI, sesión).

## 3 · Blindaje previo a cualquier borrado

- `feature/v2-artist-dj-profiles` (242 commits) y `feature/consola-menu-cuentas` (4 commits + cambios pendientes) empujadas a `origin` antes de tocar sus worktrees — verificado con `git ls-remote`.
- Al comitear el estado de `feature/one-hit-wonder-engine`, un `git add -A` reveló `MiamiDJBeat-MigracionV2/` (proyecto aparte de 1.6GB, con `.env` y `node_modules/`) anidada dentro del propio repo — **no se comiteó**; se excluyó y se blindó en `.gitignore`.

## 4 · Rescate hacia `web/` y `docs/`

| Origen | Destino | Contenido |
|---|---|---|
| `mdjb-artist-clean` | `web/`, `web/css/`, `web/assets/icons/` | `artist-portal.html`, `mdj-iconos-preview.html`, 2 CSS, 1 SVG |
| `mdjb-ui` | `docs/` | `constitucion-estaciones-de-trabajo.md` + 1 incidente nuevo (un segundo incidente NO se copió: la raíz ya tenía una versión más nueva y completa) |
| `MiamiDJBeat-profile-assets` | `web/assets/artists/AHI-NA-MA/` | 8 archivos de assets de artista |
| `Disenos Pestanas` | `docs/referencias-diseno/` | 18 capturas de referencia de diseño |
| `MiamiDJBeat-archivo-fuera-produccion` | `docs/archivo-historico/` | 40 archivos (docs/SQL históricos) + **6 workflows ocultos** en `.agent/`/`.agents/workflows/` (clima, branding, rollback, rentals) que un `mv *` inicial no capturó por ser dotfiles — encontrados al verificar que la carpeta quedara realmente vacía antes de borrarla |

## 5 · Desvinculación

Las 11 carpetas se removieron con `git worktree remove --force` (seguro: solo descarta el checkout, no borra commits del `.git` compartido) tras confirmar el respaldo de cada una. `git worktree prune` limpió además 14 worktrees temporales de sesiones de subagentes en `/private/tmp/` y 1 worktree interno huérfano en `.claude/worktrees/`.

## 6 · Reubicación final

`MiamiDJBeat-MigracionV2/` (1.6GB, `.env` + `node_modules/`) movida a `~/Developer/Archivos_Viejos/MiamiDJBeat-MigracionV2/` — fuera del repo y fuera del escritorio de trabajo diario.

## 7 · Consolidación en `main`

- PR #256 — assets/docs rescatados (101 archivos, +11786/-4). 5 checks verdes. Fusionado.
- `docs/constitucion-m1-m5` — aislada en rama propia (workstream separado, sin PR abierto todavía).
- PR #257 — Regla 8 de gobernanza (`CLAUDE.md` + `.gitignore`). 5 checks verdes. Fusionado.

## 8 · Manual operativo — Regla 8 (confinamiento de worktrees)

Ver `CLAUDE.md` §8 para el texto normativo completo. Resumen operativo:

1. **Ubicación de worktrees**: nunca como carpeta hermana del repo en el escritorio. Usar `.worktrees/` (dentro del repo) o el scratchpad temporal del agente.
2. **`git add` nominal**: prohibido `git add -A`/`git add .`. Agregar archivo por archivo o carpeta explícita — así un `node_modules/` o `.env` ajeno se detecta ANTES del commit, no después.
3. **Rama limpia**: toda tarea nueva empieza con `git checkout main && git pull origin main` antes de `git checkout -b`. Ramificar desde una rama de trabajo vieja fue la causa de que el dataset "One Hit Wonder" viajara sin revisión propia dentro del PR #256.
4. **Diff antes de PR**: `git diff origin/main --stat` para confirmar que el PR solo toca archivos de esa tarea.
5. **Destino canónico**: docs de gobernanza → `docs/`; media de artistas → `web/assets/artists/<nombre>/`; SQL → `supabase/scripts/`.
