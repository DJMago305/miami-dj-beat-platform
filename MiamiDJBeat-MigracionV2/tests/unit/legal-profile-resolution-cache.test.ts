/** LC-13B — Legal profile resolution cache unit tests */

import { describe, expect, it } from 'vitest';
import {
  LegalProfileResolutionCache,
  buildLegalProfileResolutionCacheKey,
} from '../../shared/services/legal/persistence/identity/legal-profile-resolution-cache';

describe('LegalProfileResolutionCache — LC-13B', () => {
  it('sets and gets entries by composite key', () => {
    const cache = new LegalProfileResolutionCache();
    const key = Object.freeze({
      authUserId: 'user-1',
      profileKind: 'staff' as const,
      sourcePortal: 'staff' as const,
      documentedRole: 'staff_owner' as const,
    });

    cache.set(key, Object.freeze({
      legalRecipientId: 'STAFF-OWNER-001',
      revision: 'rev-1',
      sessionSnapshotVersion: 1,
    }));

    expect(cache.has(key)).toBe(true);
    expect(cache.get(key)).toEqual(
      Object.freeze({
        legalRecipientId: 'STAFF-OWNER-001',
        revision: 'rev-1',
        sessionSnapshotVersion: 1,
      }),
    );
  });

  it('returns null on cache miss', () => {
    const cache = new LegalProfileResolutionCache();
    expect(
      cache.get(
        Object.freeze({
          authUserId: 'missing',
          profileKind: 'artist',
          sourcePortal: 'artist',
          documentedRole: 'artist_pro',
        }),
      ),
    ).toBeNull();
  });

  it('clears all entries', () => {
    const cache = new LegalProfileResolutionCache();
    cache.set(
      Object.freeze({
        authUserId: 'user-1',
        profileKind: 'client',
        sourcePortal: 'client',
        documentedRole: 'buyer',
      }),
      Object.freeze({
        legalRecipientId: 'CLI-001',
        revision: 'rev-1',
        sessionSnapshotVersion: 1,
      }),
    );
    cache.clear();
    expect(cache.has(
      Object.freeze({
        authUserId: 'user-1',
        profileKind: 'client',
        sourcePortal: 'client',
        documentedRole: 'buyer',
      }),
    )).toBe(false);
  });

  it('isolates entries by auth user', () => {
    const cache = new LegalProfileResolutionCache();
    const sharedRoleKey = Object.freeze({
      profileKind: 'staff' as const,
      sourcePortal: 'staff' as const,
      documentedRole: 'staff_owner' as const,
    });

    cache.set(
      Object.freeze({ authUserId: 'user-a', ...sharedRoleKey }),
      Object.freeze({ legalRecipientId: 'STAFF-A', revision: 'r1', sessionSnapshotVersion: 1 }),
    );
    cache.set(
      Object.freeze({ authUserId: 'user-b', ...sharedRoleKey }),
      Object.freeze({ legalRecipientId: 'STAFF-B', revision: 'r2', sessionSnapshotVersion: 1 }),
    );

    expect(cache.get(Object.freeze({ authUserId: 'user-a', ...sharedRoleKey }))?.legalRecipientId).toBe('STAFF-A');
    expect(cache.get(Object.freeze({ authUserId: 'user-b', ...sharedRoleKey }))?.legalRecipientId).toBe('STAFF-B');
  });

  it('isolates entries by portal', () => {
    const cache = new LegalProfileResolutionCache();
    cache.set(
      Object.freeze({
        authUserId: 'user-1',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_seller',
      }),
      Object.freeze({ legalRecipientId: 'STAFF-SELLER-001', revision: 'r1', sessionSnapshotVersion: 1 }),
    );

    expect(
      cache.get(
        Object.freeze({
          authUserId: 'user-1',
          profileKind: 'staff',
          sourcePortal: 'client',
          documentedRole: 'staff_seller',
        }),
      ),
    ).toBeNull();
  });

  it('invalidates all entries for an auth user', () => {
    const cache = new LegalProfileResolutionCache();
    cache.set(
      Object.freeze({
        authUserId: 'user-1',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
      Object.freeze({ legalRecipientId: 'STAFF-OWNER-001', revision: 'r1', sessionSnapshotVersion: 1 }),
    );
    cache.set(
      Object.freeze({
        authUserId: 'user-1',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_seller',
      }),
      Object.freeze({ legalRecipientId: 'STAFF-SELLER-001', revision: 'r2', sessionSnapshotVersion: 1 }),
    );

    cache.invalidateForAuthUser('user-1');

    expect(cache.has(
      Object.freeze({
        authUserId: 'user-1',
        profileKind: 'staff',
        sourcePortal: 'staff',
        documentedRole: 'staff_owner',
      }),
    )).toBe(false);
  });

  it('builds stable cache key strings', () => {
    const key = buildLegalProfileResolutionCacheKey(
      Object.freeze({
        authUserId: 'user-1',
        profileKind: 'artist',
        sourcePortal: 'artist',
        documentedRole: 'artist_pro',
      }),
    );
    expect(key).toBe('user-1|artist|artist|artist_pro');
  });
});
