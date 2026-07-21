# CTR-006 — Event Service Agreement

## Document metadata (Template Engine)

| # | Field | Value |
|---|-------|-------|
| 1 | **Official name** | Miami DJ Beat LLC — Event Service Agreement |
| 2 | **Internal code** | CTR-006 |
| 3 | **Objective** | Per-event binding contract — Client, Platform, and assigned talent |
| 4 | **Parties** | Miami DJ Beat LLC · Client · Performer(s) (by reference/exhibit) |
| 5 | **Structure** | Event identification · Services · Schedule · Payment · Cancellation · Replacement · Logistics · Signatures |
| 6 | **Index** | §1–15 + Exhibits A–C |
| 7 | **Mandatory sections** | Event data · GBV · Deposit/balance · Cancellation · Anti-bypass · Signatures all parties |
| 8 | **Special clauses** | MDJB Event Coordinator · Introduction Registry trigger on deposit |
| 9 | **Dynamic fields** | `{order_id}` `{client_legal_name}` `{client_email}` `{event_name}` `{event_date}` `{venue_name}` `{venue_address}` `{start_time}` `{end_time}` `{services_description}` `{gbv_total}` `{deposit}` `{balance}` `{assigned_performers[]}` `{coordinator_name}` |
| 10 | **Signature requirements** | Client signature + deposit; Performer accept; MDJB counter-sign optional |
| 11 | **Legal dependencies** | LGL-004, LGL-005, LGL-003; CTR-001 or CTR-002; CTR-004 if venue |
| 12 | **Template Engine** | `template_id=CTR-006` · `gate=deposit_paid` · creates Introduction Registry entry |

**Document No:** MDJB-CTR-006-v1.0-DRAFT  

---

## FULL TEXT — DRAFT

**EVENT SERVICE AGREEMENT**

**Agreement No:** {order_id} · **Date:** {effective_date}

### PARTIES

| Role | Name | Email |
|------|------|-------|
| Platform | Miami DJ Beat LLC | miamidjbeat@gmail.com |
| Client | {client_legal_name} | {client_email} |
| Performer(s) | See Exhibit B | — |

**MDJB Event Coordinator:** {coordinator_name}

*Concept: supervisor/coordinator role — adapted from reference institutional contracts; MDJB staff coordinator.*

---

### 1. Event Identification

| Field | Value |
|-------|-------|
| Event name | {event_name} |
| Date | {event_date} |
| Venue | {venue_name} |
| Address | {venue_address} |
| Start / End | {start_time} – {end_time} |

### 2. Services

Platform coordinates delivery of: **{services_description}** by assigned Performer(s). Technical rider attached as **Exhibit A** when applicable.

### 3. Contract Price

| Item | Amount |
|------|--------|
| Gross Booking Value (GBV) | ${gbv_total} |
| Deposit (30%) | ${deposit} — due at signing |
| Balance (70%) | ${balance} — charged T-3 |

### 4. Payment Policy

Incorporates LGL-004. Client authorizes balance charge to payment method on file.

### 5. Cancellation and Refunds

Incorporates LGL-005. Client initials non-refundable deposit:

Initials: ______

### 6. Performer Substitution

Platform may substitute qualified Performer of equal or greater tier if original unavailable, with Client approval when practicable.

### 7. Client Responsibilities

Safe venue access, reasonable security, accurate event information, compliance with venue rules, payment on time.

### 8. Performer Responsibilities

Professional performance per CTR-001/002 and Platform Rules.

### 9. Anti-Bypass

Deposit triggers **Introduction** between Client and assigned Performer(s) under LGL-003.

### 10. Liability

Platform liability capped at fees paid for this event. Client responsible for guest conduct damage to equipment as documented.

### 11. Force Majeure

LGL-005 §7.

### 12. Media

SPC-005 applies if recording/marketing authorized.

### 13. Privacy

LGL-002. Contact details released per staged visibility rules.

### 14. Dispute Resolution

Florida law. Arbitration Miami-Dade.

### 15. Signatures

**CLIENT:** _________________________ Date: _________  
**PERFORMER (Exhibit B):** _________________________ Date: _________  
**MIAMI DJ BEAT LLC:** _________________________ Date: _________

---

**Exhibit A — Technical Rider**  
**Exhibit B — Assigned Performers** {assigned_performers[]}  
**Exhibit C — Venue Addendum (CTR-004)** if applicable
