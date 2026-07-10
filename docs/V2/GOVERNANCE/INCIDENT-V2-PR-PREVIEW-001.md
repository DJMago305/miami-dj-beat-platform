# MIAMI DJ BEAT — INCIDENTE DE GOBERNANZA

## INCIDENT-V2-PR-PREVIEW-001

**Ticket registro:** TICKET-V2-GOVERNANCE-INCIDENT-PR-PREVIEW-001  
**Severidad:** CRÍTICA (gobernanza operativa — sin impacto en producción)  
**Fecha del incidente:** 2026-07-10  
**Estado:** DOCUMENTADO — política actualizada  
**Audiencia:** Product Owner, agentes IA, desarrolladores

---

## 1. Resumen ejecutivo

Durante el cierre de la **Fase 2 (Bootstrap Runtime P0)** del laboratorio V2, el push directo a `main` fue **bloqueado correctamente** por protección de rama GitHub (`GH013` — status check `check` requerido).

Como alternativa autorizada, se abrió el **Pull Request #117** únicamente para satisfacer el status check. La apertura del PR activó **automáticamente** integraciones Vercel y generó **Preview Deployments** en dos proyectos (`miami-dj-beat-platform` y `web`).

**La producción NO fue afectada.** El protocolo vigente no contemplaba explícitamente que un PR puede disparar previews automáticos aunque el ticket declare `SIN DEPLOY`.

Este documento registra el incidente de gobernanza y establece la **política permanente** que distingue LOCALHOST, RAMA REMOTA, PULL REQUEST, PREVIEW y PRODUCCIÓN.

---

## 2. Tickets y artefactos involucrados

| Campo | Valor |
|-------|-------|
| **Ticket cierre Fase 2** | TICKET-V2-COMMIT-PHASE-002-BASELINE-001 |
| **Ticket publicación PR** | TICKET-V2-PUBLISH-PHASE-002-VIA-PR-001 |
| **Ticket auditoría Vercel** | INCIDENTE DE GOBERNANZA — AUDITORÍA VERCEL PR #117 |
| **Ticket registro** | TICKET-V2-GOVERNANCE-INCIDENT-PR-PREVIEW-001 |
| **Pull Request** | [#117](https://github.com/DJMago305/miami-dj-beat-platform/pull/117) |
| **Rama** | `pr/v2-phase-2-bootstrap-runtime` |
| **Commit** | `d847e190554e465c0d7c81daf045c9fd42fb1b58` |
| **Mensaje commit** | `feat(v2-lab): finalize phase 2 bootstrap runtime baseline` |

---

## 3. Cronología

| Hora (UTC-4 aprox.) | Evento |
|---------------------|--------|
| 2026-07-10 00:17 | Commit local `d847e19` en `main` |
| 2026-07-10 00:18+ | `git push origin main` → **rechazado** (`GH013`, check requerido) |
| 2026-07-10 00:23 | Rama `pr/v2-phase-2-bootstrap-runtime` creada y publicada |
| 2026-07-10 00:23 | PR #117 abierto (base: `main`, compare: rama PR) |
| 2026-07-10 04:23 UTC | Vercel genera Preview Deployments automáticos |
| 2026-07-10 04:23+ | Auditoría confirma: solo Preview, producción intacta |

---

## 4. Evidencia — producción NO afectada

| Verificación | Resultado |
|--------------|-----------|
| `origin/main` | `13bb4c4790f074d4539620f7152f3f92f3fe8205` — **sin cambio** |
| PR #117 mergeado | **No** (`mergedAt: null`, estado `OPEN`) |
| Deploy Production para `d847e19` | **No existe** en GitHub Deployments API |
| Último Production Vercel | `13bb4c4` — 2026-07-06 |
| `miamidjbeat.com` | **No reasignado** al commit V2 |
| `www.miamidjbeat.com` | **No reasignado** al commit V2 |
| V1 (`web/`) en producción | **Intacta** — Production sigue en `13bb4c4` |

### Preview Deployments generados (aislados)

| Proyecto | Environment (GitHub API) | Commit | URL Preview |
|----------|--------------------------|--------|-------------|
| miami-dj-beat-platform | **Preview – miami-dj-beat-platform** | `d847e19` | `https://miami-dj-beat-platform-git-pr-v2-pha-cea8d0-djmago305s-projects.vercel.app` |
| web | **Preview – web** | `d847e19` | `https://web-git-pr-v2-phase-2-bootstrap-runtime-djmago305s-projects.vercel.app` |

Checks GitHub etiquetados como pass (`Vercel – miami-dj-beat-platform`, `Vercel – web`) corresponden a **Preview Deployments**, no a Production. El bot Vercel en PR #117 etiqueta explícitamente los enlaces como **[Preview]**.

**Veredicto auditoría:** **SOLO PREVIEW — PRODUCCIÓN INTACTA**

---

## 5. Causa raíz

El protocolo operativo diferenciaba:

- trabajo local;
- push;
- merge;
- producción.

**No contemplaba explícitamente** que:

> **Un Pull Request puede activar integraciones externas automáticas (Vercel Preview) aunque el ticket declare `SIN DEPLOY`.**

El PR #117 fue abierto **para satisfacer el status check de GitHub**, no porque el Product Owner hubiera autorizado previews como objetivo funcional de la Fase 2.

La frase **`SIN DEPLOY`** fue interpretada como ausencia total de actividad en plataformas de hosting, pero **no excluye automáticamente Preview Deployments** disparados por la integración GitHub ↔ Vercel.

---

## 6. Lección aprendida

1. **`SIN DEPLOY` ≠ `SIN PREVIEW`.** Son dimensiones independientes.
2. **Abrir un PR es una acción con efectos colaterales** — puede activar CI, Vercel, comentarios automáticos y URLs públicas temporales.
3. **Un check Vercel en verde en un PR no prueba ausencia de impacto en producción** — debe verificarse el `environment` del deployment (Preview vs Production).
4. Los tickets futuros deben declarar explícitamente permisos sobre **PR** y **Preview**, no solo push/merge/deploy.

---

## 7. Política permanente — cinco entornos obligatorios

A partir de **2026-07-10**, todo ticket Miami DJ Beat debe distinguir explícitamente:

| # | Entorno | Definición |
|---|---------|------------|
| 1 | **LOCALHOST** | Código ejecutado únicamente en la máquina del Product Owner o laboratorio local (`npm run dev`, puerto local). Sin publicación remota. |
| 2 | **RAMA REMOTA** | Código publicado en GitHub en una rama **sin** Pull Request abierto. Puede o no activar integraciones según configuración del repo. |
| 3 | **PULL REQUEST** | Propuesta de merge contra `main` u otra base. **Puede activar integraciones externas automáticamente** (CI, Vercel, bots). Requiere autorización explícita en el ticket. |
| 4 | **PREVIEW** | Deployment aislado generado por Vercel u otra plataforma (URLs `*-git-*-*.vercel.app` o equivalentes). **No es producción**, pero es **público temporalmente** y debe declararse en el ticket. |
| 5 | **PRODUCCIÓN** | Código visible para usuarios finales (`miamidjbeat.com`, `www.miamidjbeat.com`, dominios productivos). Requiere **`APROBADO DEPLOY PRODUCCIÓN`** y merge a rama de producción según protocolo. |

### Regla vinculante

> La frase **`SIN DEPLOY`** **NO implica** automáticamente **`SIN PREVIEW`** ni **`SIN PR`**.

Todo ticket futuro debe declarar explícitamente en la sección de restricciones:

- `PR permitidos` / `PR prohibidos`
- `Previews permitidos` / `Previews prohibidos`
- `Push a main permitido` / `Push a main prohibido`
- `Merge permitido` / `Merge prohibido`
- `Deploy producción permitido` / `Deploy producción prohibido`

Si un ticket declara `SIN DEPLOY` pero **no menciona PR ni Preview**, el agente debe **detenerse y solicitar aclaración PO** antes de abrir un Pull Request.

---

## 8. Procedimiento futuro

### Antes de abrir un PR

1. Verificar si el ticket autoriza explícitamente **PR** y **Preview**.
2. Si solo se autorizó push/merge/deploy, **no abrir PR** sin ampliación de alcance PO.
3. Si el push directo a `main` está bloqueado por branch protection, reportar al PO las opciones:
   - (A) Autorizar PR + Preview (declarado en ticket);
   - (B) Ejecutar CI localmente y solicitar bypass temporal (solo PO/admin);
   - (C) Mantener commit local hasta nueva instrucción.

### Después de abrir un PR (si autorizado)

1. Registrar en el informe: número PR, rama, checks activados.
2. Auditar deployments con GitHub Deployments API — confirmar `environment: Preview`.
3. Verificar que `origin/main` y Production **no cambiaron**.
4. **No interpretar** checks Vercel pass como prueba de ausencia de preview.
5. **No hacer merge** sin autorización PO explícita.

### Plantilla mínima para tickets (restricciones)

```
RESTRICCIONES DE PUBLICACIÓN:
- LOCALHOST: permitido / prohibido
- RAMA REMOTA: permitida / prohibida
- PULL REQUEST: permitido / prohibido
- PREVIEW (Vercel u otro): permitido / prohibido
- PUSH a main: permitido / prohibido (requiere APROBADO PUSH)
- MERGE: permitido / prohibido
- DEPLOY PRODUCCIÓN: permitido / prohibido (requiere APROBADO DEPLOY PRODUCCIÓN)
```

---

## 9. Declaraciones explícitas de este incidente

| Declaración | Estado |
|-------------|--------|
| El PR #117 fue creado **únicamente** para satisfacer el status check `check` de GitHub | ✅ Confirmado |
| La generación de previews **NO era** un objetivo funcional de la Fase 2 | ✅ Confirmado |
| La producción **NO resultó afectada** | ✅ Confirmado por auditoría |
| El push directo a `main` fue **correctamente bloqueado** | ✅ Comportamiento esperado |
| Fase 2 local permanece válida en commit `d847e19` | ✅ Sin regresión documental |

---

## 10. Acciones prohibidas tras este incidente

- **No** asumir que `SIN DEPLOY` cubre previews.
- **No** abrir PRs sin declaración explícita de PR/Preview en el ticket.
- **No** interpretar checks Vercel pass como ausencia de deployment.
- **No** mergear PR #117 sin autorización PO separada.
- **No** reabrir Fase 2 por este incidente (gobernanza documental únicamente).

---

## 11. Referencias

| Documento | Ruta |
|-----------|------|
| Índice gobernanza | `docs/V2/GOVERNANCE/README.md` |
| Baseline PO | `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` §68 |
| Cierre Fase 2 | `docs/V2/SESSION-SUMMARIES/2026-07-10-PHASE-2-CLOSURE.md` |
| PR #117 | https://github.com/DJMago305/miami-dj-beat-platform/pull/117 |

---

*INCIDENT-V2-PR-PREVIEW-001 — registrado 2026-07-10*

*Sin commit · Sin push · Sin merge · Sin deploy · Sin cambios en producción · Sin cambios en V1 · Sin cambios en MiamiDJBeat-MigracionV2/*
