/** Phase 9 — Operations Preview — UI config (capabilities + dev preview roles). */

/** @deprecated Import metrics/events from staff/data/staff-dashboard-mock-data via StaffDashboardDataProvider. */
export {
  STAFF_MOCK_EVENTS as STAFF_OPERATIONS_PREVIEW_EVENTS,
  STAFF_MOCK_METRICS as STAFF_OPERATIONS_PREVIEW_METRICS,
} from './data/staff-dashboard-mock-data';

export const STAFF_OPERATIONS_CAPABILITY_CARDS = Object.freeze([
  { id: 'create-events', label: 'Create events', capabilityId: 'staff.leads.write' },
  { id: 'assign-djs', label: 'Assign DJs', capabilityId: 'staff.matching.run' },
  { id: 'generate-invoices', label: 'Generate invoices', capabilityId: 'staff.invoices.write' },
  { id: 'view-commissions', label: 'View commissions', capabilityId: 'staff.reports.read' },
  { id: 'manage-staff', label: 'Manage staff', capabilityId: 'staff.users.write' },
  { id: 'financial-access', label: 'Financial access', capabilityId: 'payments.write' },
] as const);

export const STAFF_PREVIEW_ROLE_DISPLAY = Object.freeze({
  'staff.owner': 'OWNER',
  'staff.manager': 'MANAGER',
  'staff.seller': 'SELLER',
} as const);

export const STAFF_PREVIEW_OPERATOR_NAMES = Object.freeze({
  'staff.owner': 'Gerardo A Valle',
  'staff.manager': 'Operations Manager',
  'staff.seller': 'Staff Seller',
} as const);
