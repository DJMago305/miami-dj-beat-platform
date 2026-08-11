import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  STAFF_DASHBOARD_KPIS,
  STAFF_LEADS,
  STAFF_PROFILE,
} from '../../staff/dashboard-mvp-data';
import {
  getDefaultStaffDashboardDataProvider,
  resetStaffDashboardDataProviderForTests,
} from '../../staff/data/staff-dashboard-data-provider';
import { resolveStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-provider-factory';
import { STAFF_OPERATIONS_CAPABILITY_CARDS } from '../../staff/operations-preview-data';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';
import { applyStaffPreviewRoleForDev } from '../../staff/staff-preview-role';
import {
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

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RENDERER_PATH = resolve(REPO_ROOT, 'staff/render-staff-dashboard-mvp.ts');
const MAIN_PATH = resolve(REPO_ROOT, 'staff/main.ts');

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

describe('Phase 11-B — Staff dashboard provider unification', () => {
  beforeEach(() => {
    resetStaffDashboardDataProviderForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('keeps main.ts wired to resolveStaffDashboardDataProvider()', () => {
    const mainSource = readFileSync(MAIN_PATH, 'utf8');

    expect(mainSource).toContain('resolveStaffDashboardDataProvider()');
    expect(mainSource).toContain(
      'renderStaffDashboardMvp(mainRegion, staffDataProvider, sessionWiring, mutationsAdapter)',
    );
    expect(mainSource).toContain('resolveStaffSessionWiringPilot');
  });

  it('removes direct dashboard-mvp-data and provider resolution imports from the renderer', () => {
    const rendererSource = readFileSync(RENDERER_PATH, 'utf8');

    expect(rendererSource).not.toMatch(/from ['"]\.\/dashboard-mvp-data['"]/);
    expect(rendererSource).not.toMatch(/staff-dashboard-provider-factory/);
    expect(rendererSource).not.toMatch(/getDefaultStaffDashboardDataProvider/);
    expect(rendererSource).toContain('dataProvider: StaffDashboardDataProvider');
    expect(rendererSource).not.toMatch(
      /dataProvider:\s*StaffDashboardDataProvider\s*=/,
    );
  });

  it('supplies approved MVP mock content through the default provider', () => {
    const provider = getDefaultStaffDashboardDataProvider();
    const mvpView = provider.getMvpView();

    expect(mvpView.kpis).toEqual(STAFF_DASHBOARD_KPIS);
    expect(mvpView.profile).toEqual(STAFF_PROFILE);
    expect(mvpView.pipelineLeads).toHaveLength(STAFF_LEADS.length);
    expect(mvpView.pipelineLeads[0]?.title).toBe(STAFF_LEADS[0]?.title);
    expect(provider.getMetrics()).toHaveLength(4);
    expect(provider.getEvents()).toHaveLength(4);
  });

  it('renders the dashboard from an injected provider without fixture imports in the renderer', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, resolveStaffDashboardDataProvider());

    expect(main.textContent).toContain('Staff Operator');
    expect(main.textContent).toContain('Coral Gables Wedding Inquiry');
    expect(main.textContent).toContain('INV-2208');
    expect(main.querySelectorAll('[data-mdj-component="KpiCard"]')).toHaveLength(4);
  });

  it('preserves guest capability visibility at 0/6 through injected provider', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    bootStaffSessionWithPreview('');
    renderStaffDashboardMvp(main, resolveStaffDashboardDataProvider());

    expect(countEnabledPreviewCards(main)).toBe(0);
    expect(hasSessionCapability('staff.leads.write', 'staff')).toBe(false);
  });

  it('preserves owner capability visibility at 6/6 through injected provider', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    bootStaffSessionWithPreview('?previewRole=owner');
    renderStaffDashboardMvp(main, resolveStaffDashboardDataProvider());

    expect(countEnabledPreviewCards(main)).toBe(6);
  });

  it('preserves manager capability visibility at 6/6 through injected provider', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    bootStaffSessionWithPreview('?previewRole=manager');
    renderStaffDashboardMvp(main, resolveStaffDashboardDataProvider());

    expect(countEnabledPreviewCards(main)).toBe(6);
  });

  it('preserves seller capability visibility at 1/6 through injected provider', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    bootStaffSessionWithPreview('?previewRole=seller');
    renderStaffDashboardMvp(main, resolveStaffDashboardDataProvider());

    expect(countEnabledPreviewCards(main)).toBe(1);
    expect(hasSessionCapability('staff.reports.read', 'staff')).toBe(true);
    expect(hasSessionCapability('staff.leads.write', 'staff')).toBe(false);
  });

  it('keeps StaffDashboardDataProvider contract methods stable', () => {
    const provider = resolveStaffDashboardDataProvider();

    expect(typeof provider.getMetrics).toBe('function');
    expect(typeof provider.getEvents).toBe('function');
    expect(typeof provider.getQueues).toBe('function');
    expect(typeof provider.getDashboardSnapshot).toBe('function');
    expect(typeof provider.getMvpView).toBe('function');
  });
});
