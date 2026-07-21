# LEGAL-IN-MEMORY-SERVICE.md

**Ticket:** TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001  
**Phase:** DC-2 — In-memory read-only legal service  
**Parent:** TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001 (DC-1)  
**Status:** COMPLETE — lab only · **no Supabase · no UI · no commit unless PO authorizes**

---

## Architecture

```
legal-fixtures.ts          → deterministic seed data (5 personas)
in-memory-legal-store.ts   → clone-on-read store (no persistence)
legal-projection-builders.ts → LGC read models from store
legal-status-resolver.ts   → pure GREEN/YELLOW/RED + reasons
legal-access-policy.ts     → role-safe portal projections
in-memory-legal-service.ts → LegalServicePorts + lab accessors
index.ts                   → barrel export
```

Import:

```ts
import {
  createInMemoryLegalService,
  LEGAL_FIXTURE_PROFILE_IDS,
} from '../../shared/services/legal/in-memory';
```

---

## Fixtures

| ID | Persona | Aggregate |
|----|---------|-----------|
| `LP-ART-GREEN-001` | DJMago305 / Gerardo A Valle | GREEN |
| `LP-ART-YELLOW-001` | Artist warning path | YELLOW |
| `LP-PRO-RED-001` | Vendor/provider blocked | RED |
| `LP-CLI-001` | Client (no fiscal tier) | GREEN |
| `LP-EXT-001` | External token signer | YELLOW |

Introduction canonical: `INTRO-2026-000421` — Miami DJ Beat → Mojitos Calle 8 ↔ DJMago305 (24-month protection).

---

## Access matrix (conceptual)

| Role | Tax / W-9 | Compliance detail | Audit | Signature IP/device |
|------|-----------|-------------------|-------|---------------------|
| staff_owner | masked `***-last4` | full | full | full |
| staff_manager | masked | full | full | full |
| staff_seller | hidden | summary | hidden | stripped |
| artist | own masked | own full | own | own |
| client | hidden | hidden | hidden | own history |
| external_signer | hidden | hidden | hidden | package only |

---

## Explicit non-scope

Postgres · Supabase · Edge · email · PDF · signing capture · portal UI · Event Bus · Session · Auth wiring.

Next: **LC-2 / LC-3** — Legal Center provider factory in artist/staff/client lab shells.
