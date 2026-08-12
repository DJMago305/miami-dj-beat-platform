/** MOD-010 Client Dashboard — placeholder data — TICKET-MOD-010-CLIENT-DASHBOARD-MVP-001 */

export const CLIENT_QUICK_ACTIONS = Object.freeze([
  'Request DJ',
  'Create Event',
  'View Orders',
  'Upload Documents',
  'Contact Support',
] as const);

export const CLIENT_UPCOMING_EVENTS = Object.freeze([
  {
    date: 'Aug 14, 2026',
    title: 'Coral Gables Wedding Reception',
    venue: 'The Biltmore · Miami',
    status: 'Confirmed',
  },
  {
    date: 'Sep 02, 2026',
    title: 'Corporate Launch Party',
    venue: 'Brickell Avenue Rooftop',
    status: 'Planning',
  },
  {
    date: 'Sep 21, 2026',
    title: 'Private Yacht Celebration',
    venue: 'Miami Beach Marina',
    status: 'Draft',
  },
] as const);

export const CLIENT_RECENT_ORDERS = Object.freeze([
  { id: 'ORD-1042', service: 'DJ + Lighting', amount: '$2,850', status: 'In progress' },
  { id: 'ORD-1038', service: 'Photo Booth Add-on', amount: '$640', status: 'Completed' },
  { id: 'ORD-1031', service: 'Ceremony Sound', amount: '$980', status: 'Awaiting payment' },
] as const);

export const CLIENT_PENDING_PAYMENTS = Object.freeze([
  { label: 'Balance due', value: '$1,240' },
  { label: 'Next auto-reminder', value: 'Jul 12' },
  { label: 'Payment method', value: 'Visa ···· 4242' },
] as const);

export const CLIENT_DOCUMENTS = Object.freeze([
  'Event Contract — Coral Gables Wedding',
  'Vendor Rider — Corporate Launch Party',
  'Insurance Certificate — On file',
] as const);

export const CLIENT_NOTIFICATIONS = Object.freeze([
  'Your event timeline was updated for Aug 14.',
  'Invoice INV-2201 is ready for review.',
  'VIP concierge assigned: Maria R.',
] as const);

export const CLIENT_ACTIVITY = Object.freeze([
  { time: 'Today · 2:10 PM', detail: 'Uploaded signed contract for Coral Gables Wedding.' },
  { time: 'Yesterday · 6:42 PM', detail: 'Requested DJ lineup options for launch party.' },
  { time: 'Jul 01 · 11:05 AM', detail: 'VIP tier upgraded to Gold membership.' },
] as const);

export const CLIENT_VIP = Object.freeze({
  tier: 'VIP Gold',
  perks: 'Priority booking · Exclusive discounts · Dedicated concierge',
  renewal: 'Renews Jan 2027',
} as const);

/**
 * Hero KPI strip, derived from the fixture arrays above instead of a second,
 * independent set of hardcoded numbers — so the Hero can never silently
 * drift out of sync with the sections it summarizes (audit finding,
 * 2026-08-12: the previous static CLIENT_DASHBOARD_KPIS didn't even agree
 * with CLIENT_RECENT_ORDERS's own length). Still lab-mock, same as every
 * other fixture in this file — just computed from one source, not two.
 */
export const CLIENT_DASHBOARD_KPIS = Object.freeze([
  {
    label: 'Active Events',
    value: String(CLIENT_UPCOMING_EVENTS.length),
    hint: `${CLIENT_UPCOMING_EVENTS.filter((e) => e.status === 'Confirmed').length} confirmed`,
  },
  {
    label: 'Open Orders',
    value: String(CLIENT_RECENT_ORDERS.length),
    hint: `${CLIENT_RECENT_ORDERS.filter((o) => o.status !== 'Completed').length} need action`,
  },
  {
    label: 'Pending Payments',
    value: CLIENT_PENDING_PAYMENTS.find((p) => p.label === 'Balance due')?.value ?? '—',
    hint: `Next reminder: ${CLIENT_PENDING_PAYMENTS.find((p) => p.label === 'Next auto-reminder')?.value ?? '—'}`,
  },
  {
    label: 'VIP Status',
    value: CLIENT_VIP.tier.replace(/^VIP\s+/, ''),
    hint: CLIENT_VIP.renewal,
  },
] as const);
