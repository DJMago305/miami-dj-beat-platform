# MIAMI DJ BEAT PLATFORM — PRIVACY POLICY

Last Updated: September 26, 2026

At Miami DJ Beat ("the Platform"), we take your privacy and data security seriously. This Privacy Policy describes how we collect, use, and protect your information across our website, client portal, and management tools.

## 1. INFORMATION WE COLLECT

### 1.1 For Clients
- **Contact Information**: Name, email, phone number.
- **Event Logistics**: Venue address, event date, times, and specific service requirements.
- **Payment Data**: We use secure third-party processors (e.g., Stripe/Supabase). We do not store full credit card numbers on our local servers.

### 1.2 For DJs & Talents
- **Professional Identity**: Stage name, bio, high-quality profile photos, and social media links.
- **Technical Rider**: Equipment inventory and specialized skills.
- **Availability**: Real-time calendar data to enable deterministic matching.
- **Location Data**: Base location and service radius for geo-fencing event matches.

## 2. HOW WE USE YOUR DATA

- **Deterministic Matching**: We use GPS coordinates, genre proficiency, and availability to match DJs with events. We do **not** use probabilistic AI for selection.
- **Operational Efficiency**: To manage logistics, access codes, and contact info for confirmed events.
- **Compliance & Security**: To enforce our Anti-Circumvention protocols and ensure marketplace integrity.
- **Marketing (Optional)**: If you opt-in, we may send you updates about the platform or rewards programs.

## 3. DATA MINIMIZATION & PROTECTION PROTOCOLS

To protect the privacy of all parties and prevent data leakage or off-platform solicitation, we strictly regulate data visibility and professional conduct:
- **Pre-Booking**: DJs can only see the event's general neighborhood, date, and genre.
- **Post-Booking**: Exact addresses and contact names are only released after the state transition to **PAID_FULL** or as required by the operational timeline (T-3 days).
- **Anti-Leakage Safeguards**: Our contracts strictly prohibit DJs from sharing lead data with third-party companies or wearing external branding (advertisements) during Platform events.
- **Sensitive Data**: Access codes and private venue details are restricted to the matched DJ and the Platform Manager.

## 4. DATA RETENTION & SECURITY

- **Persistence**: We use Supabase for persistent data storage with strict Row Level Security (RLS) policies.
- **Ledger Integrity**: Financial transaction logs and ledger history are maintained for audit and tax purposes.
- **Encryption**: All data in transit is encrypted using industry-standard SSL/TLS protocols.

## 5. YOUR RIGHTS

- **Access & Portability**: You may request a copy of your stored profile data at any time.
- **Correction**: You can update your professional profile, technical rider, or contact info via the DJ Dashboard or Client Portal.
- **Deletion**: You may request account deletion. Note that certain transactional data (invoices, agreements) may be retained for legal and fulfillment reasons.

## 6. GOOGLE CALENDAR INTEGRATION

If you choose to connect your Google Calendar ("Sync Google Calendar" in your account settings), the Platform requests limited access to your calendar through Google's OAuth system:

- **What we access**: Only your event data (`calendar.events` scope): the titles, dates, times, notes and location of events in your calendars, including Google's birthdays calendar. The Platform can create, edit and delete calendar events, but only when you (or Platform staff acting on a booking) make that change inside the Platform. We do **not** request access to your Gmail, Google Drive, contacts, or any other Google product.
- **Why we access it**: To show your events on your Platform calendar, to reflect a confirmed booking on your Google Calendar once a purchase is completed, and to prepare birthday follow-ups for the clients and contacts of Miami DJ Beat LLC.
- **How it's stored**: Your Google authorization token (the refresh token) is stored encrypted in Supabase Vault and can only be read by our server-side functions; we do not store short-lived access tokens. The events we sync are stored in our Supabase database, where Row Level Security prevents other DJs and clients from reading them, and our database host encrypts stored data at rest. Access to synced events is limited to you, the Miami DJ Beat LLC owner and administrators, and staff members who use the Platform's internal assistant (ELIXIS) to review upcoming birthday follow-ups.
- **AI assistant**: When staff ask ELIXIS about upcoming birthdays, the names and dates of the relevant synced birthday events are sent to our AI provider (Anthropic) only to generate that answer. We do not use Google Calendar data to develop, improve or train AI or machine-learning models.
- **How to disconnect**: You can turn this off at any time from the "Sync Google Calendar" switch in your account settings, or by revoking the Platform's access directly from your [Google Account permissions page](https://myaccount.google.com/permissions). Turning the switch off pauses syncing; it does not by itself delete the authorization token or events that were already synced.
- **Retention and deletion**: We keep your Google authorization token and synced events while your connection is active or paused. To have them deleted, email **miamidjbeat@gmail.com** and we will delete your stored token and synced Google Calendar events within 30 days. Your original events in your Google Calendar are not affected.
- **No sharing**: We never sell your Google Calendar data, and we never use it for advertising. We do not share it with third parties except our infrastructure provider (Supabase), our AI provider as described above, or when required by law.
- **Google API Services User Data Policy**: Miami DJ Beat's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## 7. DISPUTE RESOLUTION

Any disputes regarding data privacy will be handled in accordance with the **Binding Arbitration** clause found in our [Client Terms](CLIENT_TERMS.md) and [DJ Service Agreement](DJ_AGREEMENT.md), governed by the laws of the State of Florida.

## 8. CONTACT US

For any questions regarding your privacy, contact our support team at:
**miamidjbeat@gmail.com**
