# TICKET-V2-PHASE-5-MOD-014-AUTH-ERROR-NORMALIZATION-001

**Módulo:** MOD-014 Error Handler
**Fase:** 5 — Auth error normalization extension
**Proyecto:** MiamiDJBeat-MigracionV2
**Rama:** `plan/v2-phase-4-api-client`
**Fecha apertura:** 2026-07-10
**Fecha cierre técnico:** 2026-07-10

---

## Estado

**COMPLETADO LOCALMENTE — PENDIENTE DE WIRING**

| Dimensión | Estado |
|-----------|--------|
| Implementación | ✅ COMPLETADA |
| Validación técnica | ✅ COMPLETADA (410/410) |
| Validación visual PO | ⏳ NO APLICA |
| Documentación cierre | ⏳ TICKET-V2-PHASE-5-MOD-014-AUTH-ERROR-NORMALIZATION-DOCS-001 |
| Commit técnico | ✅ `67843074f13aac44f22d19bcc6858e84287284e4` |
| Incidente post-commit | ✅ RECUPERADO — INCIDENT-V2-POST-COMMIT-WORKTREE-CONTAMINATION-001 |
| Publicación remota | ⛔ NO |

---

## Objetivo

Extender MOD-014 con `normalizeAuthError()` — mapping determinístico ERR-AUTH → ERR-01xx, redacción, idempotencia — **sin** wiring MOD-001, **sin** `normalizeApiError()`, **sin** Supabase.

---

## Alcance autorizado

### Creado

- `MiamiDJBeat-MigracionV2/shared/errors/runtime/auth-normalize.ts`
- `MiamiDJBeat-MigracionV2/tests/unit/auth-error-normalize.test.ts`

### Modificado

- `catalog.ts` · `error-handler-service.ts` · `index.ts` · `redact.ts`

### Prohibido (respetado en implementación)

- `shared/auth/runtime/` · Bootstrap · Session · API Client · V1 · Theme · Supabase · docs (ticket separado)

---

## Criterios de aceptación

| # | Criterio | Evidencia |
|---|----------|-----------|
| A-01 | `normalizeAuthError()` exportado | `index.ts` + test imports |
| A-02 | 10 mappings determinísticos | `AUTH_TO_GLOBAL_MAP` + test T-16 |
| A-03 | `category` C-02 en salidas Auth | Tests T-01, T-04, T-05 |
| A-04 | `cause` opaca `ERR-AUTH-xxx` | Tests T-01, T-04, T-12 |
| A-05 | Redacción password/token/JWT | Tests T-06, T-08 |
| A-06 | Idempotencia C-02 | Test T-10 |
| A-07 | Inmutabilidad input | Test T-11 |
| A-08 | `null`/`undefined` → ERR-0999 sin throw | Test T-07 |
| A-09 | 16 tests nuevos PASS | `auth-error-normalize.test.ts` |
| A-10 | Suite global 410/410 PASS | `npm test` |
| A-11 | 6 archivos en commit | `git show 6784307` |
| A-12 | Commit `6784307` | reflog + log |
| A-13 | Working tree limpio post-recuperación | `git status` vacío |

---

## Próximos tickets (no abrir automáticamente)

- MOD-001 ↔ MOD-014 wiring
- `normalizeApiError()` bridge
- SupabaseAuthAdapter error mapping
- Portal error UI / `presentError()`
- Sincronización documental `ERROR-CATALOG.md`

---

## Deuda registrada

Ver `SESSION-SUMMARIES/2026-07-10-MOD-014-AUTH-ERROR-NORMALIZATION.md` §11.

---

## Gobernanza

Push ❌ · PR ❌ · Preview ❌ · Merge ❌ · Deploy ❌ · Producción intacta.

---

*TICKET MOD-014 v1.0 — cierre técnico 2026-07-10*
