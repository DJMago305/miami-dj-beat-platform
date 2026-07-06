# TICKET-DOCS-V2-BASELINE-001 — Indexar baseline documental V2

**Fecha:** 2026-07-06  
**Estado:** **CERRADO LOCAL** — baseline indexado; commit pendiente autorización PO  
**Modo:** Documentación únicamente  
**Post-merge:** PR #116 en `main` — este ticket no toca entregables V1 del merge.

---

## Objetivo

Ordenar y documentar los archivos V2 que permanecían **untracked** tras el merge de PR #116, preparando el repo para tickets V2 sin mezclar con runtime V1.

---

## Alcance incluido

| Path | Acción |
|------|--------|
| `docs/V2/` (25 archivos) | Indexado en `docs/V2/README.md` |
| `docs/V2-LAB/` (8 archivos) | Indexado en `docs/V2-LAB/README.md` |
| `docs/DECISIONS.md` | Referenciado como registro DECISION-V2-001…003 |
| `docs/NOTA-DIARIA-2026-07-05.md` | Cross-ref a `SESSION-SUMMARIES/2026-07-05.md` |
| `docs/tickets/TICKET-P0-OWNER-STRIP-*.md` (3) | Catalogados en § V1 crossover del README V2 |

---

## Fuera de alcance (no tocado)

- `web/` — Invoice, Cash Flow, Stripe, Header/Nav
- `supabase/`
- `MiamiDJBeat-MigracionV2/` (scaffold runtime — untracked separado)
- `MiamiDJBeat-MigracionV2/.env`

---

## Entregables

| # | Entregable | Estado |
|---|------------|--------|
| 1 | `docs/V2/README.md` — índice maestro + jerarquía + mapa | ✅ |
| 2 | `docs/V2-LAB/README.md` — índice lab 01–08 | ✅ |
| 3 | Cross-ref `NOTA-DIARIA-2026-07-05.md` → session summary | ✅ |
| 4 | Addendum baseline en tickets P0 owner-strip | ✅ |
| 5 | Este ticket de cierre | ✅ |

---

## Inventario commit-ready

```
docs/DECISIONS.md
docs/NOTA-DIARIA-2026-07-05.md
docs/V2/                          (25 files)
docs/V2-LAB/                      (8 files + README)
docs/tickets/TICKET-P0-OWNER-STRIP-CONTRACT-V2-001.md
docs/tickets/TICKET-P0-OWNER-STRIP-LIFECYCLE-INVESTIGATION-001.md
docs/tickets/TICKET-P0-OWNER-STRIP-STAFF-LOCAL-PROD-PARITY-001.md
docs/tickets/TICKET-DOCS-V2-BASELINE-001.md
docs/V2/README.md
docs/V2-LAB/README.md
```

**No incluir:** `MiamiDJBeat-MigracionV2/`, `.env`, `.DS_Store`

---

## QA documental

- [x] Jerarquía Constitución > DECISIONS > GOVERNANCE > ARCHITECTURE documentada
- [x] P0 owner-strip separados de specs V2 (crossover V1)
- [x] PR #116 / Mi Perfil (`f69b66e`) citado solo en PARITY — scope distinto
- [x] Cero diff en `web/` y Supabase

---

## §7 — Gate

| Acción | Estado |
|--------|--------|
| Baseline indexado | ✅ |
| Commit | ⏳ Espera OK Capitán |
| Push | ⏳ Sin `APROBADO PUSH` |

---

## Rollback

Eliminar solo los archivos nuevos de este ticket (`README`s + `TICKET-DOCS-V2-BASELINE-001.md` + addenda P0). Los docs V2 untracked originales permanecen sin commit.
