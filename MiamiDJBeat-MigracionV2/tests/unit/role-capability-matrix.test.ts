import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_COUNT,
  CAPABILITY_REGISTRY,
  ROLE_CAPABILITY_COUNTS,
  ROLE_CAPABILITY_MATRIX,
  getRoleCapabilities,
  getRoleCapabilityCount,
  listRoleCapabilityMatrixRoles,
} from '../../shared/permissions/runtime';

describe('MOD-003 Role Capability Matrix', () => {
  it('covers all 9 documented roles', () => {
    expect(listRoleCapabilityMatrixRoles()).toHaveLength(9);
    expect(listRoleCapabilityMatrixRoles()).toEqual([
      'guest',
      'buyer',
      'artist_lite',
      'artist_pro',
      'artist_elite',
      'staff_seller',
      'staff_manager',
      'staff_admin',
      'staff_owner',
    ]);
  });

  it('encodes literal counts from ROLE-MATRIX.md tables', () => {
    expect(ROLE_CAPABILITY_COUNTS).toEqual({
      guest: 3,
      buyer: 9,
      artist_lite: 12,
      artist_pro: 14,
      artist_elite: 14,
      staff_seller: 11,
      staff_manager: 29,
      staff_admin: 30,
      staff_owner: 31,
    });

    for (const role of listRoleCapabilityMatrixRoles()) {
      expect(getRoleCapabilityCount(role)).toBe(ROLE_CAPABILITY_COUNTS[role]);
    }
  });

  it('registers only catalog capabilities', () => {
    for (const capabilities of ROLE_CAPABILITY_MATRIX.values()) {
      for (const capabilityId of capabilities) {
        expect(CAPABILITY_REGISTRY.has(capabilityId)).toBe(true);
      }
    }
  });

  it('excludes flag-gated client.vip.benefits from buyer base matrix', () => {
    expect(getRoleCapabilities('buyer')).not.toContain('client.vip.benefits');
  });

  it('includes artist.sft.use for pro and elite roles in base matrix', () => {
    expect(getRoleCapabilities('artist_pro')).toContain('artist.sft.use');
    expect(getRoleCapabilities('artist_elite')).toContain('artist.sft.use');
    expect(getRoleCapabilities('artist_lite')).not.toContain('artist.sft.use');
  });

  it('keeps seller without management writes and owner with owner-only caps', () => {
    expect(getRoleCapabilities('staff_seller')).not.toContain('staff.manage');
    expect(getRoleCapabilities('staff_admin')).toContain('system.admin');
    expect(getRoleCapabilities('staff_admin')).not.toContain('system.featureflags.override');
    expect(getRoleCapabilities('staff_owner')).toContain('system.featureflags.override');
  });

  it('keeps matrix map immutable', () => {
    expect(Object.isFrozen(ROLE_CAPABILITY_MATRIX)).toBe(true);

    const guestCaps = getRoleCapabilities('guest');
    expect(Object.isFrozen(guestCaps)).toBe(true);
    expect(guestCaps).toHaveLength(3);

    expect(CAPABILITY_COUNT).toBe(51);
  });
});
