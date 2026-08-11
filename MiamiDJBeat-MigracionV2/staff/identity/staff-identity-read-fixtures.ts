/**
 * MOD-301 Slice 1 — lab fixtures (portal-local).
 * Does not mutate sealed shared profiles.mocks.
 */

import {
  MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
  MOCK_STAFF_IDENTITY_OWNER,
  mapStaffIdentityFromRole,
  type AccessSnapshotDTO,
  type StaffIdentityDTO,
} from '../../shared/services/profiles/index';

export type StaffIdentityLabBundle = {
  readonly identity: StaffIdentityDTO;
  readonly accessSnapshot: AccessSnapshotDTO;
  readonly displayName: string;
};

export const LAB_STAFF_IDENTITY_OWNER: StaffIdentityLabBundle = Object.freeze({
  identity: MOCK_STAFF_IDENTITY_OWNER,
  accessSnapshot: MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
  displayName: 'Gerardo · Owner',
});

export const LAB_STAFF_IDENTITY_MANAGER: StaffIdentityLabBundle = Object.freeze({
  identity: mapStaffIdentityFromRole(
    '00000000-0000-4000-8000-000000000006',
    'manager',
    'MDJB-TEST-0006-M',
    'staff_full',
  ),
  accessSnapshot: Object.freeze({
    ok: true as const,
    profileKind: 'staff_full' as const,
    artistTier: null,
    buyerVip: false,
    role: 'manager',
    mdjbId: 'MDJB-TEST-0006-M',
    authUid: '00000000-0000-4000-8000-000000000006',
  }),
  displayName: 'Ops Manager',
});

export const LAB_STAFF_IDENTITY_SELLER: StaffIdentityLabBundle = Object.freeze({
  identity: mapStaffIdentityFromRole(
    '00000000-0000-4000-8000-000000000007',
    'seller',
    'MDJB-TEST-0007-S',
    'staff_seller',
  ),
  accessSnapshot: Object.freeze({
    ok: true as const,
    profileKind: 'staff_seller' as const,
    artistTier: null,
    buyerVip: false,
    role: 'seller',
    mdjbId: 'MDJB-TEST-0007-S',
    authUid: '00000000-0000-4000-8000-000000000007',
  }),
  displayName: 'Floor Seller',
});

/** Default lab fallback for staff portal Slice 1. */
export const LAB_STAFF_IDENTITY_DEFAULT: StaffIdentityLabBundle = LAB_STAFF_IDENTITY_OWNER;
