/** Phase 10 — Staff dashboard data provider — mock-only, no fetch. */

import {
  StaffDashboardDataError,
  type StaffDashboardQueues,
  type StaffDashboardSnapshot,
  type StaffMetric,
  type StaffOperationsEvent,
} from '../contracts/staff-dashboard-contracts';
import { STAFF_MOCK_DASHBOARD_SNAPSHOT } from './staff-dashboard-mock-data';

export type StaffDashboardDataProvider = {
  getMetrics(): readonly StaffMetric[];
  getEvents(): readonly StaffOperationsEvent[];
  getQueues(): StaffDashboardQueues;
  getDashboardSnapshot(): StaffDashboardSnapshot;
};

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
): StaffDashboardDataProvider {
  assertValidSnapshot(snapshot);
  const frozenSnapshot = cloneSnapshot(snapshot);

  return Object.freeze({
    getMetrics: () => frozenSnapshot.metrics,
    getEvents: () => frozenSnapshot.events,
    getQueues: () => frozenSnapshot.queues,
    getDashboardSnapshot: () => frozenSnapshot,
  });
}

export function createEmptyStaffDashboardDataProvider(): StaffDashboardDataProvider {
  return createStaffDashboardDataProvider(EMPTY_SNAPSHOT);
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
