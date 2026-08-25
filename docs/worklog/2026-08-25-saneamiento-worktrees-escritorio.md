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

## 9 · Cierre de jornada — 2026-08-25

Además del saneamiento de worktrees (§1-8), el mismo día se auditó y corrigió el header en producción:

- **PR #256** — consolidación de assets/docs rescatados.
- **PR #257** — Regla 8 de gobernanza (confinamiento de worktrees, `git add` nominal, ramas limpias).
- **PR #258** — este acta.
- **PR #259** — `artist-portal.html` apuntaba a `mdj-shared-header.js` (inexistente); corregido a `mdjb-shared-header.js`.
- **PR #260** — Bóveda Legal (slot 10) desbordaba la rejilla rígida de 9 columnas de `#mainNav` y se montaba sobre Shop; removido del riel (el acceso ya existía en `account-settings.html` → Documentos Legales). Estación vuelve a 9 puestos.
- **PR #261** — el FAB móvil de `dj-profile.html` usaba un corte de breakpoint (`max-width:768px`, sin `pointer:coarse`) desalineado del ya establecido en el resto del sitio (`600px + pointer:coarse`, "hamburguesa exclusiva de teléfono"); igualado, cierra el amontonamiento entre 601-768px.

**Estado al cierre:** `main` en `83f1e02`, árbol de trabajo limpio, sin ramas locales huérfanas de esta sesión (las 6 creadas hoy se fusionaron y se borraron localmente; `docs/constitucion-m1-m5` queda deliberadamente aislada, sin fusionar, a la espera de decisión sobre su destino). Sistema estabilizado.

**Pendiente, sin tocar:** `MiamiDJBeat-MigracionV2/` en `~/Developer/Archivos_Viejos/` (decisión del PO sobre su `.env`/destino final); los ~130 branches locales preexistentes de otros hilos (fuera del alcance de este saneamiento).

**Próximo objetivo fijado:** trabajo y pulido del módulo de **Contratos y W-9 Engine** (`feature/contracts-w9-engine-integration`, ya existe como rama local fusionada — retomar desde ahí o desde `main`).

## 10 · Backlog para la próxima sesión (registrado 2026-08-25, sin tocar código)

1. **Hero de `dj-profile.html`, espaciado estrellas→nombre**: el gap actual entre `.dj-rating` (★★★★★) y `#pub-name` ("DJMago305") mide 24px — el único espacio notablemente "airoso" en ese bloque (nombre→redes sociales y redes→especialidades ya miden 5px y 0px respectivamente, medidos en vivo a 700px y 1440px). Reducirlo a pedido del PO.
2. **Ícono de compartir en `.dj-social-row`**: el último ícono de la fila de redes sociales (`.dj-social-icon.share-btn`, botón de compartir perfil) se ve tenue/vacío junto a los íconos de red social reales — revisar si es un estado visual intencional (ícono de compartir, distinto a los de red social) o un ícono roto/mal cargado.
3. Módulo de **Contratos y W-9 Engine** (ver arriba, §9).

`main` intacto en `ee531a7` — nada de esto se tocó en código, solo quedó registrado.
