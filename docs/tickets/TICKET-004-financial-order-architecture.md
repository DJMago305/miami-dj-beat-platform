# TICKET-004 — Financial Order Architecture
**Status:** OPEN — Architecture defined, implementation pending  
**Priority:** Critical — foundation for all payment, ledger, and cashflow features  
**Author:** Captain (product owner)  
**Date:** 2026-05-22

---

## 1. Summary

Every event order must carry a structured financial model with **five separated layers**.  
No layer is visible to another role unless explicitly authorized.  
All financial movements are recorded in an **append-only ledger** — nothing is ever silently replaced.

---

## 2. Order Financial Structure

```
EVENT ORDER
├── A. Client Financials       (client sees this)
├── B. Talent Compensation     (assigned DJ sees this)
├── C. Company Financials      (owner/manager sees this)
├── D. Seller Commission       (seller sees own entry only)
├── E. Manager Commission      (manager sees own entry if applicable)
└── F. Ledger / Audit Trail    (append-only, never deleted)
```

---

## 3. Layer Definitions

### A. Client Financials — `order_client_financials`
What the client understands as "what they are paying."

| Field | Type | Notes |
|---|---|---|
| `event_total` | decimal | Agreed total with client |
| `deposit_required` | decimal | Amount required upfront |
| `deposit_received` | decimal | Amount actually received |
| `balance_pending` | decimal | `event_total - deposit_received` |
| `payment_due_dates` | jsonb | Array of scheduled payment dates |
| `invoices` | relation | Invoice records |

**Visible to:** Client (own portal only), Owner, Manager  
**NOT visible to:** DJ, Seller (unless authorized by Owner)

---

### B. Talent Compensation — `order_talent_compensation`
What the assigned DJ/artist is paid. Independent of event total.

| Field | Type | Notes |
|---|---|---|
| `dj_user_id` | uuid | FK to dj_profiles |
| `agreed_pay` | decimal | DJ's negotiated fee |
| `pay_status` | enum | `pending` / `confirmed` / `paid` |
| `pay_date` | date | Estimated or confirmed pay date |
| `pay_method` | text | Zelle / Cash / Transfer / etc. |
| `operational_notes` | text | Visible to DJ |

**Visible to:** Assigned DJ (own record only), Owner, Manager  
**NOT visible to:** Client, Other DJs, Seller  
**Rule:** Changing event total does NOT auto-change DJ pay — explicit edit required + ledger entry.

---

### C. Company Financials — `order_company_financials`
Full P&L view for the business.

| Field | Type | Notes |
|---|---|---|
| `event_total` | decimal | Mirror of client total |
| `deposit_received` | decimal | Mirror of client deposit |
| `balance_pending` | decimal | Computed |
| `operational_costs` | decimal | Logistics, venue, misc |
| `talent_cost` | decimal | Mirror of DJ pay |
| `seller_commission` | decimal | Computed or fixed |
| `manager_commission` | decimal | If applicable |
| `net_income` | decimal | `event_total - all_costs` |
| `margin_pct` | decimal | `net_income / event_total * 100` |

**Visible to:** Owner, Manager (administrative)  
**NOT visible to:** DJ, Seller, Client

---

### D. Seller Commission — `order_seller_commission`
Personal cashflow entry for the seller who closed/managed the sale.

| Field | Type | Notes |
|---|---|---|
| `seller_user_id` | uuid | FK to dj_profiles (role=seller) |
| `commission_amount` | decimal | Fixed or % of event_total |
| `commission_pct` | decimal | Percentage used if applicable |
| `status` | enum | `pending` / `approved` / `paid` |
| `pay_date` | date | |
| `recalculated_at` | timestamp | Set on price renegotiation |

**Visible to:** The specific Seller (own record only), Owner, Manager  
**Rule:** If price is renegotiated and commission is %-based → auto-recalculate + ledger entry.

---

### E. Manager Commission — `order_manager_commission`
Same structure as Seller Commission, applies when manager earns a cut.

**Visible to:** The specific Manager (own record only), Owner  
**Note:** Not all orders have a manager commission — field is nullable.

---

### F. Ledger / Audit Trail — `order_ledger`
Append-only. Every financial action generates one row. Never deleted, never updated.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `order_id` | uuid | FK to event_orders |
| `action_type` | enum | See action types below |
| `amount` | decimal | Monetary amount (nullable for non-money actions) |
| `previous_value` | jsonb | State before change |
| `new_value` | jsonb | State after change |
| `actor_user_id` | uuid | Who triggered the action |
| `actor_role` | text | Role at time of action |
| `method` | text | Payment method if applicable |
| `notes` | text | Free text / reason |
| `created_at` | timestamp | Immutable |

#### Action Types (enum)
```
order_created
price_changed
deposit_received
payment_received
commission_calculated
commission_recalculated
dj_pay_set
dj_pay_confirmed
dj_pay_changed
refund_issued
sale_closed
event_completed
event_cancelled
```

**Visible to:**
- Owner / Manager: full ledger
- Seller: only rows where `actor_user_id = self` OR `action_type IN (commission_calculated, commission_recalculated, commission_paid)`
- DJ: only rows where `action_type IN (dj_pay_set, dj_pay_confirmed, dj_pay_changed)` AND `order_id` in their assigned orders
- Client: only rows where `action_type IN (deposit_received, payment_received, refund_issued)` — their own orders

---

## 4. Renegotiation Rules

When `event_total` is changed:

```
1. Record ledger entry: price_changed (before/after)
2. Recalculate balance_pending = new_total - deposit_received
3. Recalculate seller_commission IF commission_pct is set → ledger: commission_recalculated
4. Recalculate manager_commission IF commission_pct is set → ledger: commission_recalculated
5. Recalculate net_income and margin in company_financials
6. DO NOT auto-change dj_pay — requires explicit edit → ledger: dj_pay_changed
7. Update client financials view
```

---

## 5. Ledger Example

```
[2026-05-22 13:40] order_created
  Total: $5,000 | Created by: Owner

[2026-05-23 10:12] deposit_received
  +$2,000 | Method: Zelle | Balance → $3,000

[2026-05-25 14:05] price_changed
  Before: $5,000 → After: $4,500 | Reason: discount
  Balance recalculated → $2,500

[2026-05-25 14:06] commission_recalculated
  Seller: Before $300 → After $250 (% of new total)

[2026-05-30 18:00] dj_pay_confirmed
  DJ Ariel Napole | $600 | Status: paid
```

---

## 6. Visibility Matrix Summary

| Data | Client | DJ | Seller | Manager | Owner |
|---|:---:|:---:|:---:|:---:|:---:|
| Event total (client view) | ✅ | ❌ | ⚙️ | ✅ | ✅ |
| Deposit / Balance | ✅ | ❌ | ⚙️ | ✅ | ✅ |
| DJ pay (own only) | ❌ | ✅ | ❌ | ✅ | ✅ |
| Company net income | ❌ | ❌ | ❌ | ✅ | ✅ |
| Margin % | ❌ | ❌ | ❌ | ✅ | ✅ |
| Own commission | ❌ | ❌ | ✅ | ✅ | ✅ |
| Full ledger | ❌ | ❌ | ❌ | ✅ | ✅ |
| Own ledger rows | ✅ | ✅ | ✅ | ✅ | ✅ |

⚙️ = configurable by Owner per Seller role settings

---

## 7. Implementation Scope (future tickets)

| Ticket | Scope |
|---|---|
| TICKET-004a | Supabase migration: `event_orders`, `order_client_financials`, `order_talent_compensation`, `order_company_financials`, `order_seller_commission`, `order_manager_commission`, `order_ledger` |
| TICKET-004b | RLS policies per table per role (enforce visibility matrix) |
| TICKET-004c | CRM UI in `account-profile.html` — connect to real DB data |
| TICKET-004d | Client portal: client financial view (deposit, balance, invoice) |
| TICKET-004e | DJ dashboard: talent compensation view (own pay only) |
| TICKET-004f | Seller panel: commission view + own ledger rows |
| TICKET-004g | Edge Functions: `record-deposit`, `record-payment`, `renegotiate-price`, `confirm-dj-pay`, `close-sale` |
| TICKET-004h | Cashflow dashboard: ledger-driven, no static numbers |

---

## 8. Critical Rules (non-negotiable)

1. **Cashflow is fed by the ledger, not static numbers.**
2. **DJ pay ≠ event total. Never mix them in the same view.**
3. **Seller/manager see only their own commission, not the full P&L.**
4. **Price renegotiation triggers recalculation cascade + ledger entries.**
5. **No ledger row is ever deleted or updated — only appended.**
6. **Client sees only their payment records — no company financials.**

---

## 9. Current State (2026-05-22)

The CRM table in `account-profile.html` reflects this architecture visually:
- `Cobro evento` column = Client Financials (staff-only, borde dorado)
- `Pago DJ` column = Talent Compensation (separate, borde azul)
- Data is currently hardcoded (Iris/Angel event) — pending DB connection (TICKET-004a/c)
- Ledger UI: not yet built — pending TICKET-004h
