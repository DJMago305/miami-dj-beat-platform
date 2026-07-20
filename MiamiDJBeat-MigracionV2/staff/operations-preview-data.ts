/** Phase 9 — Operations Preview — mock data only (no backend). */

export const STAFF_OPERATIONS_PREVIEW_EVENTS = Object.freeze([
  { event: 'Wedding Miami Beach', client: 'Valle Events LLC', date: 'Aug 14, 2026', status: 'Confirmed' },
  { event: 'Corporate Dinner', client: 'Brickell Rooftop Co.', date: 'Aug 03, 2026', status: 'Production' },
  { event: 'Birthday Coral Gables', client: 'Miami Shores Villa', date: 'Jul 19, 2026', status: 'Lead' },
  { event: 'Fashion Show', client: 'Wynwood Creative Group', date: 'Sep 02, 2026', status: 'Matching' },
] as const);

export const STAFF_OPERATIONS_PREVIEW_METRICS = Object.freeze([
  { label: 'Active events', value: '12' },
  { label: 'Pending invoices', value: '7' },
  { label: 'DJs assigned', value: '18' },
  { label: 'Monthly sales', value: '$42,800' },
] as const);

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
