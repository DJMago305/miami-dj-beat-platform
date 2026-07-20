import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  StaffDashboardDataError,
  type StaffDashboardSnapshot,
} from '../../staff/contracts/staff-dashboard-contracts';
import {
  createEmptyStaffDashboardDataProvider,
  createStaffDashboardDataProvider,
  getDefaultStaffDashboardDataProvider,
  parseStaffDashboardSnapshot,
  resetStaffDashboardDataProviderForTests,
  serializeStaffDashboardSnapshot,
} from '../../staff/data/staff-dashboard-data-provider';
import {
  STAFF_MOCK_DASHBOARD_SNAPSHOT,
  STAFF_MOCK_EVENTS,
  STAFF_MOCK_METRICS,
} from '../../staff/data/staff-dashboard-mock-data';
import { STAFF_OPERATIONS_CAPABILITY_CARDS } from '../../staff/operations-preview-data';
import { createOperationsPreviewSection } from '../../staff/render-operations-preview';
import { applyStaffPreviewRoleForDev } from '../../staff/staff-preview-role';
import {
  getSessionSnapshot,
  hasSessionCapability,
  initializeSession,
  resetSessionForTests,
} from '../../shared/session/runtime';
import { createComponentThemeBinding } from '../../shared/components/index';
import { getThemeDefinition } from '../../shared/theme/runtime/theme-registry';

const VALID_LOCAL_ENV = {
  MDJ_V2_ENV: 'local',
  MDJ_V2_APP_NAME: 'MiamiDJBeat-MigracionV2',
  MDJ_V2_DEPLOY_ROOT: '/',
  MDJ_V2_PORTAL_CLIENT_URL: 'http://localhost:5173/client/',
  MDJ_V2_PORTAL_ARTIST_URL: 'http://localhost:5173/artist/',
  MDJ_V2_PORTAL_STAFF_URL: 'http://localhost:5173/staff/',
  MDJ_V2_DEFAULT_LOCALE: 'en',
  MDJ_V2_DEFAULT_THEME: 'dark',
  MDJ_V2_LOG_LEVEL: 'debug',
  MDJ_V2_API_PUBLIC_URL: 'https://example.supabase.co',
  MDJ_V2_API_ANON_KEY: 'YOUR_ANON_KEY',
};

function bootThroughErrorHandler(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-012' });
  initializeErrorHandler();
}

function resolveThemeBinding() {
  const tokens = getThemeDefinition('mdj-dark-gold')?.tokens;
  if (!tokens) {
    throw new Error('mdj-dark-gold theme tokens are required');
  }
  return createComponentThemeBinding(tokens);
}

function countEnabledPreviewCards(root: ParentNode): number {
  return STAFF_OPERATIONS_CAPABILITY_CARDS.filter((card) =>
    root.querySelector(`[data-mdj-capability="${card.capabilityId}"].mdj-operations-preview__capability--on`),
  ).length;
}

describe('Phase 10 — StaffDashboardDataProvider', () => {
  beforeEach(() => {
    resetStaffDashboardDataProviderForTests();
  });

  it('returns approved mock metrics and events from default provider', () => {
    const provider = getDefaultStaffDashboardDataProvider();

    expect(provider.getMetrics()).toEqual(STAFF_MOCK_METRICS);
    expect(provider.getEvents()).toEqual(STAFF_MOCK_EVENTS);
    expect(provider.getQueues().matching).toHaveLength(3);
    expect(provider.getQueues().production).toHaveLength(3);
  });

  it('returns an empty provider with no metrics, events, or queues', () => {
    const provider = createEmptyStaffDashboardDataProvider();

    expect(provider.getMetrics()).toEqual([]);
    expect(provider.getEvents()).toEqual([]);
    expect(provider.getQueues().matching).toEqual([]);
    expect(provider.getQueues().production).toEqual([]);
    expect(provider.getDashboardSnapshot().leads).toEqual([]);
    expect(provider.getDashboardSnapshot().invoices).toEqual([]);
  });

  it('builds a complete dashboard snapshot from mock data', () => {
    const snapshot = getDefaultStaffDashboardDataProvider().getDashboardSnapshot();

    expect(snapshot.version).toBe(1);
    expect(snapshot.metrics).toHaveLength(4);
    expect(snapshot.events).toHaveLength(4);
    expect(snapshot.leads).toHaveLength(3);
    expect(snapshot.invoices).toHaveLength(3);
    expect(snapshot.queues.matching).toHaveLength(3);
    expect(snapshot.queues.production).toHaveLength(3);
    expect(snapshot).toEqual(STAFF_MOCK_DASHBOARD_SNAPSHOT);
  });

  it('serializes and parses a dashboard snapshot without data loss', () => {
    const snapshot = getDefaultStaffDashboardDataProvider().getDashboardSnapshot();
    const json = serializeStaffDashboardSnapshot(snapshot);
    const parsed = parseStaffDashboardSnapshot(json);

    expect(parsed).toEqual(snapshot);
    expect(JSON.parse(json)).toEqual(snapshot);
  });

  it('throws StaffDashboardDataError on malformed snapshot JSON', () => {
    expect(() => parseStaffDashboardSnapshot('{not-json')).toThrow(StaffDashboardDataError);
    expect(() => parseStaffDashboardSnapshot('"string-only"')).toThrow(StaffDashboardDataError);
  });

  it('throws StaffDashboardDataError when snapshot version is invalid', () => {
    const invalidSnapshot = {
      ...STAFF_MOCK_DASHBOARD_SNAPSHOT,
      version: 0,
    } as StaffDashboardSnapshot;

    expect(() => createStaffDashboardDataProvider(invalidSnapshot)).toThrow(StaffDashboardDataError);
    expect(() => serializeStaffDashboardSnapshot(invalidSnapshot)).toThrow(StaffDashboardDataError);
  });

  it('throws StaffDashboardDataError when snapshot collections are missing', () => {
    const invalidSnapshot = {
      version: 1,
      metrics: [],
      events: [],
      queues: { matching: [], production: [] },
      leads: [],
    } as unknown as StaffDashboardSnapshot;

    expect(() => createStaffDashboardDataProvider(invalidSnapshot)).toThrow(StaffDashboardDataError);
  });
});

describe('Phase 10 — Operations Preview consumes StaffDashboardDataProvider', () => {
  beforeEach(() => {
    resetStaffDashboardDataProviderForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('renders approved mock metrics and events through the provider', () => {
    const section = createOperationsPreviewSection(resolveThemeBinding());

    expect(section.textContent).toContain('Active events');
    expect(section.textContent).toContain('12');
    expect(section.textContent).toContain('Wedding Miami Beach');
    expect(section.textContent).toContain('Valle Events LLC');
    expect(section.querySelectorAll('.mdj-operations-preview__metric')).toHaveLength(4);
    expect(section.querySelectorAll('.mdj-operations-preview__table tbody tr')).toHaveLength(4);
  });

  it('renders empty metrics and events when provider has no data', () => {
    const section = createOperationsPreviewSection(
      resolveThemeBinding(),
      createEmptyStaffDashboardDataProvider(),
    );

    expect(section.querySelectorAll('.mdj-operations-preview__metric')).toHaveLength(0);
    expect(section.querySelectorAll('.mdj-operations-preview__table tbody tr')).toHaveLength(0);
    expect(section.querySelectorAll('.mdj-operations-preview__capability')).toHaveLength(6);
  });

  it('keeps preview role capabilities independent of dashboard data provider', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'staff' });
    applyStaffPreviewRoleForDev('?previewRole=owner');

    const section = createOperationsPreviewSection(
      resolveThemeBinding(),
      createEmptyStaffDashboardDataProvider(),
    );

    expect(getSessionSnapshot().state).toBe('SESSION_READY');
    expect(hasSessionCapability('staff.leads.write', 'staff')).toBe(true);
    expect(countEnabledPreviewCards(section)).toBe(6);
  });
});
