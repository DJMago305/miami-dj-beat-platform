/** LC-13B — Legal profile access prefetch unit tests */

import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { resolvePermissionSnapshot } from '../../shared/permissions/runtime';
import {
  createApiClient,
  createMemoryTransport,
  resetApiRequestCounterForTests,
} from '../../shared/api/runtime';
import {
  LEGAL_RESOLVE_PROFILE_ACCESS_RPC,
  LegalProfileResolutionCache,
  createLegalProfileAccessPrefetchService,
} from '../../shared/services/legal/persistence/identity';
import type { SessionSnapshot } from '../../shared/session/runtime/types';

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

function baseSession(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return Object.freeze({
    user: Object.freeze({ userId: 'user-staff-owner' }),
    portal: 'staff',
    roles: Object.freeze([]),
    capabilities: Object.freeze([]),
    locale: 'en',
    theme: 'dark',
    featureFlags: Object.freeze({}),
    sessionId: 'sess-prefetch-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    hydrationPhase: 'signed_in',
    state: 'SESSION_READY',
    snapshotVersion: 1,
    updatedAt: new Date().toISOString(),
    isRefreshing: false,
    ...overrides,
  });
}

function staffOwnerPermissions(userId: string) {
  return resolvePermissionSnapshot({
    profile: { kind: 'staff', profileId: 'staff.owner' },
    portal: 'staff',
    userId,
  });
}

function validStaffOwnerRpcBody() {
  return Object.freeze({
    ok: true,
    actor_type: 'staff',
    actor_role: 'owner',
    business_entity_id: 'STAFF-OWNER-001',
    recipient_scope: null,
    profile_status: 'active',
    revision: '2026-07-22T12:00:00Z',
  });
}

describe('LegalProfileAccessPrefetchService — LC-13B', () => {
  beforeEach(() => {
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
    initializeConfiguration(VALID_LOCAL_ENV);
  });

  it('prefetches a valid RPC response into cache', async () => {
    const cache = new LegalProfileResolutionCache();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: validStaffOwnerRpcBody() });
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);
    const session = baseSession();
    const permissions = staffOwnerPermissions('user-staff-owner');

    const result = await service.prefetch({ session, permissions, apiClient, cache });

    expect(result.ok).toBe(true);
    expect(cache.has(
      Object.freeze({
        authUserId: 'user-staff-owner',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
    )).toBe(true);
  });

  it('rejects malformed RPC responses without writing cache', async () => {
    const cache = new LegalProfileResolutionCache();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);

    const result = await service.prefetch({
      session: baseSession(),
      permissions: staffOwnerPermissions('user-staff-owner'),
      apiClient,
      cache,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('malformed_response');
    }
    expect(cache.has(
      Object.freeze({
        authUserId: 'user-staff-owner',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
    )).toBe(false);
  });

  it('maps RPC profile_missing without cache write', async () => {
    const cache = new LegalProfileResolutionCache();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: Object.freeze({ ok: false, code: 'profile_missing', reason: 'No profile.' }),
    });
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);

    const result = await service.prefetch({
      session: baseSession(),
      permissions: staffOwnerPermissions('user-staff-owner'),
      apiClient,
      cache,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('profile_missing');
    }
  });

  it('maps inactive profile without cache write', async () => {
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
        profile_status: 'inactive',
        revision: '2026-07-22T12:00:00Z',
      }),
    });
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);

    const result = await service.prefetch({
      session: baseSession(),
      permissions: staffOwnerPermissions('user-staff-owner'),
      apiClient,
      cache,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('profile_inactive');
    }
  });

  it('denies portal mismatch and clears cache', async () => {
    const cache = new LegalProfileResolutionCache();
    cache.set(
      Object.freeze({
        authUserId: 'user-staff-owner',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
      Object.freeze({
        legalRecipientId: 'STAFF-OWNER-001',
        revision: 'old',
        sessionSnapshotVersion: 1,
      }),
    );
    const transport = createMemoryTransport();
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);

    const result = await service.prefetch({
      session: baseSession({ portal: 'client' }),
      permissions: staffOwnerPermissions('user-staff-owner'),
      apiClient,
      cache,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('portal_mismatch');
    }
    expect(cache.has(
      Object.freeze({
        authUserId: 'user-staff-owner',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
    )).toBe(false);
  });

  it('maps timeout and retries once for transient errors', async () => {
    const cache = new LegalProfileResolutionCache();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error', message: 'timeout' });
    transport.enqueue({ kind: 'response', status: 200, body: validStaffOwnerRpcBody() });
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);

    const result = await service.prefetch({
      session: baseSession(),
      permissions: staffOwnerPermissions('user-staff-owner'),
      apiClient,
      cache,
    });

    expect(result.ok).toBe(true);
    expect(transport.calls.filter((call) => call.url.includes(LEGAL_RESOLVE_PROFILE_ACCESS_RPC)).length).toBe(2);
  });

  it('does not retry forbidden RPC failures', async () => {
    const cache = new LegalProfileResolutionCache();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: Object.freeze({ ok: false, code: 'portal_mismatch', reason: 'Mismatch.' }),
    });
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: validStaffOwnerRpcBody(),
    });
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);

    const result = await service.prefetch({
      session: baseSession(),
      permissions: staffOwnerPermissions('user-staff-owner'),
      apiClient,
      cache,
    });

    expect(result.ok).toBe(false);
    expect(transport.calls.length).toBe(1);
  });

  it('clears cache on unauthenticated session', async () => {
    const cache = new LegalProfileResolutionCache();
    cache.set(
      Object.freeze({
        authUserId: 'user-staff-owner',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
      Object.freeze({
        legalRecipientId: 'STAFF-OWNER-001',
        revision: 'old',
        sessionSnapshotVersion: 1,
      }),
    );
    const transport = createMemoryTransport();
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);

    const result = await service.prefetch({
      session: baseSession({ user: null }),
      permissions: staffOwnerPermissions('user-staff-owner'),
      apiClient,
      cache,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('unauthenticated');
    }
    expect(cache.has(
      Object.freeze({
        authUserId: 'user-staff-owner',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
    )).toBe(false);
  });

  it('preserves cache during refresh when snapshot version matches', async () => {
    const cache = new LegalProfileResolutionCache();
    cache.set(
      Object.freeze({
        authUserId: 'user-staff-owner',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
      Object.freeze({
        legalRecipientId: 'STAFF-OWNER-001',
        revision: 'rev-stable',
        sessionSnapshotVersion: 2,
      }),
    );
    const transport = createMemoryTransport();
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });
    const service = createLegalProfileAccessPrefetchService(cache);

    const result = await service.prefetch({
      session: baseSession({ isRefreshing: true, snapshotVersion: 2 }),
      permissions: staffOwnerPermissions('user-staff-owner'),
      apiClient,
      cache,
    });

    expect(result.ok).toBe(true);
    expect(transport.calls.length).toBe(0);
  });
});
