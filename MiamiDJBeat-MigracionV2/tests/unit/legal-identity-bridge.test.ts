/** LC-13B — Legal identity bridge unit tests */

import { describe, expect, it } from 'vitest';
import { resolvePermissionSnapshot, type PermissionSnapshot } from '../../shared/permissions/runtime';
import {
  createMemoryLegalProfileLookup,
  resolveLegalReadAccessContextFromSession,
  mapDocumentedRoleToLegalReadRole,
} from '../../shared/services/legal/persistence/identity';
import type { SessionSnapshot } from '../../shared/session/runtime/types';

const lookup = createMemoryLegalProfileLookup();

function baseSession(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return Object.freeze({
    user: Object.freeze({ userId: 'mock-user-artist-1' }),
    portal: 'artist',
    roles: Object.freeze([]),
    capabilities: Object.freeze([]),
    locale: 'en',
    theme: 'dark',
    featureFlags: Object.freeze({}),
    sessionId: 'sess-bridge-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    hydrationPhase: 'signed_in',
    state: 'SESSION_READY',
    snapshotVersion: 1,
    updatedAt: new Date().toISOString(),
    isRefreshing: false,
    ...overrides,
  });
}

function permissionsFromProfile(
  profile:
    | { readonly kind: 'staff'; readonly profileId: 'staff.owner' | 'staff.manager' | 'staff.seller' }
    | { readonly kind: 'artist'; readonly profileId: 'artist.dj'; readonly tier: 'Lite' | 'Pro' | 'Elite' }
    | { readonly kind: 'client'; readonly profileId: 'client.regular' | 'client.vip' },
  portal: PermissionSnapshot['portal'],
  userId: string,
): PermissionSnapshot {
  return resolvePermissionSnapshot({
    profile,
    portal,
    userId,
  });
}

describe('LC-13B legal identity bridge', () => {
  it('maps documented roles to legal read roles', () => {
    expect(mapDocumentedRoleToLegalReadRole('staff_owner')).toEqual({
      actorType: 'staff',
      role: 'owner',
      portal: 'staff',
    });
    expect(mapDocumentedRoleToLegalReadRole('buyer')).toEqual({
      actorType: 'client',
      role: 'client',
      portal: 'client',
    });
    expect(mapDocumentedRoleToLegalReadRole('guest')).toBeNull();
  });

  it('resolves staff owner on staff portal', () => {
    const session = baseSession({
      user: Object.freeze({ userId: 'user-staff-owner' }),
      portal: 'staff',
    });
    const permissions = permissionsFromProfile({ kind: 'staff', profileId: 'staff.owner' }, 'staff', 'user-staff-owner');

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(
        Object.freeze({
          actorType: 'staff',
          actorId: 'STAFF-OWNER-001',
          role: 'owner',
          portal: 'staff',
        }),
      );
    }
  });

  it('resolves staff manager without deleted-submission owner powers in guards contract', () => {
    const session = baseSession({
      user: Object.freeze({ userId: 'user-staff-manager' }),
      portal: 'staff',
    });
    const permissions = permissionsFromProfile({ kind: 'staff', profileId: 'staff.manager' }, 'staff', 'user-staff-manager');

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.role).toBe('manager');
      expect(result.value.actorId).toBe('STAFF-MANAGER-001');
    }
  });

  it('resolves artist own scope with business recipient ID', () => {
    const session = baseSession({
      user: Object.freeze({ userId: 'mock-user-artist-1' }),
      portal: 'artist',
    });
    const permissions = permissionsFromProfile(
      { kind: 'artist', profileId: 'artist.dj', tier: 'Pro' },
      'artist',
      'mock-user-artist-1',
    );

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actorId).toBe('ART-DEMO-001');
      expect(result.value.recipientScope).toBe('ART-DEMO-001');
      expect(result.value.actorId).not.toBe('mock-user-artist-1');
    }
  });

  it('resolves client own scope with CLI business recipient ID', () => {
    const session = baseSession({
      user: Object.freeze({ userId: 'mock-user-client-1' }),
      portal: 'client',
    });
    const permissions = permissionsFromProfile({ kind: 'client', profileId: 'client.regular' }, 'client', 'mock-user-client-1');

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actorId).toBe('CLI-001');
      expect(result.value.portal).toBe('client');
    }
  });

  it('returns portal_mismatch when seller session opens client portal shell', () => {
    const session = baseSession({
      user: Object.freeze({ userId: 'user-staff-seller' }),
      portal: 'client',
    });
    const permissions = permissionsFromProfile({ kind: 'staff', profileId: 'staff.seller' }, 'staff', 'user-staff-seller');

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('portal_mismatch');
    }
  });

  it('returns portal_mismatch when staff owner opens artist portal shell', () => {
    const session = baseSession({
      user: Object.freeze({ userId: 'user-staff-owner' }),
      portal: 'artist',
    });
    const permissions = permissionsFromProfile({ kind: 'staff', profileId: 'staff.owner' }, 'staff', 'user-staff-owner');

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('portal_mismatch');
    }
  });

  it('returns identity_unavailable without session user', () => {
    const session = baseSession({ user: null });
    const permissions = permissionsFromProfile({ kind: 'staff', profileId: 'staff.owner' }, 'staff', 'missing');

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('identity_unavailable');
    }
  });

  it('returns session_expired for expired session state', () => {
    const session = baseSession({ state: 'SESSION_EXPIRED' });
    const permissions = permissionsFromProfile({ kind: 'staff', profileId: 'staff.owner' }, 'staff', 'user-staff-owner');

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('session_expired');
    }
  });

  it('returns role_unresolved for guest permissions', () => {
    const session = baseSession({ portal: 'client', user: Object.freeze({ userId: 'guest-user' }) });
    const permissions = resolvePermissionSnapshot({ profile: { kind: 'guest' }, portal: 'guest', userId: null });

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('role_unresolved');
    }
  });

  it('returns profile_missing when artist auth user has no legal binding', () => {
    const session = baseSession({
      user: Object.freeze({ userId: 'unknown-artist-user' }),
      portal: 'artist',
    });
    const permissions = permissionsFromProfile(
      { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' },
      'artist',
      'unknown-artist-user',
    );

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('profile_missing');
    }
  });

  it('returns identity_ambiguous when lookup has conflicting recipient IDs', () => {
    const ambiguousLookup = createMemoryLegalProfileLookup({
      bindings: Object.freeze([
        Object.freeze({
          authUserId: 'dup-user',
          profileKind: 'artist',
          legalRecipientId: 'ART-001',
        }),
        Object.freeze({
          authUserId: 'dup-user',
          profileKind: 'artist',
          legalRecipientId: 'ART-002',
        }),
      ]),
    });

    const session = baseSession({
      user: Object.freeze({ userId: 'dup-user' }),
      portal: 'artist',
    });
    const permissions = permissionsFromProfile(
      { kind: 'artist', profileId: 'artist.dj', tier: 'Pro' },
      'artist',
      'dup-user',
    );

    const result = resolveLegalReadAccessContextFromSession({
      session,
      permissions,
      legalProfileLookup: ambiguousLookup,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('identity_ambiguous');
    }
  });

  it('ignores previewRole semantics — staff seller permissions stay seller even on owner URL scenario', () => {
    const session = baseSession({
      user: Object.freeze({ userId: 'user-staff-seller' }),
      portal: 'staff',
    });
    const permissions = permissionsFromProfile({ kind: 'staff', profileId: 'staff.seller' }, 'staff', 'user-staff-seller');

    const result = resolveLegalReadAccessContextFromSession({ session, permissions, legalProfileLookup: lookup });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.role).toBe('seller');
      expect(result.value.actorId).toBe('STAFF-SELLER-001');
    }
  });
});
