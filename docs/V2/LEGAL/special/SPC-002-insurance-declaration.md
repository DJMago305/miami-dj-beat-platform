# SPC-002 — Insurance Declaration

## Document metadata (Template Engine)

| # | Field | Value |
|---|-------|-------|
| 1 | **Official name** | Miami DJ Beat LLC — Certificate of Insurance Declaration |
| 2 | **Internal code** | SPC-002 |
| 3 | **Objective** | Collect and attest proof of general liability (and optional workers' comp) coverage |
| 4 | **Parties** | Insured (Performer/Vendor/Venue) · Miami DJ Beat LLC |
| 5 | **Structure** | Policy details · Coverage limits · Additional insured · Expiry · Attestation |
| 6 | **Index** | §1–7 |
| 7 | **Mandatory sections** | Carrier · Policy # · Limits · Expiry · Signature |
| 8 | **Special clauses** | MDJB additional insured when required · 30-day cancellation notice |
| 9 | **Dynamic fields** | `{insured_name}` `{carrier}` `{policy_number}` `{gl_limit}` `{effective_date}` `{expiry_date}` `{additional_insured}` |
| 10 | **Signature requirements** | Insured rep attestation; COI PDF upload |
| 11 | **Legal dependencies** | CTR-001, CTR-003, CTR-004 |
| 12 | **Template Engine** | `template_id=SPC-002` · `renewal=on_expiry` |

**Document No:** MDJB-SPC-002-v1.0-DRAFT  

---

## FULL TEXT — DRAFT

**INSURANCE DECLARATION**

### 1. Insured

**{insured_name}**

### 2. Coverage

| Item | Value |
|------|-------|
| Insurance carrier | {carrier} |
| Policy number | {policy_number} |
| General liability limit | ${gl_limit} per occurrence |
| Effective | {effective_date} |
| Expiration | {expiry_date} |

### 3. Additional Insured

☐ Miami DJ Beat LLC named additional insured for event: {event_id}  
☐ 30-day cancellation notice required

### 4. Attestation

I certify this COI is current and will maintain coverage through event date(s).

Signature: _________________________ Date: _________

### 5. Platform Acknowledgment

☐ Verified by MDJB staff: _________________ Date: _______

**Disclaimer:** Platform verification is administrative only — not insurance advice or guarantee of coverage.
