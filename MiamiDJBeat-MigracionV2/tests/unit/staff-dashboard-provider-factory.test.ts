import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  createEmptyStaffDashboardDataProvider,
  getDefaultStaffDashboardDataProvider,
  type StaffDashboardDataProvider,
} from '../../staff/data/staff-dashboard-data-provider';
import {
  STAFF_MOCK_DASHBOARD_SNAPSHOT,
  STAFF_MOCK_EVENTS,
  STAFF_MOCK_METRICS,
} from '../../staff/data/staff-dashboard-mock-data';
import {
  resetStaffDashboardDataProviderForTests,
  resolveStaffDashboardDataProvider,
  setStaffDashboardDataProviderForTests,
} from '../../staff/data/staff-dashboard-provider-factory';
import { STAFF_OPERATIONS_CAPABILITY_CARDS } from '../../staff/operations-preview-data';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';
import { applyStaffPreviewRoleForDev } from '../../staff/staff-preview-role';
import {
  getSessionSnapshot,
  hasSessionCapability,
  initializeSession,
  resetSessionForTests,
} from '../../shared/session/runtime';

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

function bootStaffSessionWithPreview(search: string): void {
  bootThroughErrorHandler();
  initializeSession({ portal: 'staff' });
  applyStaffPreviewRoleForDev(search);
}

function countEnabledPreviewCards(root: ParentNode): number {
  return STAFF_OPERATIONS_CAPABILITY_CARDS.filter((card) =>
    root.querySelector(`[data-mdj-capability="${card.capabilityId}"].mdj-operations-preview__capability--on`),
  ).length;
}

function countOperationsMetrics(root: ParentNode): number {
  return root.querySelectorAll('.mdj-operations-preview__metric').length;
}

function countOperationsEvents(root: ParentNode): number {
  return root.querySelectorAll('.mdj-operations-preview__table tbody tr').length;
}

function createTestProvider(label: string): StaffDashboardDataProvider {
  const emptyMvpView = createEmptyStaffDashboardDataProvider().getMvpView();

  return Object.freeze({
    getMetrics: () => [{ id: 'test-metric', label, value: '99' }],
    getEvents: () => [
      {
        id: 'test-event',
        event: `${label} Event`,
        client: 'Factory Test Client',
        date: 'Jan 01, 2026',
        status: 'Test',
      },
    ],
    getQueues: () => ({ matching: [], production: [] }),
    getDashboardSnapshot: () => ({
      version: 1,
      metrics: [{ id: 'test-metric', label, value: '99' }],
      events: [
        {
          id: 'test-event',
          event: `${label} Event`,
          client: 'Factory Test Client',
          date: 'Jan 01, 2026',
          status: 'Test',
        },
      ],
      queues: { matching: [], production: [] },
      leads: [],
      invoices: [],
    }),
    getMvpView: () => emptyMvpView,
  });
}

describe('Phase 11-A — StaffDashboardDataProvider factory', () => {
  beforeEach(() => {
    resetStaffDashboardDataProviderForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('returns the approved mock provider by default', () => {
    const provider = resolveStaffDashboardDataProvider();

    expect(provider.getMetrics()).toEqual(STAFF_MOCK_METRICS);
    expect(provider.getEvents()).toEqual(STAFF_MOCK_EVENTS);
    expect(provider.getDashboardSnapshot()).toEqual(STAFF_MOCK_DASHBOARD_SNAPSHOT);
  });

  it('resolves deterministically across consecutive calls', () => {
    const first = resolveStaffDashboardDataProvider();
    const second = resolveStaffDashboardDataProvider();

    expect(first).toBe(second);
    expect(first.getMetrics()).toEqual(second.getMetrics());
    expect(first.getEvents()).toEqual(second.getEvents());
  });

  it('does not depend on Session initialization', () => {
    const provider = resolveStaffDashboardDataProvider();

    expect(provider.getMetrics()).toHaveLength(4);
    expect(provider.getEvents()).toHaveLength(4);
    expect(provider.getDashboardSnapshot()).toEqual(STAFF_MOCK_DASHBOARD_SNAPSHOT);
  });

  it('does not depend on permission profiles or preview roles', () => {
    bootStaffSessionWithPreview('?previewRole=owner');
    const ownerProvider = resolveStaffDashboardDataProvider();

    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();

    bootStaffSessionWithPreview('?previewRole=seller');
    const sellerProvider = resolveStaffDashboardDataProvider();

    expect(ownerProvider.getMetrics()).toEqual(sellerProvider.getMetrics());
    expect(ownerProvider.getEvents()).toEqual(sellerProvider.getEvents());
    expect(ownerProvider.getDashboardSnapshot()).toEqual(sellerProvider.getDashboardSnapshot());
  });

  it('routes a test-substituted provider into the renderer', () => {
    const customProvider = createTestProvider('Injected');
    setStaffDashboardDataProviderForTests(customProvider);

    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, resolveStaffDashboardDataProvider());

    expect(main.textContent).toContain('Injected');
    expect(main.textContent).toContain('Injected Event');
    expect(main.textContent).toContain('Factory Test Client');
    expect(countOperationsMetrics(main)).toBe(1);
    expect(countOperationsEvents(main)).toBe(1);
  });

  it('restores the approved mock provider after reset', () => {
    setStaffDashboardDataProviderForTests(createTestProvider('Temporary'));
    expect(resolveStaffDashboardDataProvider().getMetrics()[0]?.label).toBe('Temporary');

    resetStaffDashboardDataProviderForTests();
    const restored = resolveStaffDashboardDataProvider();

    expect(restored.getMetrics()).toEqual(STAFF_MOCK_METRICS);
    expect(restored.getEvents()).toEqual(STAFF_MOCK_EVENTS);
  });

  it('renders zero metrics and zero events while keeping capability cards intact', () => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, createEmptyStaffDashboardDataProvider());

    expect(countOperationsMetrics(main)).toBe(0);
    expect(countOperationsEvents(main)).toBe(0);
    expect(main.querySelectorAll('.mdj-operations-preview__capability')).toHaveLength(6);
  });

  it('keeps owner, manager, and seller capability counts independent of provider data', () => {
    const emptyProvider = createEmptyStaffDashboardDataProvider();

    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
    const ownerMain = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(ownerMain).not.toBeNull();
    if (!ownerMain) return;

    bootStaffSessionWithPreview('?previewRole=owner');
    renderStaffDashboardMvp(ownerMain, emptyProvider);
    expect(getSessionSnapshot().state).toBe('SESSION_READY');
    expect(countEnabledPreviewCards(ownerMain)).toBe(6);
    expect(countOperationsMetrics(ownerMain)).toBe(0);

    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
    const managerMain = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(managerMain).not.toBeNull();
    if (!managerMain) return;

    bootStaffSessionWithPreview('?previewRole=manager');
    renderStaffDashboardMvp(managerMain, emptyProvider);
    expect(countEnabledPreviewCards(managerMain)).toBe(6);

    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
    const sellerMain = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(sellerMain).not.toBeNull();
    if (!sellerMain) return;

    bootStaffSessionWithPreview('?previewRole=seller');
    renderStaffDashboardMvp(sellerMain, emptyProvider);
    expect(countEnabledPreviewCards(sellerMain)).toBe(1);
    expect(hasSessionCapability('staff.reports.read', 'staff')).toBe(true);
    expect(hasSessionCapability('staff.leads.write', 'staff')).toBe(false);
  });

  it('preserves approved mock metrics and events through the renderer default path', () => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    expect(main.textContent).toContain('Active events');
    expect(main.textContent).toContain('12');
    expect(main.textContent).toContain('Wedding Miami Beach');
    expect(main.textContent).toContain('Valle Events LLC');
    expect(countOperationsMetrics(main)).toBe(4);
    expect(countOperationsEvents(main)).toBe(4);
  });

  it('does not perform fetch, RPC, or Supabase calls while resolving data', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch must not run'));

    try {
      const provider = resolveStaffDashboardDataProvider();
      expect(provider.getMetrics()).toHaveLength(4);
      expect(provider.getEvents()).toHaveLength(4);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
