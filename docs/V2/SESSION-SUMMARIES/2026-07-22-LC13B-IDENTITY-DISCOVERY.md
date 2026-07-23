# LC-13B IDENTITY INTEGRATION — DISCOVERY SESSION

**Ticket:** TICKET-V2-LEGAL-CENTER-LC-13B-IDENTITY-INTEGRATION-DISCOVERY-001
**Fecha:** 2026-07-22
**Modo:** Discovery + arquitectura — sin SQL · sin runtime · sin commit

---

## 1. Baseline

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD** | `043f2cc5f86e1b9a2d8b7dfc735ea455a5727a09` |
| **Working tree (pre-docs)** | limpio |

---

## 2. Objetivo cumplido

Diseñar integración futura entre:

- LC-13A read security (RLS + RPC aislado)
- LC-13B identity bridge runtime (live)
- Session/Auth V2 + perfiles Staff/Artist/Client
- Límites bootstrap legacy

**Sin implementación.**

---

## 3. Hallazgos principales

1. **Bridge runtime ya live** — `resolveLegalReadAccessContextFromSession` + `LegalProfileLookupPort`; gap = adapter Supabase prod, no reescribir bridge.
2. **LC-13A stub no es productivo** — `legal_lc13_identity_profiles` clasificado REMOVE en prod; RLS/RPC **KEEP**.
3. **Cadena autoridad:** `auth.uid()` → snapshot → lookup → `LegalReadAccessContext` → RLS → RPC → portal.
4. **`dj_profiles` / `is_staff()`** — verdad V1 staff; **BLOCKED** en apply local vacío; diseño **SAFE** referenciando snapshot.
5. **Portal mismatch** — regla bridge obligatoria; seller fail-closed en wire si bridge falla.
6. **Public links / writes** — identidades adicionales; **DEFER** post LC-13B prod lookup.

---

## 4. Entregables documentales

| Archivo | Acción |
|---------|--------|
| `docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-13B-IDENTITY-INTEGRATION-DISCOVERY-001.md` | creado |
| `docs/V2/SESSION-SUMMARIES/2026-07-22-LC13B-IDENTITY-DISCOVERY.md` | creado |
| `docs/V2/README.md` | actualizado |
| `docs/V2/NOTA-DIARIA-LAB-001.md` | actualizado |

---

## 5. Referencias canónicas

- `docs/V2/LEGAL/LC-13B-0-ACCESS-CONTEXT-CONTRACT.md`
- `docs/V2/LEGAL/LC-13B-0-IDENTITY-FLOW.md`
- `docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-13A-ISOLATED-READ-SECURITY-VALIDATION-001.md`
- `MiamiDJBeat-MigracionV2/shared/services/legal/persistence/identity/`

---

## 6. Restricciones intactas

Sin SQL · sin migraciones · sin runtime · sin Docker · sin Supabase · sin commit · sin push · sin deploy · sin producción.

---

## 7. Estado final

> **LC-13B IDENTITY INTEGRATION DISCOVERY COMPLETADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**
