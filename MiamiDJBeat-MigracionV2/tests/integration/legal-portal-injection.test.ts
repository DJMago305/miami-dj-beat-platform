/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { LEGAL_TEMPLATE_ASSET_URLS } from '../../shared/services/legal/assets/legal-template-asset-urls';
import { LEGAL_FIXTURE_PROFILE_IDS } from '../../shared/services/legal/in-memory';
import { resolveLegalProvider } from '../../shared/services/legal/provider';
import {
  buildArtistLegalCenterShellViewModel,
  buildClientLegalCenterShellViewModel,
  buildStaffLegalCenterShellViewModel,
} from '../../shared/services/legal/provider/legal-center-shell-mapper';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';
import {
  asSessionSnapshotWithPermissions,
  clearSession,
  getSessionSnapshot,
  initializeSession,
  ingestAuthHandle,
  resetSessionForTests,
  setSessionPermissionProfileForTests,
} from '../../shared/session/runtime';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUNTIME_W9_URL = LEGAL_TEMPLATE_ASSET_URLS['tax/SPC-001/TV-SPC-001-1/fw9-corporate'];

const STAFF_MAIN = resolve(REPO_ROOT, 'staff/main.ts');
const ARTIST_MAIN = resolve(REPO_ROOT, 'artist/main.ts');
const CLIENT_MAIN = resolve(REPO_ROOT, 'client/main.ts');

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

function validHandle(userId = 'user-staff-owner') {
  return {
    handoffId: 'handoff-staff-legal-1',
    userId,
    accessTokenRef: 'opaque-access-ref',
    refreshTokenRef: 'opaque-refresh-ref',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
  };
}

function bootSessionForStaffLegal(profile: 'staff.owner' | 'staff.manager' | 'staff.seller' = 'staff.owner'): void {
  resetSessionForTests();
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
  initializeSession({ portal: 'staff' });
  setSessionPermissionProfileForTests({ kind: 'staff', profileId: profile });
  ingestAuthHandle(validHandle());
}

function bootGuestStaffSession(): void {
  resetSessionForTests();
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
  initializeSession({ portal: 'staff' });
}

function expectFailClosedStaffSellerBundle(
  bundle: Awaited<ReturnType<typeof import('../../staff/legal/staff-legal-provider-wire').resolveStaffLegalPortalBundle>>,
): void {
  expect(bundle.role).toBe('staff_seller');
  expect(bundle.role).not.toBe('staff_owner');
  expect(bundle.role).not.toBe('staff_manager');
  expect('store' in bundle.provider).toBe(false);
}

async function expectFailClosedStaffSellerViewModel(
  bundle: Awaited<ReturnType<typeof import('../../staff/legal/staff-legal-provider-wire').resolveStaffLegalPortalBundle>>,
): Promise<void> {
  const model = await bundle.getViewModel();
  expect(model.state).toBe('ready');
  const shell = await buildStaffLegalCenterShellViewModel(bundle.provider, { role: bundle.role });
  const html = renderLegalCenterShell(shell).outerHTML;
  expect(html).not.toContain('Tax & W-9 Center');
  expect(html).not.toContain(RUNTIME_W9_URL);
  expect(html).not.toContain('Download W-9');
}

describe('legal portal injection — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"><div class="mdj-client-dashboard__grid"></div></main>';
  });

  it('13) portal entrypoints do not import in-memory service directly', () => {
    const staffMain = readFileSync(STAFF_MAIN, 'utf8');
    const artistMain = readFileSync(ARTIST_MAIN, 'utf8');
    const clientMain = readFileSync(CLIENT_MAIN, 'utf8');

    for (const source of [staffMain, artistMain, clientMain]) {
      expect(source).not.toMatch(/createInMemoryLegalService|createLegalInMemoryService/);
      expect(source).not.toMatch(/shared\/services\/legal\/in-memory/);
    }

    expect(staffMain).toContain('resolveStaffLegalPortalBundle');
    expect(artistMain).toContain('resolveArtistLegalPortalBundle');
    expect(clientMain).toContain('resolveClientLegalPortalBundle');
  });

  it('staff wire resolves bundle from session bridge without exposing store', async () => {
    bootSessionForStaffLegal('staff.owner');
    const snapshot = asSessionSnapshotWithPermissions(getSessionSnapshot());
    expect(snapshot.permissions.documentedRole).toBe('staff_owner');

    const { resolveStaffLegalPortalBundle } = await import('../../staff/legal/staff-legal-provider-wire');
    const bundle = resolveStaffLegalPortalBundle();
    expect(bundle.role).toBe('staff_owner');
    expect('store' in bundle.provider).toBe(false);
    const model = await bundle.getViewModel();
    expect(model.state).toBe('ready');
  });

  it('staff wire ignores previewRole URL and uses session permissions (fail-closed seller)', async () => {
    bootSessionForStaffLegal('staff.seller');

    const { resolveStaffLegalPortalBundle } = await import('../../staff/legal/staff-legal-provider-wire');
    const bundle = resolveStaffLegalPortalBundle();
    expect(bundle.role).toBe('staff_seller');
  });

  it('CASO A — guest session resolves staff_seller and denies owner/manager privileges', async () => {
    bootGuestStaffSession();
    const snapshot = asSessionSnapshotWithPermissions(getSessionSnapshot());
    expect(snapshot.user).toBeNull();
    expect(snapshot.permissions.documentedRole).toBe('guest');

    const { resolveStaffLegalPortalBundle } = await import('../../staff/legal/staff-legal-provider-wire');
    const bundle = resolveStaffLegalPortalBundle();
    expectFailClosedStaffSellerBundle(bundle);
    await expectFailClosedStaffSellerViewModel(bundle);
  });

  it('CASO B — previewRole=owner with guest session cannot elevate to owner or manager', async () => {
    bootGuestStaffSession();
    window.history.pushState({}, '', '/staff/?previewRole=owner');

    const snapshot = asSessionSnapshotWithPermissions(getSessionSnapshot());
    expect(snapshot.user).toBeNull();
    expect(snapshot.permissions.documentedRole).toBe('guest');

    const { resolveStaffLegalPortalBundle } = await import('../../staff/legal/staff-legal-provider-wire');
    const bundle = resolveStaffLegalPortalBundle();
    expectFailClosedStaffSellerBundle(bundle);
    await expectFailClosedStaffSellerViewModel(bundle);
  });

  it('CASO C — cleared session without valid identity resolves fail-closed to staff_seller', async () => {
    bootSessionForStaffLegal('staff.owner');
    const authenticated = asSessionSnapshotWithPermissions(getSessionSnapshot());
    expect(authenticated.permissions.documentedRole).toBe('staff_owner');

    clearSession('integration-test-cleared-identity');
    const cleared = asSessionSnapshotWithPermissions(getSessionSnapshot());
    expect(cleared.user).toBeNull();

    const { resolveStaffLegalPortalBundle } = await import('../../staff/legal/staff-legal-provider-wire');
    const bundle = resolveStaffLegalPortalBundle();
    expectFailClosedStaffSellerBundle(bundle);
    await expectFailClosedStaffSellerViewModel(bundle);
  });

  it('artist wire renders lab preview section into dashboard grid', async () => {
    const { resolveArtistLegalPortalBundle } = await import('../../artist/legal/artist-legal-provider-wire');
    const bundle = resolveArtistLegalPortalBundle();
    const grid = document.querySelector('.mdj-client-dashboard__grid') as HTMLElement;
    bundle.renderLegalCenterShell(grid);
    await bundle.getViewModel();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    expect(grid.querySelector('[data-mdj-legal-center-shell="artist"]')).not.toBeNull();
  });

  it('client wire renders lab preview section into dashboard grid', async () => {
    const { resolveClientLegalPortalBundle } = await import('../../client/legal/client-legal-provider-wire');
    const bundle = resolveClientLegalPortalBundle();
    const grid = document.querySelector('.mdj-client-dashboard__grid') as HTMLElement;
    bundle.renderLegalCenterShell(grid);
    await bundle.getViewModel();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    expect(grid.querySelector('[data-mdj-legal-center-shell="client"]')).not.toBeNull();
  });
});

describe('legal template asset integration — LC-5', () => {
  it('staff owner shell HTML exposes authorized W-9 download link', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildStaffLegalCenterShellViewModel(provider, { role: 'staff_owner' });
    const html = renderLegalCenterShell(shell).outerHTML;

    expect(html).toContain('Download W-9');
    expect(html).toContain(RUNTIME_W9_URL);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('artist shell HTML exposes authorized W-9 download link', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildArtistLegalCenterShellViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
    });
    const html = renderLegalCenterShell(shell).outerHTML;

    expect(html).toContain('Download W-9');
    expect(html).toContain(RUNTIME_W9_URL);
  });

  it('client shell HTML does not leak W-9 asset identifiers or runtime URL', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildClientLegalCenterShellViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.client,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
    });
    const html = renderLegalCenterShell(shell).outerHTML;

    expect(html).not.toContain('SPC-001');
    expect(html).not.toContain('TV-SPC-001-1');
    expect(html).not.toContain('fw9-corporate.pdf');
    expect(html).not.toContain(RUNTIME_W9_URL);
    expect(html).not.toContain('Tax & W-9 Center');
  });

  it('staff seller shell keeps fiscal section hidden and omits runtime W-9 URL', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildStaffLegalCenterShellViewModel(provider, { role: 'staff_seller' });
    const html = renderLegalCenterShell(shell).outerHTML;

    expect(html).not.toContain('Tax & W-9 Center');
    expect(html).not.toContain(RUNTIME_W9_URL);
    expect(html).not.toContain('Download W-9');
  });
});
