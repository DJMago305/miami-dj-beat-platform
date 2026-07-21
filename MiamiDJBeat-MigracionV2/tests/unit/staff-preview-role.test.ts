import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { STAFF_OPERATIONS_CAPABILITY_CARDS } from '../../staff/operations-preview-data';
import { getDefaultStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-data-provider';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';
import {
  applyStaffPreviewRoleForDev,
  parseStaffPreviewRoleFromUrl,
} from '../../staff/staff-preview-role';
import {
  asSessionSnapshotWithPermissions,
  getSessionPermissionProfileForTests,
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

const PREVIEW_CARD_CAPABILITY_IDS = STAFF_OPERATIONS_CAPABILITY_CARDS.map((card) => card.capabilityId);

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

function readySnapshot() {
  return asSessionSnapshotWithPermissions(getSessionSnapshot());
}

function countEnabledPreviewCards(root: ParentNode): number {
  return PREVIEW_CARD_CAPABILITY_IDS.filter((capabilityId) =>
    root.querySelector(`[data-mdj-capability="${capabilityId}"].mdj-operations-preview__capability--on`),
  ).length;
}

describe('Phase 9 — staff preview role permissions recalculation', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('parses only owner, manager, and seller preview roles', () => {
    expect(parseStaffPreviewRoleFromUrl('?previewRole=owner')).toBe('owner');
    expect(parseStaffPreviewRoleFromUrl('?previewRole=manager')).toBe('manager');
    expect(parseStaffPreviewRoleFromUrl('?previewRole=seller')).toBe('seller');
    expect(parseStaffPreviewRoleFromUrl('?previewRole=admin')).toBeNull();
    expect(parseStaffPreviewRoleFromUrl('')).toBeNull();
  });

  it('owner resolves staff_owner snapshot instead of guest after preview apply post-init', () => {
    bootStaffSessionWithPreview('?previewRole=owner');
    const snapshot = readySnapshot();

    expect(snapshot.permissions.documentedRole).toBe('staff_owner');
    expect(getSessionPermissionProfileForTests()).toEqual({
      kind: 'staff',
      profileId: 'staff.owner',
    });
    expect(hasSessionCapability('staff.leads.write', 'staff')).toBe(true);
    expect(hasSessionCapability('payments.write', 'staff')).toBe(true);
  });

  it('manager resolves staff_manager snapshot instead of guest after preview apply post-init', () => {
    bootStaffSessionWithPreview('?previewRole=manager');
    const snapshot = readySnapshot();

    expect(snapshot.permissions.documentedRole).toBe('staff_manager');
    expect(hasSessionCapability('staff.invoices.write', 'staff')).toBe(true);
    expect(hasSessionCapability('staff.matching.run', 'staff')).toBe(true);
  });

  it('seller resolves staff_seller snapshot instead of guest after preview apply post-init', () => {
    bootStaffSessionWithPreview('?previewRole=seller');
    const snapshot = readySnapshot();

    expect(snapshot.permissions.documentedRole).toBe('staff_seller');
    expect(hasSessionCapability('staff.reports.read', 'staff')).toBe(true);
    expect(hasSessionCapability('staff.leads.write', 'staff')).toBe(false);
    expect(hasSessionCapability('payments.write', 'staff')).toBe(false);
  });

  it('produces different effective preview capabilities across owner and seller', () => {
    bootStaffSessionWithPreview('?previewRole=owner');
    const ownerEnabled = PREVIEW_CARD_CAPABILITY_IDS.filter((capabilityId) =>
      hasSessionCapability(capabilityId, 'staff'),
    );

    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();

    bootStaffSessionWithPreview('?previewRole=seller');
    const sellerEnabled = PREVIEW_CARD_CAPABILITY_IDS.filter((capabilityId) =>
      hasSessionCapability(capabilityId, 'staff'),
    );

    expect(ownerEnabled.length).toBeGreaterThan(sellerEnabled.length);
    expect(ownerEnabled).toContain('staff.leads.write');
    expect(sellerEnabled).not.toContain('staff.leads.write');
    expect(sellerEnabled).toContain('staff.reports.read');
  });

  it('invalid previewRole keeps guest snapshot and denies staff write capabilities', () => {
    bootStaffSessionWithPreview('?previewRole=superadmin');
    const snapshot = readySnapshot();

    expect(snapshot.permissions.documentedRole).toBe('guest');
    expect(getSessionPermissionProfileForTests()).toEqual({ kind: 'guest' });
    expect(hasSessionCapability('staff.leads.write', 'staff')).toBe(false);
  });

  it('without previewRole keeps normal guest session behavior', () => {
    bootStaffSessionWithPreview('');
    const snapshot = readySnapshot();

    expect(snapshot.permissions.documentedRole).toBe('guest');
    expect(getSessionPermissionProfileForTests()).toEqual({ kind: 'guest' });
    expect(snapshot.capabilityCount).toBe(3);
    expect(hasSessionCapability('staff.leads.write', 'staff')).toBe(false);
  });

  it('does not apply preview profile when import.meta.env.DEV is false', () => {
    bootThroughErrorHandler();
    const originalDev = import.meta.env.DEV;
    import.meta.env.DEV = false;

    try {
      initializeSession({ portal: 'staff' });
      expect(applyStaffPreviewRoleForDev('?previewRole=owner')).toBeNull();
      expect(readySnapshot().permissions.documentedRole).toBe('guest');
    } finally {
      import.meta.env.DEV = originalDev;
    }
  });

  it('renderer reflects live session capabilities after preview apply post-init', () => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    bootStaffSessionWithPreview('?previewRole=owner');
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());
    expect(countEnabledPreviewCards(main)).toBe(6);

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
    renderStaffDashboardMvp(sellerMain, getDefaultStaffDashboardDataProvider());
    expect(countEnabledPreviewCards(sellerMain)).toBe(1);
  });
});
