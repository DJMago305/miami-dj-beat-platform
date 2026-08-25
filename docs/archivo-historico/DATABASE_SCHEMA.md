# Database Schema Requirements

To support the Client Portal and CRM expansion, the following tables and modifications are required in Supabase.

## Table: `leads` (Modifications)
Add the following columns to the existing `leads` table:
- `total_amount` (numeric, default 0): Total price of the event including taxes.
- `balance_paid` (numeric, default 0): Amount already paid by the client.
- `deposit_paid` (boolean, default false): Whether the initial reservation deposit has been paid.
- `final_payment_deadline` (timestamp): Calculated as event_date - 3 days.
- `manager_notes` (text): Internal notes for the manager.
- `client_logistics` (jsonb): Specific details like gate codes, contact person, etc.

## Table: `lead_items` (New)
Stores specific services/products added to a lead (Shopping Cart style).
- `id` (uuid, primary key)
- `lead_id` (uuid, foreign key to leads.id)
- `item_name` (text)
- `category` (text)
- `unit_price` (numeric)
- `quantity` (numeric)
- `is_taxable` (boolean, default true)

## Table: `installments` (New)
Tracks specific payments (abonos) made by the client.
- `id` (uuid, primary key)
- `lead_id` (uuid, foreign key to leads.id)
- `amount` (numeric)
- `payment_date` (timestamp)
- `payment_method` (text)
- `status` (text: 'PENDING', 'PAID')

## Table: `calendar_events` (New)
Tracks meetings and event-related dates.
- `id` (uuid, primary key)
- `lead_id` (uuid, foreign key to leads.id)
- `title` (text)
- `start_time` (timestamp)
- `end_time` (timestamp)
- `location` (text)
- `event_type` (text: 'MEETING', 'SITE_VISIT', 'EVENT')

## Table: `led_dj_ratings` (New)
Stores client feedback.
- `id` (uuid, primary key)
- `lead_id` (uuid, foreign key to leads.id)
- `dj_id` (uuid)
- `stars` (integer, 1-5)
- `feedback` (text)
- `detailed_questions` (jsonb): Specific answers for < 5 star ratings.
