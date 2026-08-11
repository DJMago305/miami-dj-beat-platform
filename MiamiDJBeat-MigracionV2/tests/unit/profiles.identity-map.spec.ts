/**
 * profiles.identity-map.spec.ts — Paso 4 identity classification (read-only).
 */
import { describe, expect, it } from 'vitest';
import { resolvePermissionSnapshot } from '../../shared/permissions/runtime';
import {
  MOCK_ACCESS_SNAPSHOT_ARTIST_PRO,
  MOCK_ACCESS_SNAPSHOT_BUYER,
  MOCK_ACCESS_SNAPSHOT_FAILURE,
  MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
  MOCK_ACCESS_SNAPSHOT_VIP,
  MOCK_ARTIST_PROFILE_DJ_PRO,
  MOCK_CLIENT_PROFILE_REGULAR,
  classifyPlatformIdentity,
  toPermissionSnapshotFlags,
} from '../../shared/services/profiles';

describe('classifyPlatformIdentity — client', () => {
  it('maps buyer → client.regular with principal buyer', () => {
    const result = classifyPlatformIdentity({
      snapshot: MOCK_ACCESS_SNAPSHOT_BUYER,
      clientProfile: MOCK_CLIENT_PROFILE_REGULAR,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual({ kind: 'client', profileId: 'client.regular' });
    expect(result.resolved.kind).toBe('client');
    expect(result.documentedRole).toBe('buyer');
    expect(result.flags.principal).toBe('buyer');
    expect(result.flags.clientVip).toBe(false);
    expect(result.flags.clientCommercial).toBe(false);
    expect(result.flags.staffSeller).toBe(false);
    expect(result.flags.staffManagement).toBe(false);
  });

  it('maps VIP snapshot → client.vip + permissionFlags.clientVip', () => {
    const result = classifyPlatformIdentity({ snapshot: MOCK_ACCESS_SNAPSHOT_VIP });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual({ kind: 'client', profileId: 'client.vip' });
    expect(result.flags.clientVip).toBe(true);
    expect(result.permissionFlags).toEqual({ clientVip: true, sftOk: false });
  });

  it('commercial enrichment wins over VIP (gap G1 closed via row)', () => {
    const result = classifyPlatformIdentity({
      snapshot: MOCK_ACCESS_SNAPSHOT_VIP,
      clientProfile: {
        isCommercial: true,
        buyerBillingTier: 'vip',
        clientProfileId: 'client.commercial',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual({ kind: 'client', profileId: 'client.commercial' });
    expect(result.flags.clientCommercial).toBe(true);
    expect(result.flags.clientVip).toBe(false);
    expect(result.resolved.clientProfileType).toBe('commercial');
  });
});

describe('classifyPlatformIdentity — artist', () => {
  it('maps artist_tier + specialty → Pro DJ performer', () => {
    const result = classifyPlatformIdentity({
      snapshot: MOCK_ACCESS_SNAPSHOT_ARTIST_PRO,
      artistProfile: MOCK_ARTIST_PROFILE_DJ_PRO,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.kind).toBe('artist');
    if (result.profile.kind === 'artist') {
      expect(result.profile.tier).toBe('Pro');
      expect(result.profile.profileId).toBe('artist.dj');
    }
    expect(result.documentedRole).toBe('artist_pro');
    expect(result.flags.principal).toBe('performer');
    expect(result.flags.artistTier).toBe('Pro');
    expect(result.flags.sftOk).toBe(true);
    expect(result.permissionFlags.sftOk).toBe(true);
  });
});

describe('classifyPlatformIdentity — staff', () => {
  it('maps staff_full + owner → staff.owner management', () => {
    const result = classifyPlatformIdentity({
      snapshot: MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual({ kind: 'staff', profileId: 'staff.owner' });
    expect(result.documentedRole).toBe('staff_owner');
    expect(result.flags.principal).toBe('staff');
    expect(result.flags.staffManagement).toBe(true);
    expect(result.flags.staffSeller).toBe(false);
  });

  it('maps staff_seller → seller limited', () => {
    const result = classifyPlatformIdentity({
      snapshot: {
        ok: true,
        profileKind: 'staff_seller',
        artistTier: null,
        buyerVip: false,
        role: 'seller',
        mdjbId: 'MDJB-TEST-S',
        authUid: 'uid-seller',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual({ kind: 'staff', profileId: 'staff.seller' });
    expect(result.flags.staffSeller).toBe(true);
    expect(result.flags.staffManagement).toBe(false);
  });

  it('rejects staff_full without role', () => {
    const result = classifyPlatformIdentity({
      snapshot: {
        ok: true,
        profileKind: 'staff_full',
        artistTier: null,
        buyerVip: false,
        role: null,
        mdjbId: null,
        authUid: 'uid',
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('IDENTITY_UNRESOLVED_STAFF');
    }
  });
});

describe('classifyPlatformIdentity — failures & permissions bridge', () => {
  it('rejects failed snapshot', () => {
    const result = classifyPlatformIdentity({ snapshot: MOCK_ACCESS_SNAPSHOT_FAILURE });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('IDENTITY_SNAPSHOT_REJECTED');
    }
  });

  it('feeds MOD-003 resolvePermissionSnapshot via permissionFlags', () => {
    const classified = classifyPlatformIdentity({ snapshot: MOCK_ACCESS_SNAPSHOT_VIP });
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;
    const perm = resolvePermissionSnapshot({
      profile: classified.profile,
      portal: 'client',
      flags: toPermissionSnapshotFlags(classified.flags),
      userId: 'uid-vip',
    });
    expect(perm.documentedRole).toBe('buyer');
    expect(perm.flags.clientVip).toBe(true);
    expect(perm.capabilities).toContain('client.vip.benefits');
  });
});
