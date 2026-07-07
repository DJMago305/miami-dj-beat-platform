/** MOD-012 Staff Dashboard — placeholder data — TICKET-MOD-012-STAFF-DASHBOARD-MVP-001 */

export const STAFF_DASHBOARD_KPIS = Object.freeze([
  { label: 'Open Leads', value: '14', hint: '5 awaiting qualification' },
  { label: 'Invoices Queue', value: '7', hint: '2 overdue reminders' },
  { label: 'Production Tasks', value: '11', hint: '3 events this week' },
  { label: 'Matching Queue', value: '5', hint: '2 urgent talent slots' },
] as const);

export const STAFF_PROFILE = Object.freeze({
  operatorName: 'Staff Operator',
  role: 'Operations Lead',
  status: 'On duty · Backoffice',
  coverage: 'Leads · Production · Matching',
} as const);

export const STAFF_QUICK_ACTIONS = Object.freeze([
  'Review Leads',
  'Create Invoice',
  'Match Talent',
  'Production Board',
  'Export Report',
] as const);

export const STAFF_LEADS = Object.freeze([
  {
    date: 'Jul 06, 2026',
    title: 'Coral Gables Wedding Inquiry',
    source: 'Website · VIP referral',
    status: 'New',
  },
  {
    date: 'Jul 05, 2026',
    title: 'Corporate Launch Party',
    source: 'Sales form · Brickell',
    status: 'Qualified',
  },
  {
    date: 'Jul 04, 2026',
    title: 'Yacht Celebration Package',
    source: 'Phone intake',
    status: 'Follow-up',
  },
] as const);

export const STAFF_INVOICES = Object.freeze([
  { id: 'INV-2208', client: 'Valle Events LLC', amount: '$3,420', status: 'Awaiting approval' },
  { id: 'INV-2201', client: 'Brickell Rooftop Co.', amount: '$1,240', status: 'Sent' },
  { id: 'INV-2194', client: 'Miami Shores Villa', amount: '$2,980', status: 'Paid' },
] as const);

export const STAFF_CRM = Object.freeze([
  { label: 'Active client accounts', value: '128' },
  { label: 'Artist roster contacts', value: '46' },
  { label: 'Follow-ups due today', value: '9' },
] as const);

export const STAFF_PRODUCTION = Object.freeze([
  'Aug 14 wedding — sound check pending',
  'Aug 03 corporate mixer — talent confirmed',
  'Jul 19 villa wedding — production sheet draft',
] as const);

export const STAFF_MATCHING = Object.freeze([
  'Open Format DJ — Jul 25 · Miami Shores',
  'Latin + EDM hybrid — Aug 08 · Wynwood',
  'Yacht MC + DJ combo — Aug 16 · Miami Beach',
] as const);

export const STAFF_REPORTS = Object.freeze([
  { label: 'Weekly lead conversion', value: '32%' },
  { label: 'Invoice aging (30d)', value: '$8,640' },
  { label: 'Matching SLA', value: '18h avg' },
] as const);

export const STAFF_NOTIFICATIONS = Object.freeze([
  'New lead assigned: Coral Gables Wedding Inquiry.',
  'Invoice INV-2208 requires manager approval.',
  'Matching slot opened for Aug 16 yacht event.',
] as const);

export const STAFF_ACTIVITY = Object.freeze([
  { time: 'Today · 2:10 PM', detail: 'Qualified corporate launch party lead for production handoff.' },
  { time: 'Today · 11:42 AM', detail: 'Updated matching queue for Wynwood club audition.' },
  { time: 'Jul 05 · 4:18 PM', detail: 'Exported weekly operations report to placeholder archive.' },
] as const);
