/**
 * Profiles identity classification — Paso 4.
 * Bridges AccessSnapshotDTO (+ optional profile enrichment) → profile-matrix.
 * READ-ONLY. Closes V1→V2 gaps: VIP, commercial, artist tier, staff seller/full.
 */

import {
  resolveDocumentedRole,
  resolveProfile,
} from '../../permissions/runtime/profile-matrix';
import type {
  DocumentedRoleId,
  ProfileResolveInput,
  ResolvedProfile,
  SnapshotFlags,
} from '../../permissions/runtime/types';
import { mapArtistTierFromSnapshot } from './profile-taxonomy-resolve';
import { resolveArtistTaxonomy, resolveClientProfileId, resolveStaffProfileId } from './profile-taxonomy-resolve';
import type {
  AccessSnapshotDTO,
  AccessSnapshotProfileKind,
  ArtistProfileReadDTO,
  ClientProfileReadDTO,
} from './profiles.types';

export type ProfilesIdentityPrincipal = 'buyer' | 'performer' | 'staff' | null;

/**
 * Extended flags for identity hydrate (superset of MOD-003 SnapshotFlags).
 * Permission resolver still consumes only clientVip + sftOk via toPermissionSnapshotFlags().
 */
export type ProfilesIdentityFlags = {
  readonly clientVip: boolean;
  readonly clientCommercial: boolean;
  readonly sftOk: boolean;
  readonly staffSeller: boolean;
  readonly staffManagement: boolean;
  readonly artistTier: ReturnType<typeof mapArtistTierFromSnapshot> | null;
  readonly mdjbId: string | null;
  readonly principal: ProfilesIdentityPrincipal;
  readonly profileKind: AccessSnapshotProfileKind | null;
};

export type ProfilesIdentityClassificationSuccess = {
  readonly ok: true;
  readonly profile: ProfileResolveInput;
  readonly resolved: ResolvedProfile;
  readonly documentedRole: DocumentedRoleId;
  readonly flags: ProfilesIdentityFlags;
  /** Subset safe for resolvePermissionSnapshot / SnapshotFlags. */
  readonly permissionFlags: SnapshotFlags;
};

export type ProfilesIdentityClassificationFailure = {
  readonly ok: false;
  readonly code:
    | 'IDENTITY_SNAPSHOT_REJECTED'
    | 'IDENTITY_UNKNOWN_PROFILE'
    | 'IDENTITY_UNRESOLVED_STAFF'
    | 'IDENTITY_INVALID_SNAPSHOT';
  readonly reason: string;
};

export type ProfilesIdentityClassification =
  | ProfilesIdentityClassificationSuccess
  | ProfilesIdentityClassificationFailure;

export type ClassifyPlatformIdentityInput = {
  readonly snapshot: AccessSnapshotDTO;
  readonly clientProfile?: Pick<
    ClientProfileReadDTO,
    'isCommercial' | 'buyerBillingTier' | 'clientProfileId'
  > | null;
  readonly artistProfile?: Pick<
    ArtistProfileReadDTO,
    'artistSpecialty' | 'artistProfileId' | 'artistCategory' | 'sftOk' | 'soundfortipsActive' | 'commercialTier'
  > | null;
};

function failure(
  code: ProfilesIdentityClassificationFailure['code'],
  reason: string,
): ProfilesIdentityClassificationFailure {
  return Object.freeze({ ok: false, code, reason });
}

function permissionFlagsFrom(flags: ProfilesIdentityFlags): SnapshotFlags {
  return Object.freeze({
    clientVip: flags.clientVip === true,
    sftOk: flags.sftOk === true,
  });
}

function success(
  profile: ProfileResolveInput,
  flags: ProfilesIdentityFlags,
): ProfilesIdentityClassificationSuccess {
  const resolved = resolveProfile(profile);
  const documentedRole = resolveDocumentedRole(profile);
  return Object.freeze({
    ok: true,
    profile: Object.freeze(profile) as ProfileResolveInput,
    resolved,
    documentedRole,
    flags: Object.freeze(flags),
    permissionFlags: permissionFlagsFrom(flags),
  });
}

/**
 * Classify V1 access snapshot (+ optional own-profile enrichment) into V2 profile-matrix identity.
 */
export function classifyPlatformIdentity(
  input: ClassifyPlatformIdentityInput,
): ProfilesIdentityClassification {
  const { snapshot, clientProfile, artistProfile } = input;

  if (!snapshot || typeof snapshot !== 'object') {
    return failure('IDENTITY_INVALID_SNAPSHOT', 'Access snapshot is required.');
  }

  if (!snapshot.ok) {
    return failure('IDENTITY_SNAPSHOT_REJECTED', snapshot.reason || 'snapshot_rejected');
  }

  const mdjbId = snapshot.mdjbId;
  const profileKind = snapshot.profileKind;

  switch (profileKind) {
    case 'buyer': {
      const clientProfileId = resolveClientProfileId({
        buyerVip: snapshot.buyerVip,
        buyerBillingTier: clientProfile?.buyerBillingTier,
        isCommercial: clientProfile?.isCommercial === true,
      });
      const clientVip = clientProfileId === 'client.vip';
      const clientCommercial = clientProfileId === 'client.commercial';
      return success(
        { kind: 'client', profileId: clientProfileId },
        {
          clientVip,
          clientCommercial,
          sftOk: false,
          staffSeller: false,
          staffManagement: false,
          artistTier: null,
          mdjbId,
          principal: 'buyer',
          profileKind,
        },
      );
    }
    case 'artist': {
      const tier =
        artistProfile?.commercialTier ?? mapArtistTierFromSnapshot(snapshot.artistTier);
      const taxonomy = resolveArtistTaxonomy({
        artistTier: tier === 'Elite' ? 2 : tier === 'Pro' ? 1 : 0,
        artistSpecialty: artistProfile?.artistSpecialty,
        artistCategoryHint: artistProfile?.artistCategory,
        artistProfileIdHint: artistProfile?.artistProfileId,
      });
      const sftOk =
        artistProfile?.sftOk === true ||
        artistProfile?.soundfortipsActive === true ||
        taxonomy.commercialTier === 'Pro' ||
        taxonomy.commercialTier === 'Elite';
      return success(
        {
          kind: 'artist',
          profileId: taxonomy.artistProfileId,
          tier: taxonomy.commercialTier,
        },
        {
          clientVip: false,
          clientCommercial: false,
          sftOk,
          staffSeller: false,
          staffManagement: false,
          artistTier: taxonomy.commercialTier,
          mdjbId,
          principal: 'performer',
          profileKind,
        },
      );
    }
    case 'staff_seller': {
      const staffProfileId = resolveStaffProfileId({
        role: snapshot.role ?? 'seller',
        profileKind: 'staff_seller',
      });
      return success(
        { kind: 'staff', profileId: staffProfileId },
        {
          clientVip: false,
          clientCommercial: false,
          sftOk: false,
          staffSeller: true,
          staffManagement: false,
          artistTier: null,
          mdjbId,
          principal: 'staff',
          profileKind,
        },
      );
    }
    case 'staff_full': {
      const role = String(snapshot.role || '').trim().toLowerCase();
      if (!role) {
        return failure('IDENTITY_UNRESOLVED_STAFF', 'Missing staff role for staff_full profile.');
      }
      if (role !== 'owner' && role !== 'manager' && role !== 'admin') {
        return failure('IDENTITY_UNRESOLVED_STAFF', `Unsupported staff role: ${role}`);
      }
      const staffProfileId = resolveStaffProfileId({
        role,
        profileKind: 'staff_full',
      });
      return success(
        { kind: 'staff', profileId: staffProfileId },
        {
          clientVip: false,
          clientCommercial: false,
          sftOk: false,
          staffSeller: false,
          staffManagement: true,
          artistTier: null,
          mdjbId,
          principal: 'staff',
          profileKind,
        },
      );
    }
    case 'unknown':
      return failure(
        'IDENTITY_UNKNOWN_PROFILE',
        snapshot.authUid
          ? `Unknown profile for auth uid ${snapshot.authUid}`
          : 'Unknown authenticated profile.',
      );
    default:
      return failure('IDENTITY_INVALID_SNAPSHOT', `Unsupported profile_kind: ${String(profileKind)}`);
  }
}

/** Convenience: SnapshotFlags for MOD-003 permission resolver. */
export function toPermissionSnapshotFlags(flags: ProfilesIdentityFlags): SnapshotFlags {
  return permissionFlagsFrom(flags);
}
