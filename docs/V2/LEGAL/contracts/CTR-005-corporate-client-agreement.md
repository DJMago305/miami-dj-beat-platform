# CTR-005 — Corporate Client Agreement

## Document metadata (Template Engine)

| # | Field | Value |
|---|-------|-------|
| 1 | **Official name** | Miami DJ Beat LLC — Corporate Client Master Agreement |
| 2 | **Internal code** | CTR-005 |
| 3 | **Objective** | Master terms for businesses, corporations, and commercial accounts booking through MDJB |
| 4 | **Parties** | Miami DJ Beat LLC · Corporate Client (entity) |
| 5 | **Structure** | Master terms · PO/billing · Events · Anti-Bypass · Confidentiality · Liability · Signatures |
| 6 | **Index** | §1–14 |
| 7 | **Mandatory sections** | Entity identification · Billing · Event orders · Anti-bypass · Indemnity |
| 8 | **Special clauses** | PO number field · Net-30 option (counsel) · Authorized signers list |
| 9 | **Dynamic fields** | `{company_legal_name}` `{company_ein}` `{billing_address}` `{authorized_signers[]}` `{po_number}` `{master_term_end}` |
| 10 | **Signature requirements** | Corporate rep + title; company seal optional |
| 11 | **Legal dependencies** | LGL-001–006; CTR-006 per event; `client.commercial` taxonomy |
| 12 | **Template Engine** | `template_id=CTR-005` · `gate=commercial_onboarding` |

**Document No:** MDJB-CTR-005-v1.0-DRAFT  

---

## FULL TEXT — DRAFT

**CORPORATE CLIENT MASTER AGREEMENT**

**Miami DJ Beat LLC** · **{company_legal_name}** · EIN: {company_ein}

### 1. Master Agreement

This Master Agreement governs entertainment services Client orders through Platform during term ending **{master_term_end}**. Individual events executed via Event Service Agreement (CTR-006) or Platform order.

### 2. Representations

Client represents authority of signatory, valid business standing, and accurate billing information.

### 3. Services

Platform provides marketplace coordination, talent matching, contracts, and payment processing. Performers remain independent contractors.

### 4. Ordering and PO

Client may issue PO **{po_number}** per event. Orders confirmed upon deposit per LGL-004.

### 5. Payment

Default: 30% deposit, 70% T-3. Alternative net terms only if signed addendum approved by MDJB management.

### 6. Anti-Bypass

Client shall not engage Platform-introduced Performers off-platform during Protected Period (LGL-003). Applies to affiliated entities and event planners acting for Client.

### 7. Replacement and Quality

Replacement Protocol (LGL-005) applies. Client shall provide safe venue and reasonable cooperation.

### 8. Confidentiality

Pricing and non-public event details confidential.

### 9. Indemnification

Client indemnifies Platform for claims from Client event conduct, venue violations, or guest injuries except Platform gross negligence.

### 10. Limitation of Liability

Cap: fees paid for specific event giving rise to claim.

### 11. Insurance

Client may be required to name Platform additional insured for large corporate events.

### 12. Dispute Resolution

Florida law. Arbitration. Class waiver.

### 13. Authorized Signers

{authorized_signers[]}

### 14. Signatures

**CLIENT:** _________________________ Title: _________ Date: _____  
**PLATFORM:** _________________________ Date: _____
