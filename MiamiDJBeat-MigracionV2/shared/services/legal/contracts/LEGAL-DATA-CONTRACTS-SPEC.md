# LEGAL-DATA-CONTRACTS-SPEC.md

**Ticket:** TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001  
**Phase:** DC-1 — Data Contracts  
**Parent discovery:** TICKET-V2-LEGAL-DATA-CONTRACTS-DISCOVERY-001  
**Status:** SPEC COMPLETE — **no runtime repository, no Supabase, no UI**

---

## Purpose

Formal TypeScript read-model contracts for the Miami DJ Beat legal domain (LDC-001 … LDC-014). Types live in:

`MiamiDJBeat-MigracionV2/shared/services/legal/contracts/`

---

## File map

| File | Contents |
|------|----------|
| `legal-ids.ts` | Branded ID aliases |
| `legal-enums.ts` | All domain enumerations |
| `legal-entities.ts` | LDC entity types |
| `legal-projections.ts` | Read models, ACL, guards, errors |
| `legal-domain-events.ts` | MOD-004 event names + payloads |
| `legal-service-ports.ts` | Read-only port interfaces |
| `index.ts` | Barrel export |

---

## Import

```ts
import type { LegalProfile, LegalExpedienteSnapshot } from '../../shared/services/legal/contracts';
import { assertAuditPayloadSafe, isPublicLegalLibraryDocument } from '../../shared/services/legal/contracts';
```

---

## Invariants (enforced in spec helpers)

| Rule | Helper |
|------|--------|
| TP-01 W-9 not in public library list | `isPublicLegalLibraryDocument()` |
| Audit no raw TIN/signature | `assertAuditPayloadSafe()` |
| TaxProfile has no `tinFull` field | Type omission |
| `LegalExpedienteSnapshot.version` | Literal `1` for evolution |

---

## Explicit non-scope (DC-1)

- Postgres DDL · RLS · Supabase  
- Repository implementations  
- Signing capture runtime  
- Portal UI  
- JSON Schema files (optional DC-1b)

---

## Next phase

**DC-2** — Mock in-memory repositories implementing `LegalServicePorts` for lab tests.
