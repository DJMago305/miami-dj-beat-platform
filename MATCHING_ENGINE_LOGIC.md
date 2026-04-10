# MIAMI DJ BEAT PLATFORM — MATCHING ENGINE LOGIC (DETERMINISTIC)

This document defines the deterministic matching algorithm for the Miami DJ Beat Platform (the "Engine"). The Engine establishes compatibility based on discrete data points without the use of artificial intelligence or probabilistic inference.

## 1. DATA INPUTS

### Event Request Fields
- **Location**: Venue GPS coordinates / ZIP code.
- **Date & Time**: Start time, duration, and timezone.
- **Primary Genre**: Main musical style required.
- **Event Category**: Corporate, Wedding, Club, Private Party, etc.
- **Budget Range**: Maximum quote threshold.
- **Add-ons**: Equipment requirements (Sound, Lighting, Booth).

### DJ Profile Fields
- **Base Location**: Home GPS coordinates / service radius (km).
- **Calendar**: Real-time availability (iCal sync or Platform internal).
- **Genre Proficiency**: List of primary/secondary genres.
- **Pro Partner Status**: Active subscription status (Pro vs. Free).
- **Tier Level**: Annual performance tier (1, 2, or 3).
- **Avg. Rating**: Historical reputation score (1.0 - 5.0).
- **Equipment Inventory**: List of owned hardware matching Add-ons.

## 2. HARD FILTERS (MUST-PASS)
Candidates that fail any Hard Filter are excluded before scoring:
- **Availability**: DJ must have no conflicting BOOKED or IN_PROGRESS events during requested slot + 1h buffer.
- **Radius**: Venue location must be within DJ’s defined service radius.
- **Genre Match**: DJ must have the Event's Primary Genre listed in their Proficiency.
- **Budget compatibility**: DJ's base rate + Platform commission must be ≤ Event Budget.
- **Role Alignment**: Event Category must be allowed for DJ’s current background check/tier.

## 3. SOFT SCORING MODEL (0–100 POINTS)

Total Score = (Genre Proficiency * 0.40) + (Rating * 0.30) + (Pro Tier * 0.20) + (Distance * 0.10)

| Category | Weight | Logic |
| :--- | :--- | :--- |
| **Genre Proficiency** | 40% | Primary Match = 100 pts / Secondary Match = 60 pts. |
| **History/Rating** | 30% | Score = (Avg Rating / 5) * 100. |
| **Pro Tier** | 20% | Tier 3 = 100 pts / Tier 2 = 80 pts / Tier 1 = 60 pts. |
| **Distance** | 10% | Inverse distance score: (1 - [Dist / MaxRadius]) * 100. |

## 4. TIE-BREAK RULES
If two DJs have equal Soft Scores, the following priority applies:
1. **Subscription Seniority**: Longest active Pro Partner status.
2. **First to Accept**: Invitation delivery remains simultaneous, first responder wins.

## 5. PLAN GATING RULES
- **Active Selection**: ONLY Pro Partners with an active subscription can be assigned `MATCHED` status and accept events.
- **Free Plan Limitation**: Free Plan accounts are excluded from assignable matching and are visible only for internal availability statistics.

## 6. REPLACEMENT PROTOCOL (DJ_FAILED)

In the event of a confirmed `DJ_FAILED` state (DJ-initiated cancellation or no-show):

### 6.1 Replacement Scope Adjustments
Only the following Hard Filters may be expanded:

- **Radius Expansion**: Service radius may be increased up to 20% beyond the DJ’s declared radius.
- **Genre Flexibility**: Secondary Genre proficiency may be treated as Primary for matching purposes.
- **Tier Requirement**: If no Tier 3 Pro Partner is available, Tier 2 Pro Partners may be included.

The following filters SHALL NOT be relaxed:
- Budget compatibility
- Background check requirements
- Insurance / Corporate Coverage eligibility
- Availability buffer

### 6.2 Emergency Broadcast
The Engine performs an immediate broadcast to:
- Top 5 nearest eligible Pro Partners (Tier priority applies).

### 6.3 Acceptance Rule
- First confirmed acceptance locks the event.
- All other pending invitations are automatically voided.

## 7. DATA MINIMIZATION (PRE-PAID_FULL)
To protect privacy and prevent circumvention, the Engine regulates data visibility:
- **What DJ can see**: Event date, time, genre, general neighborhood (not exact address), and total net payout.
- **What DJ CANNOT see**: Client full name, client phone/email, exact street address, or venue contact person.
- **Release**: All logistics are unlocked only after state transition to **PAID_FULL**.

## 8. EDGE CASES
- **No DJs Available**: System alerts Admin manually; triggers radius expansion request to Client.
- **Client Edits Blueprint**: If edits invalidate Hard Filters (e.g., date change), the event is reverted to `REQUESTED` and re-matched.
- **Venue Restrictions**: If a venue requires specific insurance/security, only DJs verified for "Corporate Coverage" are eligible.

## 9. OUTPUT FORMAT
The Engine returns the **Top 3 Candidates** to the Admin/System with the follow explanation format:
> **DJ Name** - Total Score: [85/100]
> - **Match Reasons**: Target Genre (Primary), Pro Tier 3, Rating 4.9.
> - **Geo-Status**: Within 10km of venue.

## 10. ENFORCEMENT & AUDIT SIGNALS (ANTI-CIRCUMVENTION)

To protect Platform clients and prevent off-platform solicitation, the Engine and Platform shall generate audit signals and enforce operational safeguards.

### 10.1 Audit Signals (Flag Conditions)
A DJ account is flagged with `FLAG_CIRCUMVENTION_RISK` if any of the following occur:

- **Late Cancellations Pattern**: 2+ DJ-initiated cancellations within T ≤ 7 days in a rolling 90-day window.
- **Client Report**: Client selects “DJ contacted me directly / offered off-platform price.”
- **No-Show / DJ_FAILED**: Any confirmed `DJ_FAILED` incident.
- **Suspicious Re-Match Behavior**: DJ cancels and the same Client request is later completed off-platform (reported or evidenced).
- **Unusual Quote Behavior**: Repeated undercutting below minimum platform thresholds (if such thresholds are defined).

### 10.2 Automatic Safeguards
When flagged:
- **Payout Freeze**: Platform may temporarily freeze payouts and ledger withdrawals pending review.
- **Priority Downgrade**: Matching priority is reduced until the investigation is cleared.
- **Admin Review Required**: The DJ cannot be assigned `MATCHED` automatically; Admin approval is required.

All safeguards are subject to the investigation and due process procedures defined in the DJ Service Agreement.

### 10.3 Evidence Logging (Deterministic)
For every event, the Platform logs:
- Timestamped match invitations sent
- Acceptance time
- State transitions
- Cancellation initiator and time-to-event
- Client dispute / report metadata (non-sensitive)

These logs are used for contractual enforcement under the DJ Service Agreement and Official Payment Policy.
