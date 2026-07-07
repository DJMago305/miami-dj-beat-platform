import { describe, expect, it } from 'vitest';
import {
  PermissionError,
  assertCapability,
  hasCapability,
  isPermissionError,
  listEffectiveCapabilities,
  resolvePermissionSnapshot,
} from '../../shared/permissions/runtime';

function snapshotFor(profile: Parameters<typeof resolvePermissionSnapshot>[0]['profile'], options?: {
  portal?: 'client' | 'artist' | 'staff' | 'guest';
  flags?: { clientVip?: boolean; sftOk?: boolean };
}) {
  return resolvePermissionSnapshot({
    profile,
    portal: options?.portal ?? 'client',
    flags: options?.flags,
  });
}

describe('MOD-003 Permission Resolver', () => {
  describe('Client profiles', () => {
    it('resolves client.regular as buyer without VIP benefits', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.regular' });
      expect(snapshot.documentedRole).toBe('buyer');
      expect(hasCapability(snapshot, 'client.shop.checkout')).toBe(true);
      expect(hasCapability(snapshot, 'client.vip.benefits')).toBe(false);
    });

    it('denies client.vip benefits without clientVip flag', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.vip' });
      expect(snapshot.documentedRole).toBe('buyer');
      expect(hasCapability(snapshot, 'client.vip.benefits')).toBe(false);
    });

    it('grants client.vip benefits only with clientVip flag on client.vip profile', () => {
      const snapshot = snapshotFor(
        { kind: 'client', profileId: 'client.vip' },
        { flags: { clientVip: true } },
      );
      expect(hasCapability(snapshot, 'client.vip.benefits')).toBe(true);
      expect(snapshot.capabilityCount).toBe(10);
    });

    it('resolves client.commercial as buyer base capabilities', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.commercial' });
      expect(snapshot.documentedRole).toBe('buyer');
      expect(hasCapability(snapshot, 'orders.read.own')).toBe(true);
      expect(hasCapability(snapshot, 'client.vip.benefits')).toBe(false);
    });
  });

  describe('Staff profiles', () => {
    it('resolves staff.owner with owner capabilities', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.owner' },
        { portal: 'staff' },
      );
      expect(snapshot.documentedRole).toBe('staff_owner');
      expect(hasCapability(snapshot, 'system.featureflags.override', 'staff')).toBe(true);
      expect(hasCapability(snapshot, 'staff.manage', 'staff')).toBe(true);
    });

    it('resolves staff.manager with management writes', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.manager' },
        { portal: 'staff' },
      );
      expect(snapshot.documentedRole).toBe('staff_manager');
      expect(hasCapability(snapshot, 'staff.invoices.write', 'staff')).toBe(true);
      expect(hasCapability(snapshot, 'system.admin', 'staff')).toBe(false);
    });

    it('resolves staff.seller without staff.manage', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.seller' },
        { portal: 'staff' },
      );
      expect(snapshot.documentedRole).toBe('staff_seller');
      expect(hasCapability(snapshot, 'staff.dashboard.access', 'staff')).toBe(true);
      expect(hasCapability(snapshot, 'staff.manage', 'staff')).toBe(false);
    });
  });

  describe('Artist profiles', () => {
    it('resolves DJ Lite without SFT or analytics', () => {
      const snapshot = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' },
        { portal: 'artist', flags: { sftOk: true } },
      );
      expect(snapshot.documentedRole).toBe('artist_lite');
      expect(snapshot.profile.artistCategory).toBe('DJ');
      expect(hasCapability(snapshot, 'artist.tools.use', 'artist')).toBe(true);
      expect(hasCapability(snapshot, 'artist.sft.use', 'artist')).toBe(false);
      expect(hasCapability(snapshot, 'artist.analytics.read.own', 'artist')).toBe(false);
    });

    it('resolves DJ Pro and Singer Pro to the same artist_pro role', () => {
      const djPro = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Pro' },
        { portal: 'artist', flags: { sftOk: true } },
      );
      const singerPro = snapshotFor(
        { kind: 'artist', profileId: 'artist.singer_solo', tier: 'Pro' },
        { portal: 'artist', flags: { sftOk: true } },
      );

      expect(djPro.documentedRole).toBe('artist_pro');
      expect(singerPro.documentedRole).toBe('artist_pro');
      expect([...listEffectiveCapabilities(djPro)].sort()).toEqual(
        [...listEffectiveCapabilities(singerPro)].sort(),
      );
      expect(djPro.profile.artistCategory).toBe('DJ');
      expect(singerPro.profile.artistCategory).toBe('Singer');
    });

    it('removes artist.sft.use when sftOk is not true', () => {
      const snapshot = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Pro' },
        { portal: 'artist' },
      );
      expect(snapshot.documentedRole).toBe('artist_pro');
      expect(hasCapability(snapshot, 'artist.sft.use', 'artist')).toBe(false);
      expect(hasCapability(snapshot, 'artist.analytics.read.own', 'artist')).toBe(true);
    });

    it('resolves Band Elite to artist_elite', () => {
      const snapshot = snapshotFor(
        { kind: 'artist', profileId: 'artist.band_group', tier: 'Elite' },
        { portal: 'artist', flags: { sftOk: true } },
      );
      expect(snapshot.documentedRole).toBe('artist_elite');
      expect(snapshot.profile.artistCategory).toBe('Band');
      expect(snapshot.profile.artistTier).toBe('Elite');
      expect(snapshot.profile.artistCategory).not.toBe(snapshot.profile.artistTier);
    });
  });

  describe('Deny-default guards', () => {
    it('denies unregistered capabilities and missing snapshot grants', () => {
      const snapshot = snapshotFor({ kind: 'guest' });
      expect(hasCapability(snapshot, 'not.registered.cap')).toBe(false);
      expect(hasCapability(snapshot, 'staff.manage')).toBe(false);
      expect(hasCapability(null, 'guest.browse.public')).toBe(false);
    });

    it('denies portal-prohibited capabilities', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.manager' },
        { portal: 'staff' },
      );
      expect(hasCapability(snapshot, 'staff.manage', 'staff')).toBe(true);
      expect(hasCapability(snapshot, 'staff.manage', 'client')).toBe(false);
    });

    it('denies guest staff capabilities and client artist write capabilities', () => {
      const guest = snapshotFor({ kind: 'guest' });
      expect(hasCapability(guest, 'staff.dashboard.access', 'staff')).toBe(false);

      const buyer = snapshotFor({ kind: 'client', profileId: 'client.regular' });
      expect(hasCapability(buyer, 'artist.profile.edit.own', 'client')).toBe(false);
    });

    it('assertCapability throws for missing snapshot and denied capability', () => {
      expect(() => assertCapability(null, 'guest.browse.public')).toThrow(PermissionError);

      const snapshot = snapshotFor({ kind: 'guest' });
      expect(() => assertCapability(snapshot, 'staff.manage')).toThrow(PermissionError);

      try {
        assertCapability(null, 'guest.browse.public');
      } catch (error) {
        expect(isPermissionError(error)).toBe(true);
        if (isPermissionError(error)) {
          expect(error.code).toBe('PERM_SNAPSHOT_REQUIRED');
        }
      }
    });
  });

  it('returns frozen snapshots with sorted effective capabilities', () => {
    const snapshot = snapshotFor({ kind: 'client', profileId: 'client.regular' });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.capabilities)).toBe(true);
    expect(Object.isFrozen(snapshot.flags)).toBe(true);
    expect([...snapshot.capabilities]).toEqual([...snapshot.capabilities].sort());
  });
});
