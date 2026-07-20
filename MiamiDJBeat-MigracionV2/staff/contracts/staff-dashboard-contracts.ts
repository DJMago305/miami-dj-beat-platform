/** Phase 10 — Staff dashboard data contracts — TICKET-V2-PHASE-10-STAFF-OPERATIONS-DATA-CONTRACT-001 */

export type StaffMetric = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

export type StaffOperationsEvent = {
  readonly id: string;
  readonly event: string;
  readonly client: string;
  readonly date: string;
  readonly status: string;
};

export type StaffLead = {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly source: string;
  readonly status: string;
};

export type StaffInvoice = {
  readonly id: string;
  readonly client: string;
  readonly amount: string;
  readonly status: string;
};

export type StaffProductionTask = {
  readonly id: string;
  readonly summary: string;
};

export type StaffMatchingItem = {
  readonly id: string;
  readonly summary: string;
};

export type StaffDashboardQueues = {
  readonly matching: readonly StaffMatchingItem[];
  readonly production: readonly StaffProductionTask[];
};

export type StaffDashboardSnapshot = {
  readonly version: number;
  readonly metrics: readonly StaffMetric[];
  readonly events: readonly StaffOperationsEvent[];
  readonly queues: StaffDashboardQueues;
  readonly leads: readonly StaffLead[];
  readonly invoices: readonly StaffInvoice[];
};

export type StaffDashboardDataErrorCode = 'STAFF_DATA_SNAPSHOT_INVALID' | 'STAFF_DATA_SNAPSHOT_PARSE';

export class StaffDashboardDataError extends Error {
  readonly code: StaffDashboardDataErrorCode;

  constructor(code: StaffDashboardDataErrorCode, message: string) {
    super(message);
    this.name = 'StaffDashboardDataError';
    this.code = code;
  }
}
