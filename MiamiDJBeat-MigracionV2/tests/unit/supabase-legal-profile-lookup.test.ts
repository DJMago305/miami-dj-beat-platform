/** LC-13B — Supabase legal profile lookup adapter unit tests */

import { describe, expect, it } from 'vitest';
import {
  LegalProfileResolutionCache,
  createSupabaseLegalProfileLookup,
} from '../../shared/services/legal/persistence/identity';

describe('SupabaseLegalProfileLookupAdapter — LC-13B', () => {
  it('reads lookup results from cache without network', () => {
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
        revision: 'rev-1',
        sessionSnapshotVersion: 1,
      }),
    );

    const lookup = createSupabaseLegalProfileLookup({ resolutionCache: cache });
    const result = lookup.lookup(
      Object.freeze({
        authUserId: 'user-staff-owner',
        profileKind: 'staff',
        documentedRole: 'staff_owner',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.legalRecipientId).toBe('STAFF-OWNER-001');
    }
  });

  it('returns profile_missing on cache miss', () => {
    const cache = new LegalProfileResolutionCache();
    const lookup = createSupabaseLegalProfileLookup({ resolutionCache: cache });

    const result = lookup.lookup(
      Object.freeze({
        authUserId: 'missing-user',
        profileKind: 'staff',
        documentedRole: 'staff_seller',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('profile_missing');
    }
  });

  it('maps cached artist recipient scope via legalRecipientId', () => {
    const cache = new LegalProfileResolutionCache();
    cache.set(
      Object.freeze({
        authUserId: 'mock-user-artist-1',
        profileKind: 'artist',
        sourcePortal: 'artist',
        documentedRole: 'artist_pro',
      }),
      Object.freeze({
        legalRecipientId: 'ART-DEMO-001',
        legalProfileId: 'profile-art-1',
        revision: 'rev-art',
        sessionSnapshotVersion: 1,
      }),
    );

    const lookup = createSupabaseLegalProfileLookup({ resolutionCache: cache });
    const result = lookup.lookup(
      Object.freeze({
        authUserId: 'mock-user-artist-1',
        profileKind: 'artist',
        documentedRole: 'artist_pro',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(
        Object.freeze({
          legalRecipientId: 'ART-DEMO-001',
          legalProfileId: 'profile-art-1',
        }),
      );
    }
  });
});
