/** LC-13B — Staff legal provider wire lookup binding tests */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { resolvePermissionSnapshot } from '../../shared/permissions/runtime';
import {
  createLegalProfileAccessPrefetchService,
  resetLegalProfileResolutionCacheForTests,
  resolveLegalProfileLookupPort,
  setLegalProfileLookupBindingModeForTests,
  LegalProfileResolutionCache,
} from '../../shared/services/legal/persistence/identity';
import {
  createApiClient,
  createMemoryTransport,
  resetApiRequestCounterForTests,
} from '../../shared/api/runtime';
import * as sessionModule from '../../shared/session/runtime';
import { resolveStaffLegalPortalBundle } from '../../staff/legal/staff-legal-provider-wire';

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

function mockStaffOwnerSession(): void {
  vi.spyOn(sessionModule, 'getSessionSnapshot').mockReturnValue(
    Object.freeze({
      user: Object.freeze({ userId: 'user-staff-owner' }),
      portal: 'staff',
      roles: Object.freeze([]),
      capabilities: Object.freeze([]),
      locale: 'en',
      theme: 'dark',
      featureFlags: Object.freeze({}),
      sessionId: 'sess-staff-owner',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      hydrationPhase: 'signed_in',
      state: 'SESSION_READY',
      snapshotVersion: 1,
      updatedAt: new Date().toISOString(),
      isRefreshing: false,
    }),
  );

  vi.spyOn(sessionModule, 'asSessionSnapshotWithPermissions').mockImplementation(
    (snapshot) =>
      Object.freeze({
        ...snapshot,
        permissions: resolvePermissionSnapshot({
          profile: { kind: 'staff', profileId: 'staff.owner' },
          portal: 'staff',
          userId: 'user-staff-owner',
        }),
      }) as sessionModule.SessionSnapshotWithPermissions,
  );
}

describe('Staff legal provider wire — LC-13B lookup binding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
    resetLegalProfileResolutionCacheForTests();
    initializeConfiguration(VALID_LOCAL_ENV);
    setLegalProfileLookupBindingModeForTests(null);
    sessionModule.resetSessionForTests();
  });

  it('memory mode preserves owner resolution from fixtures', () => {
    setLegalProfileLookupBindingModeForTests('MEMORY_FIXTURE');
    mockStaffOwnerSession();

    const bundle = resolveStaffLegalPortalBundle();

    expect(bundle.role).toBe('staff_owner');
    expect(
      resolveLegalProfileLookupPort().lookup(
        Object.freeze({
          authUserId: 'user-staff-owner',
          profileKind: 'staff',
          documentedRole: 'staff_owner',
        }),
      ).ok,
    ).toBe(true);
  });

  it('cache-backed mode fail-closes to seller when cache is empty', () => {
    setLegalProfileLookupBindingModeForTests('CACHE_BACKED');
    mockStaffOwnerSession();

    const bundle = resolveStaffLegalPortalBundle();

    expect(bundle.role).toBe('staff_seller');
  });

  it('cache-backed mode resolves owner after prefetch', async () => {
    setLegalProfileLookupBindingModeForTests('CACHE_BACKED');
    const cache = new LegalProfileResolutionCache();

    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: Object.freeze({
        ok: true,
        actor_type: 'staff',
        actor_role: 'owner',
        business_entity_id: 'STAFF-OWNER-001',
        recipient_scope: null,
        profile_status: 'active',
        revision: '2026-07-22T12:00:00Z',
      }),
    });
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const prefetch = createLegalProfileAccessPrefetchService(cache);
    const session = Object.freeze({
      user: Object.freeze({ userId: 'user-staff-owner' }),
      portal: 'staff' as const,
      roles: Object.freeze([]),
      capabilities: Object.freeze([]),
      locale: 'en' as const,
      theme: 'dark' as const,
      featureFlags: Object.freeze({}),
      sessionId: 'sess-staff-owner',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      hydrationPhase: 'signed_in' as const,
      state: 'SESSION_READY' as const,
      snapshotVersion: 1,
      updatedAt: new Date().toISOString(),
      isRefreshing: false,
    });
    const permissions = resolvePermissionSnapshot({
      profile: { kind: 'staff', profileId: 'staff.owner' },
      portal: 'staff',
      userId: 'user-staff-owner',
    });

    await prefetch.prefetch({ session, permissions, apiClient, cache });

    const lookup = resolveLegalProfileLookupPort({ mode: 'CACHE_BACKED', resolutionCache: cache });
    const { resolveLegalReadAccessContextFromSession } = await import(
      '../../shared/services/legal/persistence/identity'
    );
    const bridgeResult = resolveLegalReadAccessContextFromSession({
      session,
      permissions,
      legalProfileLookup: lookup,
    });

    expect(bridgeResult.ok).toBe(true);
    if (bridgeResult.ok) {
      expect(bridgeResult.value.role).toBe('owner');
    }
  });
});
