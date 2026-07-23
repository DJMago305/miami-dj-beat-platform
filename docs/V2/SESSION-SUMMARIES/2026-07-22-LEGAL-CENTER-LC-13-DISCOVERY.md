# LEGAL CENTER LC-13 — DISCOVERY SESSION

**Ticket:** TICKET-V2-LEGAL-CENTER-LC-13-DISCOVERY-AND-PLANNING-001
**Fecha:** 2026-07-22
**Modo:** Discovery + documentación — **sin commit en este ticket**

---

## 1. Baseline

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD** | `5b071328e35a1781d1d4f38c611ad41522ffed33` |
| **Working tree (pre-docs)** | limpio |

---

## 2. Objetivo cumplido

Documentar arquitectura de acceso seguro Legal Center post-LC-12:

- RLS conceptual
- RPC/read-model (7 read + extensiones propuestas)
- Fronteras Owner / Manager / Seller
- Artista / cliente / anonymous / invited-recipient
- Enlaces públicos temporales
- Auditoría append-only
- Compatibilidad firma electrónica
- Separación bootstrap legacy

**Sin implementación.**

---

## 3. Hallazgos principales

1. **LC-13A** ya define read matrix + 7 RPC read — LC-13 **extiende** con write ops, public links, e-sign, bootstrap map.
2. **LC-13B bridge** live — `LegalReadAccessContext` + `STAFF-*` / `ART-*` / `CLI-*` es base de identidad RPC.
3. **LC-12 DDL** aprobado aislado — RLS/RPC pueden diseñarse/aplicarse **sin** reparar 110 migraciones (apply en PG aislado o pipeline V2).
4. **`is_staff()` / `dj_profiles`** en integración V1 full stack — **BLOCKED_BY_BOOTSTRAP** para cadena global.
5. **`legal_audit_events`** append-only en LC-12 — RLS debe reforzar INSERT-only + deny UPDATE/DELETE.

---

## 4. Estados oficiales documentados

| Estado | Valor |
|--------|-------|
| LC-12 DDL | APPROVED_BY_PO_IN_ISOLATED_POSTGRES |
| Bootstrap | BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT |
| LC-13 SQL | NOT_IMPLEMENTED / DEFERRED |
| LC-13 discovery | **COMPLETADO — PENDIENTE PO** |

---

## 5. Entregables documentales

| Archivo | Acción |
|---------|--------|
| `docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-13-DISCOVERY-AND-PLANNING-001.md` | creado |
| `docs/V2/SESSION-SUMMARIES/2026-07-22-LEGAL-CENTER-LC-13-DISCOVERY.md` | creado |
| `docs/V2/README.md` | actualizado |
| `docs/V2/NOTA-DIARIA-LAB-001.md` | actualizado |

---

## 6. Referencias canónicas (sin duplicar)

- `docs/V2/LEGAL/LC-13A-READ-AUTHORIZATION-MATRIX.md`
- `docs/V2/LEGAL/LC-13A-RPC-CONTRACT-MATRIX.md`
- `docs/V2/LEGAL/LC-13B-0-ACCESS-CONTEXT-CONTRACT.md`
- `docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-12-ISOLATED-POSTGRES-VALIDATION-001.md`

---

## 7. Próximos pasos (no ejecutados)

1. Aprobación PO de este discovery.
2. Ticket implementación LC-13-READ-SQL (RLS + 7 RPC) sobre PG aislado LC-12.
3. Validación PG 17 aislada (opcional).
4. Public links + write Edge (tickets separados).
5. Bootstrap legacy — ticket independiente.

---

## 8. Restricciones intactas

Sin SQL · sin RLS · sin RPC · sin runtime · sin Supabase · sin Docker · sin commit · sin push · sin deploy · sin producción.

---

## 9. Estado final

> **LC-13 DISCOVERY COMPLETADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**
