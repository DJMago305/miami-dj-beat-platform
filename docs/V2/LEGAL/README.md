# Miami DJ Beat LLC — Legal Documents Library (Draft Generation 1)

**Ticket:** TICKET-V2-LEGAL-CONTRACT-DRAFTING-001  
**Status:** DRAFT — Pending professional legal review  
**Jurisdiction:** State of Florida, United States  
**Entity:** Miami DJ Beat LLC  

> **Disclaimer:** All documents in this folder are **first-generation operational drafts**. They are **not** final legal advice and **not** guaranteed enforceable until reviewed and approved by qualified US counsel.

---

## Reference material (PO)

Six conceptual reference maquetas were reviewed (Mexico, Ecuador, Colombia, Peru, Tabasco MX). **No literal copy** was used. Structural ideas adapted:

| Reference concept | MDJB adaptation |
|-------------------|-----------------|
| Party declarations (MX) | Representations & Warranties |
| Event logistics blanks (PE/EC) | Dynamic fields in Event Service Agreement |
| Deposit / balance split (MX 50/50) | MDJB standard 30% / 70% T-3 |
| Equipment / venue power exclusion (MX) | Vendor + Event liability sections |
| Artist safety / harassment (EC) | Artist Agreement § Performance Safety |
| Travel / lodging (PE) | Event Agreement logistics addendum |
| Representation scope list (CO) | Artist Representation Agreement |
| Supervisor / intervenor (CO) | MDJB Event Coordinator role |
| Tabular party identification (CO) | Template Engine party block |

---

## Document index

### Level 1 — Platform Policies

| Code | File | Title |
|------|------|-------|
| LGL-001 | [policies/LGL-001-terms-of-service.md](./policies/LGL-001-terms-of-service.md) | Terms of Service |
| LGL-002 | [policies/LGL-002-privacy-policy.md](./policies/LGL-002-privacy-policy.md) | Privacy Policy |
| LGL-003 | [policies/LGL-003-anti-bypass-policy.md](./policies/LGL-003-anti-bypass-policy.md) | Anti-Bypass Policy |
| LGL-004 | [policies/LGL-004-payment-policy.md](./policies/LGL-004-payment-policy.md) | Payment Policy |
| LGL-005 | [policies/LGL-005-cancellation-policy.md](./policies/LGL-005-cancellation-policy.md) | Cancellation Policy |
| LGL-006 | [policies/LGL-006-platform-rules.md](./policies/LGL-006-platform-rules.md) | Platform Rules |

### Level 2 — Operational Contracts

| Code | File | Title |
|------|------|-------|
| CTR-001 | [contracts/CTR-001-dj-partner-agreement.md](./contracts/CTR-001-dj-partner-agreement.md) | DJ Partner Agreement |
| CTR-002 | [contracts/CTR-002-artist-agreement.md](./contracts/CTR-002-artist-agreement.md) | Artist Agreement |
| CTR-003 | [contracts/CTR-003-vendor-agreement.md](./contracts/CTR-003-vendor-agreement.md) | Vendor Agreement |
| CTR-004 | [contracts/CTR-004-venue-agreement.md](./contracts/CTR-004-venue-agreement.md) | Venue Agreement |
| CTR-005 | [contracts/CTR-005-corporate-client-agreement.md](./contracts/CTR-005-corporate-client-agreement.md) | Corporate Client Agreement |
| CTR-006 | [contracts/CTR-006-event-service-agreement.md](./contracts/CTR-006-event-service-agreement.md) | Event Service Agreement |
| CTR-007 | [contracts/CTR-007-artist-representation-agreement.md](./contracts/CTR-007-artist-representation-agreement.md) | Artist Representation Agreement |

### Level 3 — Special Documents

| Code | File | Title |
|------|------|-------|
| SPC-001 | [special/SPC-001-w9-package.md](./special/SPC-001-w9-package.md) | W-9 Package |
| SPC-002 | [special/SPC-002-insurance-declaration.md](./special/SPC-002-insurance-declaration.md) | Insurance Declaration |
| SPC-003 | [special/SPC-003-license-verification.md](./special/SPC-003-license-verification.md) | License Verification |
| SPC-004 | [special/SPC-004-exclusivity-agreement.md](./special/SPC-004-exclusivity-agreement.md) | Exclusivity Agreement |
| SPC-005 | [special/SPC-005-media-release-authorization.md](./special/SPC-005-media-release-authorization.md) | Media Release Authorization |

---

## Corporate visual design (Template Engine)

All documents share a **Miami DJ Beat LLC** print/digital shell — **not** the aesthetic of reference maquetas.

### Page format

| Property | Value |
|----------|-------|
| Size | A4 (210 × 297 mm) |
| Margins | 20 mm all sides (15 mm mobile reflow) |
| Body font | Source Serif 4 or equivalent — 11pt print / 16px mobile |
| Heading font | Cinzel (brand eyebrow) + system sans section titles |
| Line height | 1.45 body |
| Color | Black text; gold `#C9A227` accent rule only |

### Header block (every page)

```
┌────────────────────────────────────────────────────────────┐
│  [MDJB LOGO]          MIAMI DJ BEAT LLC                    │
│                       Entertainment Marketplace Platform    │
│  Doc No: {document_code}-{version}    Effective: {date}  │
│  Instance: {instance_id}              Page {n} of {total}  │
└────────────────────────────────────────────────────────────┘
```

### Footer block (every page)

```
──────────────────────────────────────────────────────────────
Miami DJ Beat LLC · Florida, USA · miamidjbeat@gmail.com
Document: {document_code} v{version} · Audit ID: {audit_id}
CONFIDENTIAL — Unauthorized reproduction prohibited.
```

### Signature block (final page)

```
PARTY SIGNATURES

___________________________    Date: _______________
Legal Name: {signer_legal_name}
Role: {signer_role}

[Electronic signature capture area — future]
[Initials blocks per section — when required]

AUDIT RECORD (system-generated, not hand-written)
Accepted: {utc_timestamp} · Method: {checkbox|signature|initials}
Document Version: {version} · IP Hash: {ip_hash} · Signer Email: {email}
```

### Section styling

- Numbered articles: `1.`, `1.1`, `(a)` hierarchy  
- Defined terms **bold** on first use  
- Critical clauses: left gold border 3px in PDF  
- Page breaks before Signatures and Exhibits  

---

## Introduction Registry (conceptual)

Protects MDJB commercial investment when parties are introduced through the Platform.

### Record schema

| Field | Type | Description |
|-------|------|-------------|
| `introduction_id` | UUID | Primary key |
| `performer_id` | UUID | DJ/artist MDJB profile |
| `performer_mdjb_id` | string | MDJB-A-* |
| `counterparty_type` | enum | `client` \| `venue` \| `restaurant` \| `club` \| `hotel` \| `corporate` \| `vendor` |
| `counterparty_id` | UUID | Profile or lead ID |
| `counterparty_name` | string | Legal or trade name |
| `counterparty_email` | string | Primary contact |
| `venue_id` | UUID nullable | If introduction via venue |
| `order_id` | UUID nullable | MOD-409 order |
| `lead_id` | UUID nullable | MOD-312 lead |
| `introduction_date` | date | UTC date protection starts |
| `introduction_source` | enum | `platform_match` \| `staff_intro` \| `event_booking` \| `inquiry` |
| `introduction_evidence` | string | Event / message / booking ref |
| `protection_status` | enum | `active` \| `expired` \| `waived` \| `disputed` |
| `protection_expires_at` | date | Default +24 months from introduction |
| `waiver_id` | UUID nullable | Staff-authorized exception |
| `created_by` | UUID | Staff or system |
| `updated_at` | timestamp | Audit |

### Valid introduction events

1. Client matched to performer through Platform matching engine.  
2. Staff records introduction in CRM with documented inquiry.  
3. Event Service Agreement signed linking both parties.  
4. Deposit paid on order where performer assigned.  

### Protection scope

While `protection_status = active`, performer **and** counterparty may not contract for substantially similar entertainment services off-platform without MDJB written waiver.

### Waiver workflow

`staff.manager` or `staff.owner` issues waiver document (SPC variant or LGL addendum) → `protection_status = waived` → `waiver_id` linked → expiry optional.

---

## Legal Template Engine compatibility

| Engine field | Maps to |
|--------------|---------|
| `template_id` | LGL-* / CTR-* / SPC-* |
| `template_version` | semver in document control |
| `locale` | `en` canonical; `es` secondary |
| `party_blocks[]` | Signer roles per document metadata |
| `field_schema` | Dynamic fields table in each doc |
| `signature_plan` | Signature requirements table in each doc |
| `clause_blocks[]` | Reusable: anti-bypass, arbitration, FL law |
| `render_profile` | `a4_print` \| `mobile` \| `pdf_final` |

---

## Cross-reference hierarchy

```
LGL-001 Terms of Service (master platform)
  ├── LGL-002 Privacy Policy
  ├── LGL-003 Anti-Bypass Policy
  ├── LGL-004 Payment Policy
  ├── LGL-005 Cancellation Policy
  └── LGL-006 Platform Rules

CTR-001 DJ Partner Agreement → incorporates LGL-003, LGL-004, LGL-005
CTR-006 Event Service Agreement → per-event; incorporates LGL-004, LGL-005
SPC-* → standalone or exhibit to CTR-001 / CTR-002 / CTR-003
```

---

## Next steps (post-draft)

1. PO review of draft generation 1.  
2. US counsel review (Florida commercial + independent contractor).  
3. Reconcile with `TICKET-V2-LEGAL-GOVERNANCE-FOUNDATION-001` lifecycle states.  
4. Template Engine implementation ticket (separate — not authorized here).
