/** Phase 10 — Staff dashboard mock records — approved Operations Preview placeholders only. */

import type {
  StaffDashboardSnapshot,
  StaffInvoice,
  StaffLead,
  StaffMatchingItem,
  StaffMetric,
  StaffOperationsEvent,
  StaffProductionTask,
} from '../contracts/staff-dashboard-contracts';

export const STAFF_MOCK_METRICS = Object.freeze([
  { id: 'metric-active-events', label: 'Active events', value: '12' },
  { id: 'metric-pending-invoices', label: 'Pending invoices', value: '7' },
  { id: 'metric-djs-assigned', label: 'DJs assigned', value: '18' },
  { id: 'metric-monthly-sales', label: 'Monthly sales', value: '$42,800' },
] as const satisfies readonly StaffMetric[]);

export const STAFF_MOCK_EVENTS = Object.freeze([
  {
    id: 'event-wedding-miami-beach',
    event: 'Wedding Miami Beach',
    client: 'Valle Events LLC',
    date: 'Aug 14, 2026',
    status: 'Confirmed',
  },
  {
    id: 'event-corporate-dinner',
    event: 'Corporate Dinner',
    client: 'Brickell Rooftop Co.',
    date: 'Aug 03, 2026',
    status: 'Production',
  },
  {
    id: 'event-birthday-coral-gables',
    event: 'Birthday Coral Gables',
    client: 'Miami Shores Villa',
    date: 'Jul 19, 2026',
    status: 'Lead',
  },
  {
    id: 'event-fashion-show',
    event: 'Fashion Show',
    client: 'Wynwood Creative Group',
    date: 'Sep 02, 2026',
    status: 'Matching',
  },
] as const satisfies readonly StaffOperationsEvent[]);

export const STAFF_MOCK_LEADS = Object.freeze([
  {
    id: 'lead-coral-gables-wedding',
    date: 'Jul 06, 2026',
    title: 'Coral Gables Wedding Inquiry',
    source: 'Website · VIP referral',
    status: 'New',
  },
  {
    id: 'lead-corporate-launch',
    date: 'Jul 05, 2026',
    title: 'Corporate Launch Party',
    source: 'Sales form · Brickell',
    status: 'Qualified',
  },
  {
    id: 'lead-yacht-celebration',
    date: 'Jul 04, 2026',
    title: 'Yacht Celebration Package',
    source: 'Phone intake',
    status: 'Follow-up',
  },
] as const satisfies readonly StaffLead[]);

export const STAFF_MOCK_INVOICES = Object.freeze([
  {
    id: 'INV-2208',
    client: 'Valle Events LLC',
    amount: '$3,420',
    status: 'Awaiting approval',
  },
  {
    id: 'INV-2201',
    client: 'Brickell Rooftop Co.',
    amount: '$1,240',
    status: 'Sent',
  },
  {
    id: 'INV-2194',
    client: 'Miami Shores Villa',
    amount: '$2,980',
    status: 'Paid',
  },
] as const satisfies readonly StaffInvoice[]);

export const STAFF_MOCK_PRODUCTION_TASKS = Object.freeze([
  { id: 'production-aug-14-wedding', summary: 'Aug 14 wedding — sound check pending' },
  { id: 'production-aug-03-mixer', summary: 'Aug 03 corporate mixer — talent confirmed' },
  { id: 'production-jul-19-villa', summary: 'Jul 19 villa wedding — production sheet draft' },
] as const satisfies readonly StaffProductionTask[]);

export const STAFF_MOCK_MATCHING_ITEMS = Object.freeze([
  { id: 'matching-jul-25-shores', summary: 'Open Format DJ — Jul 25 · Miami Shores' },
  { id: 'matching-aug-08-wynwood', summary: 'Latin + EDM hybrid — Aug 08 · Wynwood' },
  { id: 'matching-aug-16-yacht', summary: 'Yacht MC + DJ combo — Aug 16 · Miami Beach' },
] as const satisfies readonly StaffMatchingItem[]);

export const STAFF_MOCK_DASHBOARD_SNAPSHOT = Object.freeze({
  version: 1,
  metrics: STAFF_MOCK_METRICS,
  events: STAFF_MOCK_EVENTS,
  queues: Object.freeze({
    matching: STAFF_MOCK_MATCHING_ITEMS,
    production: STAFF_MOCK_PRODUCTION_TASKS,
  }),
  leads: STAFF_MOCK_LEADS,
  invoices: STAFF_MOCK_INVOICES,
} satisfies StaffDashboardSnapshot);
