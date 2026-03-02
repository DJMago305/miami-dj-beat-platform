# MIAMI DJ BEAT PLATFORM — EVENT LIFECYCLE

## 1. REQUESTED
- **Trigger**: Client submits the event form.
- **System Action**: Validates input data; stores requirements; initializes Event Blueprint (v1.0).
- **Financial Action**: Quote generated; 30% deposit payment link issued to Client.
- **Allowed Transitions**: MATCHED, CANCELLED.

## 2. MATCHED
- **Trigger**: DJ Matching Engine identifies compatible DJ(s).
- **System Action**: Applies availability, genre, and location filters; notifies prioritized DJs. **24h Expiration**: Auto-expires to REQUESTED if no deposit is paid.
- **Financial Action**: Quote validity period enforced.
- **Allowed Transitions**: BOOKED, CANCELLED.

## 3. BOOKED
- **Trigger**: Client pays the 30% non-refundable deposit.
- **System Action**: Confirms booking; locks event date in chosen DJ's calendar; Blueprint state updated to "Locked".
- **Financial Action**: 30% non-refundable deposit collected and held in company escrow.
- **Allowed Transitions**: PAID_FULL, CANCELLED.

## 4. PAID_FULL
- **Trigger**: Automatic charge of the 70% balance (T-3 days before event).
- **System Action**: Releases final logistics and contact info to DJ; sends final confirmation to Client.
- **Financial Action**: 70% balance collected (Non-refundable for Client); 100% of event funds secured in company account.
- **Allowed Transitions**: IN_PROGRESS, CANCELLED.

## 5. IN_PROGRESS
- **Trigger**: Event scheduled start time reached (System clock).
- **System Action**: Active monitoring mode enabled; prioritizes support for active event.
- **Financial Action**: None.
- **Allowed Transitions**: COMPLETED.

## 6. COMPLETED
- **Trigger**: Event scheduled end time reached + final confirmation.
- **System Action**: Triggers Rating & Reputation system; archives Blueprint; generates final report.
- **Financial Action**: Releases payout to DJ (minus company commission); ledger entry finalized.
- **Allowed Transitions**: None.

## 7. CANCELLED
- **Trigger**: Client or Admin initiates cancellation.
- **System Action**: Releases DJ from calendar lock; updates logs; notifies affected parties.
- **Financial Action**: Client-initiated: 30% deposit forfeited if state was BOOKED; 100% total forfeited if state was PAID_FULL. Admin/DJ-initiated: 100% refund.
- **Allowed Transitions**: None.
