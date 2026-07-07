import { describe, expect, it } from 'vitest';
import {
  DOCUMENTED_ROLE_COUNT,
  DOCUMENTED_ROLE_REGISTRY,
  PROFILE_COUNT,
  PROFILE_REGISTRY,
  PermissionError,
  isArtistProfile,
  isClientProfile,
  isDocumentedRoleId,
  isPermissionError,
  isStaffProfile,
  listSupportedProfiles,
  listSupportedRoles,
  resolveDocumentedRole,
  resolveProfile,
} from '../../shared/permissions/runtime';

describe('MOD-003 Profile Matrix', () => {
  it('registers 14 taxonomy profiles and 9 documented roles', () => {
    expect(PROFILE_COUNT).toBe(14);
    expect(PROFILE_REGISTRY.size).toBe(14);
    expect(DOCUMENTED_ROLE_COUNT).toBe(9);
    expect(DOCUMENTED_ROLE_REGISTRY.size).toBe(9);
    expect(listSupportedProfiles()).toHaveLength(14);
    expect(listSupportedRoles()).toHaveLength(9);
  });

  it('resolves Cliente Regular to buyer', () => {
    const input = { kind: 'client' as const, profileId: 'client.regular' as const };
    expect(resolveDocumentedRole(input)).toBe('buyer');
    expect(resolveProfile(input)).toEqual({
      profileId: 'client.regular',
      kind: 'client',
      documentedRole: 'buyer',
      clientProfileType: 'regular',
    });
    expect(isClientProfile('client.regular')).toBe(true);
  });

  it('resolves Cliente VIP to buyer with vip subtype', () => {
    const input = { kind: 'client' as const, profileId: 'client.vip' as const };
    expect(resolveDocumentedRole(input)).toBe('buyer');
    expect(resolveProfile(input)).toMatchObject({
      profileId: 'client.vip',
      documentedRole: 'buyer',
      clientProfileType: 'vip',
    });
  });

  it('resolves Cliente Comercial to buyer with commercial subtype', () => {
    const input = { kind: 'client' as const, profileId: 'client.commercial' as const };
    expect(resolveDocumentedRole(input)).toBe('buyer');
    expect(resolveProfile(input)).toMatchObject({
      profileId: 'client.commercial',
      documentedRole: 'buyer',
      clientProfileType: 'commercial',
    });
  });

  it('resolves Owner, Manager, and Seller staff profiles', () => {
    expect(resolveDocumentedRole({ kind: 'staff', profileId: 'staff.owner' })).toBe(
      'staff_owner',
    );
    expect(resolveDocumentedRole({ kind: 'staff', profileId: 'staff.manager' })).toBe(
      'staff_manager',
    );
    expect(resolveDocumentedRole({ kind: 'staff', profileId: 'staff.seller' })).toBe(
      'staff_seller',
    );

    expect(resolveProfile({ kind: 'staff', profileId: 'staff.owner' })).toMatchObject({
      profileId: 'staff.owner',
      kind: 'staff',
      documentedRole: 'staff_owner',
    });
    expect(isStaffProfile('staff.manager')).toBe(true);
  });

  it('resolves DJ Lite, DJ Pro, Band Elite, and Singer Pro by tier only', () => {
    const djLite = resolveProfile({
      kind: 'artist',
      profileId: 'artist.dj',
      tier: 'Lite',
    });
    expect(djLite.documentedRole).toBe('artist_lite');
    expect(djLite.artistCategory).toBe('DJ');
    expect(djLite.artistTier).toBe('Lite');

    const djPro = resolveProfile({
      kind: 'artist',
      profileId: 'artist.dj',
      tier: 'Pro',
    });
    expect(djPro.documentedRole).toBe('artist_pro');
    expect(djPro.artistCategory).toBe('DJ');
    expect(djPro.artistTier).toBe('Pro');

    const bandElite = resolveProfile({
      kind: 'artist',
      profileId: 'artist.band_group',
      tier: 'Elite',
    });
    expect(bandElite.documentedRole).toBe('artist_elite');
    expect(bandElite.artistCategory).toBe('Band');
    expect(bandElite.artistTier).toBe('Elite');

    const singerPro = resolveProfile({
      kind: 'artist',
      profileId: 'artist.singer_solo',
      tier: 'Pro',
    });
    expect(singerPro.documentedRole).toBe('artist_pro');
    expect(singerPro.artistCategory).toBe('Singer');
    expect(singerPro.artistTier).toBe('Pro');
  });

  it('keeps artistCategory orthogonal to artistTier', () => {
    const profile = resolveProfile({
      kind: 'artist',
      profileId: 'artist.band_group',
      tier: 'Elite',
    });

    expect(profile.artistCategory).toBe('Band');
    expect(profile.artistTier).toBe('Elite');
    expect(profile.artistCategory).not.toBe(profile.artistTier);
    expect(typeof profile.artistCategory).toBe('string');
    expect(typeof profile.artistTier).toBe('string');

    const sameCategoryLite = resolveProfile({
      kind: 'artist',
      profileId: 'artist.band_group',
      tier: 'Lite',
    });
    expect(sameCategoryLite.artistCategory).toBe('Band');
    expect(sameCategoryLite.documentedRole).toBe('artist_lite');
    expect(sameCategoryLite.artistTier).not.toBe(sameCategoryLite.artistCategory);
  });

  it('exposes staff_admin in role catalog without a recoverable staff profile id', () => {
    expect(isDocumentedRoleId('staff_admin')).toBe(true);
    expect(isStaffProfile('staff.admin')).toBe(false);
    expect(
      listSupportedRoles().some((role) => role.id === 'staff_admin' && role.matrixKey === 'A'),
    ).toBe(true);
  });

  it('keeps profile and role registries immutable', () => {
    expect(Object.isFrozen(PROFILE_REGISTRY)).toBe(true);
    expect(Object.isFrozen(DOCUMENTED_ROLE_REGISTRY)).toBe(true);

    const profile = listSupportedProfiles()[0];
    expect(Object.isFrozen(profile)).toBe(true);

    expect(() => {
      (profile as { label: string }).label = 'mutated';
    }).toThrow();

    expect(() => resolveDocumentedRole({ kind: 'client', profileId: 'client.unknown' as 'client.regular' })).toThrow(
      PermissionError,
    );

    try {
      resolveDocumentedRole({ kind: 'artist', profileId: 'artist.dj', tier: 'Ultra' as 'Lite' });
    } catch (error) {
      expect(isPermissionError(error)).toBe(true);
      if (isPermissionError(error)) {
        expect(error.code).toBe('PERM_INVALID_ARTIST_TIER');
      }
    }
  });

  it('classifies artist profiles separately from client and staff profiles', () => {
    expect(isArtistProfile('artist.dj')).toBe(true);
    expect(isArtistProfile('client.regular')).toBe(false);
    expect(isClientProfile('artist.dj')).toBe(false);
    expect(isStaffProfile('staff.seller')).toBe(true);
  });
});
