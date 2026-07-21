/** Phase 10 — Staff dashboard data provider — mock-only, no fetch. */

import type {
  StaffInvoice,
  StaffLead,
} from '../contracts/staff-dashboard-contracts';
import {
  StaffDashboardDataError,
  type StaffDashboardQueues,
  type StaffDashboardSnapshot,
  type StaffMetric,
  type StaffOperationsEvent,
} from '../contracts/staff-dashboard-contracts';
import {
  STAFF_ACTIVITY,
  STAFF_CRM,
  STAFF_DASHBOARD_KPIS,
  STAFF_MATCHING,
  STAFF_NOTIFICATIONS,
  STAFF_PRODUCTION,
  STAFF_PROFILE,
  STAFF_QUICK_ACTIONS,
  STAFF_REPORTS,
} from '../dashboard-mvp-data';
import { STAFF_MOCK_DASHBOARD_SNAPSHOT } from './staff-dashboard-mock-data';

export type StaffDashboardKpiView = {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
};

export type StaffProfileView = {
  readonly operatorName: string;
  readonly role: string;
  readonly status: string;
  readonly coverage: string;
};

export type StaffSummaryRowView = {
  readonly label: string;
  readonly value: string;
};

export type StaffActivityView = {
  readonly time: string;
  readonly detail: string;
};

export type StaffDashboardMvpView = {
  readonly kpis: readonly StaffDashboardKpiView[];
  readonly profile: StaffProfileView;
  readonly quickActions: readonly string[];
  readonly pipelineLeads: readonly StaffLead[];
  readonly invoiceQueue: readonly StaffInvoice[];
  readonly crm: readonly StaffSummaryRowView[];
  readonly productionSummaries: readonly string[];
  readonly matchingSummaries: readonly string[];
  readonly reports: readonly StaffSummaryRowView[];
  readonly notifications: readonly string[];
  readonly activity: readonly StaffActivityView[];
};

export type StaffDashboardDataProvider = {
  getMetrics(): readonly StaffMetric[];
  getEvents(): readonly StaffOperationsEvent[];
  getQueues(): StaffDashboardQueues;
  getDashboardSnapshot(): StaffDashboardSnapshot;
  getMvpView(): StaffDashboardMvpView;
};

const DEFAULT_MVP_VIEW: StaffDashboardMvpView = Object.freeze({
  kpis: STAFF_DASHBOARD_KPIS,
  profile: STAFF_PROFILE,
  quickActions: STAFF_QUICK_ACTIONS,
  pipelineLeads: STAFF_MOCK_DASHBOARD_SNAPSHOT.leads,
  invoiceQueue: STAFF_MOCK_DASHBOARD_SNAPSHOT.invoices,
  crm: STAFF_CRM,
  productionSummaries: STAFF_PRODUCTION,
  matchingSummaries: STAFF_MATCHING,
  reports: STAFF_REPORTS,
  notifications: STAFF_NOTIFICATIONS,
  activity: STAFF_ACTIVITY,
});

const EMPTY_MVP_VIEW: StaffDashboardMvpView = Object.freeze({
  kpis: Object.freeze([]),
  profile: Object.freeze({
    operatorName: '',
    role: '',
    status: '',
    coverage: '',
  }),
  quickActions: Object.freeze([]),
  pipelineLeads: Object.freeze([]),
  invoiceQueue: Object.freeze([]),
  crm: Object.freeze([]),
  productionSummaries: Object.freeze([]),
  matchingSummaries: Object.freeze([]),
  reports: Object.freeze([]),
  notifications: Object.freeze([]),
  activity: Object.freeze([]),
});

function cloneMvpView(view: StaffDashboardMvpView): StaffDashboardMvpView {
  return Object.freeze({
    kpis: Object.freeze([...view.kpis]),
    profile: Object.freeze({ ...view.profile }),
    quickActions: Object.freeze([...view.quickActions]),
    pipelineLeads: Object.freeze([...view.pipelineLeads]),
    invoiceQueue: Object.freeze([...view.invoiceQueue]),
    crm: Object.freeze([...view.crm]),
    productionSummaries: Object.freeze([...view.productionSummaries]),
    matchingSummaries: Object.freeze([...view.matchingSummaries]),
    reports: Object.freeze([...view.reports]),
    notifications: Object.freeze([...view.notifications]),
    activity: Object.freeze([...view.activity]),
  });
}

const EMPTY_SNAPSHOT: StaffDashboardSnapshot = Object.freeze({
  version: 1,
  metrics: Object.freeze([]),
  events: Object.freeze([]),
  queues: Object.freeze({
    matching: Object.freeze([]),
    production: Object.freeze([]),
  }),
  leads: Object.freeze([]),
  invoices: Object.freeze([]),
});

function cloneSnapshot(snapshot: StaffDashboardSnapshot): StaffDashboardSnapshot {
  return Object.freeze({
    version: snapshot.version,
    metrics: Object.freeze([...snapshot.metrics]),
    events: Object.freeze([...snapshot.events]),
    queues: Object.freeze({
      matching: Object.freeze([...snapshot.queues.matching]),
      production: Object.freeze([...snapshot.queues.production]),
    }),
    leads: Object.freeze([...snapshot.leads]),
    invoices: Object.freeze([...snapshot.invoices]),
  });
}

function assertValidSnapshot(snapshot: StaffDashboardSnapshot): void {
  if (!Number.isInteger(snapshot.version) || snapshot.version < 1) {
    throw new StaffDashboardDataError(
      'STAFF_DATA_SNAPSHOT_INVALID',
      'Staff dashboard snapshot version must be a positive integer.',
    );
  }

  if (
    !Array.isArray(snapshot.metrics) ||
    !Array.isArray(snapshot.events) ||
    !Array.isArray(snapshot.leads) ||
    !Array.isArray(snapshot.invoices) ||
    !snapshot.queues ||
    !Array.isArray(snapshot.queues.matching) ||
    !Array.isArray(snapshot.queues.production)
  ) {
    throw new StaffDashboardDataError(
      'STAFF_DATA_SNAPSHOT_INVALID',
      'Staff dashboard snapshot is missing required collections.',
    );
  }
}

export function createStaffDashboardDataProvider(
  snapshot: StaffDashboardSnapshot = STAFF_MOCK_DASHBOARD_SNAPSHOT,
  mvpView: StaffDashboardMvpView = DEFAULT_MVP_VIEW,
): StaffDashboardDataProvider {
  assertValidSnapshot(snapshot);
  const frozenSnapshot = cloneSnapshot(snapshot);
  const frozenMvpView = cloneMvpView(mvpView);

  return Object.freeze({
    getMetrics: () => frozenSnapshot.metrics,
    getEvents: () => frozenSnapshot.events,
    getQueues: () => frozenSnapshot.queues,
    getDashboardSnapshot: () => frozenSnapshot,
    getMvpView: () => frozenMvpView,
  });
}

export function createEmptyStaffDashboardDataProvider(): StaffDashboardDataProvider {
  return createStaffDashboardDataProvider(EMPTY_SNAPSHOT, EMPTY_MVP_VIEW);
}

let defaultProvider: StaffDashboardDataProvider = createStaffDashboardDataProvider();

export function getDefaultStaffDashboardDataProvider(): StaffDashboardDataProvider {
  return defaultProvider;
}

export function setDefaultStaffDashboardDataProviderForTests(
  provider: StaffDashboardDataProvider,
): void {
  defaultProvider = provider;
}

export function resetStaffDashboardDataProviderForTests(): void {
  defaultProvider = createStaffDashboardDataProvider();
}

export function serializeStaffDashboardSnapshot(snapshot: StaffDashboardSnapshot): string {
  assertValidSnapshot(snapshot);
  return JSON.stringify(snapshot);
}

export function parseStaffDashboardSnapshot(json: string): StaffDashboardSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new StaffDashboardDataError(
      'STAFF_DATA_SNAPSHOT_PARSE',
      'Staff dashboard snapshot JSON is malformed.',
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new StaffDashboardDataError(
      'STAFF_DATA_SNAPSHOT_PARSE',
      'Staff dashboard snapshot JSON must decode to an object.',
    );
  }

  const snapshot = parsed as StaffDashboardSnapshot;
  assertValidSnapshot(snapshot);
  return cloneSnapshot(snapshot);
}
