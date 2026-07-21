# CTR-002 — Artist Agreement

## Document metadata (Template Engine)

| # | Field | Value |
|---|-------|-------|
| 1 | **Official name** | Miami DJ Beat LLC — Artist Performance Agreement |
| 2 | **Internal code** | CTR-002 |
| 3 | **Objective** | Bind non-DJ performers (singers, bands, MCs, dancers, etc.) to Platform terms |
| 4 | **Parties** | Miami DJ Beat LLC · Artist (individual or group representative) |
| 5 | **Structure** | Recitals · Scope · Event terms · Payment · Logistics · Safety · Anti-Bypass · IP · Signatures |
| 6 | **Index** | Articles 1–16 |
| 7 | **Mandatory sections** | Performance scope · Payment · Travel/lodging allocation · Safety · Anti-bypass |
| 8 | **Special clauses** | Group member list exhibit · Performance rights org disclaimer (US PRO) |
| 9 | **Dynamic fields** | `{artist_legal_name}` `{artist_category}` `{group_members[]}` `{performance_date}` `{venue}` `{start_time}` `{end_time}` `{fee_total}` `{travel_responsibility}` `{lodging_responsibility}` |
| 10 | **Signature requirements** | Artist full signature; group rep binds members |
| 11 | **Legal dependencies** | LGL-003–006; CTR-006; SPC-005 |
| 12 | **Template Engine** | `template_id=CTR-002` · `gate=roster_category_non_dj` |

**Document No:** MDJB-CTR-002-v1.0-DRAFT  

---

## FULL TEXT — DRAFT

**ARTIST PERFORMANCE AGREEMENT**

Between **Miami DJ Beat LLC** ("Platform") and **{artist_legal_name}** ("Artist") — Category: **{artist_category}**

### 1. Engagement

Platform engages Artist to provide professional performance services for events booked through the Platform. Specific events defined in Event Service Agreement (CTR-006) or attached **Event Exhibit**.

### 2. Event Details (Dynamic)

| Field | Value |
|-------|-------|
| Date | {performance_date} |
| Venue | {venue_name}, {venue_address} |
| Performance window | {start_time} – {end_time} |
| Total fee (GBV share) | ${fee_total} |

### 3. Payment

Per LGL-004. Artist Net Payout after Platform commission and event completion. Balance of Client payments triggers Artist payout only when Client funds collected per policy.

### 4. Logistics

**Travel:** {travel_responsibility — Client | Platform | Artist | Split}  
**Lodging:** {lodging_responsibility}  
**Backline / staging:** as Event Exhibit. Artist must confirm technical rider seven (7) days before event.

*Concept from reference artistic contracts (travel/lodging allocation) — US operational terms.*

### 5. Performance Standards

Artist arrives minimum sixty (60) minutes before performance unless otherwise agreed. Professional conduct per LGL-006.

### 6. Performance Safety

Artist may pause or stop if safety threatened. Client shall provide reasonable cooperation. Incidents reported within four (4) hours.

### 7. Cancellation

Per LGL-005. Artist no-show or cancellation after BOOKED = material breach.

### 8. Anti-Bypass

LGL-003 incorporated. Introduction protection applies to Clients and venues met through Platform.

### 9. Music / Content Rights

Artist warrants rights to perform repertoire. **US PRO fees** (ASCAP/BMI/SESAC venue licenses where applicable) are typically venue responsibility unless Event Exhibit states otherwise — not Peru-style PRO assignment.

### 10. Equipment Damage

Client responsible for damage to Artist equipment caused by guests where documented, subject to venue agreement.

### 11. Confidentiality and Data

As CTR-001 §9.

### 12. Media

Recording and publicity subject to SPC-005 Media Release when required.

### 13. Independent Contractor

Artist not employee of Platform.

### 14. Insurance

SPC-002 may be required for high-capacity events.

### 15. Governing Law

Florida. Arbitration Miami-Dade.

### 16. Signatures

**ARTIST:** _________________________ Date: _________  
**PLATFORM:** _________________________ Date: _________

**Exhibit A — Group Members (if applicable):** {group_members[]}
