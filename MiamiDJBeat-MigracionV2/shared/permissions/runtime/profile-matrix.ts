/** MOD-003 Permissions — profile matrix bridge — TICKET-MOD-003-PROFILE-MATRIX-001 */

import { PermissionError } from './errors';
import { assertDocumentedRole } from './role-matrix';
import type {
  ArtistCategory,
  ArtistProfileId,
  ArtistTier,
  ClientProfileId,
  ClientProfileType,
  DocumentedRoleId,
  ProfileDefinition,
  ProfileKind,
  ProfileResolveInput,
  ResolvedProfile,
  StaffProfileId,
  SupportedProfileId,
} from './types';

const CLIENT_PROFILE_IDS: readonly ClientProfileId[] = [
  'client.regular',
  'client.vip',
  'client.commercial',
];

const STAFF_PROFILE_IDS: readonly StaffProfileId[] = [
  'staff.owner',
  'staff.manager',
  'staff.seller',
];

const ARTIST_PROFILE_IDS: readonly ArtistProfileId[] = [
  'artist.dj',
  'artist.singer_solo',
  'artist.band_group',
  'artist.mc_host',
  'artist.musician',
  'artist.dancer_performer',
  'artist.clown_kids',
  'artist.custom',
];

const ARTIST_TIERS: readonly ArtistTier[] = ['Lite', 'Pro', 'Elite'];

const CLIENT_PROFILE_TYPE_BY_ID: Readonly<Record<ClientProfileId, ClientProfileType>> = {
  'client.regular': 'regular',
  'client.vip': 'vip',
  'client.commercial': 'commercial',
};

const STAFF_ROLE_BY_PROFILE: Readonly<Record<StaffProfileId, DocumentedRoleId>> = {
  'staff.owner': 'staff_owner',
  'staff.manager': 'staff_manager',
  'staff.seller': 'staff_seller',
};

const ARTIST_CATEGORY_BY_PROFILE: Readonly<Record<ArtistProfileId, ArtistCategory>> = {
  'artist.dj': 'DJ',
  'artist.singer_solo': 'Singer',
  'artist.band_group': 'Band',
  'artist.mc_host': 'MC',
  'artist.musician': 'Musician',
  'artist.dancer_performer': 'Dancer',
  'artist.clown_kids': 'Clown',
  'artist.custom': 'Other',
};

const ARTIST_ROLE_BY_TIER: Readonly<Record<ArtistTier, DocumentedRoleId>> = {
  Lite: 'artist_lite',
  Pro: 'artist_pro',
  Elite: 'artist_elite',
};

type ProfileSeed = {
  readonly id: SupportedProfileId;
  readonly kind: Exclude<ProfileKind, 'guest'>;
  readonly label: string;
  readonly documentedRole: DocumentedRoleId | null;
  readonly clientProfileType?: ClientProfileType;
  readonly artistCategory?: ArtistCategory;
};

const PROFILE_SEEDS: readonly ProfileSeed[] = [
  {
    id: 'client.regular',
    kind: 'client',
    label: 'Regular Client',
    documentedRole: 'buyer',
    clientProfileType: 'regular',
  },
  {
    id: 'client.vip',
    kind: 'client',
    label: 'VIP Client',
    documentedRole: 'buyer',
    clientProfileType: 'vip',
  },
  {
    id: 'client.commercial',
    kind: 'client',
    label: 'Commercial Client',
    documentedRole: 'buyer',
    clientProfileType: 'commercial',
  },
  {
    id: 'staff.owner',
    kind: 'staff',
    label: 'Owner',
    documentedRole: 'staff_owner',
  },
  {
    id: 'staff.manager',
    kind: 'staff',
    label: 'Manager',
    documentedRole: 'staff_manager',
  },
  {
    id: 'staff.seller',
    kind: 'staff',
    label: 'Seller',
    documentedRole: 'staff_seller',
  },
  {
    id: 'artist.dj',
    kind: 'artist',
    label: 'DJ',
    documentedRole: null,
    artistCategory: 'DJ',
  },
  {
    id: 'artist.singer_solo',
    kind: 'artist',
    label: 'Singer / Solo Artist',
    documentedRole: null,
    artistCategory: 'Singer',
  },
  {
    id: 'artist.band_group',
    kind: 'artist',
    label: 'Band / Orchestra / Group',
    documentedRole: null,
    artistCategory: 'Band',
  },
  {
    id: 'artist.mc_host',
    kind: 'artist',
    label: 'MC / Host',
    documentedRole: null,
    artistCategory: 'MC',
  },
  {
    id: 'artist.musician',
    kind: 'artist',
    label: 'Musician',
    documentedRole: null,
    artistCategory: 'Musician',
  },
  {
    id: 'artist.dancer_performer',
    kind: 'artist',
    label: 'Dancer / Performer',
    documentedRole: null,
    artistCategory: 'Dancer',
  },
  {
    id: 'artist.clown_kids',
    kind: 'artist',
    label: 'Clown / Kids Entertainment',
    documentedRole: null,
    artistCategory: 'Clown',
  },
  {
    id: 'artist.custom',
    kind: 'artist',
    label: 'Other Custom Artist Category',
    documentedRole: null,
    artistCategory: 'Other',
  },
];

function buildProfileDefinition(seed: ProfileSeed): ProfileDefinition {
  return Object.freeze({
    id: seed.id,
    kind: seed.kind,
    label: seed.label,
    documentedRole: seed.documentedRole,
    ...(seed.clientProfileType ? { clientProfileType: seed.clientProfileType } : {}),
    ...(seed.artistCategory ? { artistCategory: seed.artistCategory } : {}),
  });
}

function buildProfileRegistry(): ReadonlyMap<SupportedProfileId, ProfileDefinition> {
  const entries = PROFILE_SEEDS.map((seed) => [seed.id, buildProfileDefinition(seed)] as const);
  return Object.freeze(new Map<SupportedProfileId, ProfileDefinition>(entries));
}

export const PROFILE_REGISTRY: ReadonlyMap<SupportedProfileId, ProfileDefinition> =
  buildProfileRegistry();

export const PROFILE_COUNT = PROFILE_REGISTRY.size;

export function isClientProfileId(value: string): value is ClientProfileId {
  return (CLIENT_PROFILE_IDS as readonly string[]).includes(value);
}

export function isStaffProfileId(value: string): value is StaffProfileId {
  return (STAFF_PROFILE_IDS as readonly string[]).includes(value);
}

export function isArtistProfileId(value: string): value is ArtistProfileId {
  return (ARTIST_PROFILE_IDS as readonly string[]).includes(value);
}

export function isClientProfile(value: string): value is ClientProfileId {
  return isClientProfileId(value);
}

export function isStaffProfile(value: string): value is StaffProfileId {
  return isStaffProfileId(value);
}

export function isArtistProfile(value: string): value is ArtistProfileId {
  return isArtistProfileId(value);
}

export function isArtistTier(value: string): value is ArtistTier {
  return (ARTIST_TIERS as readonly string[]).includes(value);
}

export function listSupportedProfiles(): readonly ProfileDefinition[] {
  return Object.freeze([...PROFILE_REGISTRY.values()]);
}

export function getProfileDefinition(
  profileId: SupportedProfileId,
): ProfileDefinition | undefined {
  return PROFILE_REGISTRY.get(profileId);
}

export function assertSupportedProfile(profileId: string): ProfileDefinition {
  if (!isSupportedProfileId(profileId)) {
    throw new PermissionError('PERM_INVALID_PROFILE', `Unsupported profile id: "${profileId}"`);
  }

  return PROFILE_REGISTRY.get(profileId)!;
}

export function isSupportedProfileId(value: string): value is SupportedProfileId {
  return isClientProfileId(value) || isStaffProfileId(value) || isArtistProfileId(value);
}

export function resolveDocumentedRole(input: ProfileResolveInput): DocumentedRoleId {
  switch (input.kind) {
    case 'guest':
      return 'guest';
    case 'client':
      if (!isClientProfileId(input.profileId)) {
        throw new PermissionError(
          'PERM_INVALID_PROFILE',
          `Unsupported client profile id: "${input.profileId}"`,
        );
      }
      return 'buyer';
    case 'staff':
      if (!isStaffProfileId(input.profileId)) {
        throw new PermissionError(
          'PERM_INVALID_PROFILE',
          `Unsupported staff profile id: "${input.profileId}"`,
        );
      }
      return STAFF_ROLE_BY_PROFILE[input.profileId];
    case 'artist':
      if (!isArtistProfileId(input.profileId)) {
        throw new PermissionError(
          'PERM_INVALID_PROFILE',
          `Unsupported artist profile id: "${input.profileId}"`,
        );
      }
      if (!isArtistTier(input.tier)) {
        throw new PermissionError(
          'PERM_INVALID_ARTIST_TIER',
          `Unsupported artist tier: "${input.tier}"`,
        );
      }
      return ARTIST_ROLE_BY_TIER[input.tier];
    default: {
      const exhaustive: never = input;
      throw new PermissionError('PERM_INVALID_PROFILE', `Unsupported profile input: ${exhaustive}`);
    }
  }
}

export function resolveProfile(input: ProfileResolveInput): ResolvedProfile {
  const documentedRole = resolveDocumentedRole(input);
  assertDocumentedRole(documentedRole);

  switch (input.kind) {
    case 'guest':
      return Object.freeze({
        profileId: 'guest',
        kind: 'guest',
        documentedRole,
      });
    case 'client':
      return Object.freeze({
        profileId: input.profileId,
        kind: 'client',
        documentedRole,
        clientProfileType: CLIENT_PROFILE_TYPE_BY_ID[input.profileId],
      });
    case 'staff':
      return Object.freeze({
        profileId: input.profileId,
        kind: 'staff',
        documentedRole,
      });
    case 'artist':
      return Object.freeze({
        profileId: input.profileId,
        kind: 'artist',
        documentedRole,
        artistCategory: ARTIST_CATEGORY_BY_PROFILE[input.profileId],
        artistTier: input.tier,
      });
    default: {
      const exhaustive: never = input;
      throw new PermissionError('PERM_INVALID_PROFILE', `Unsupported profile input: ${exhaustive}`);
    }
  }
}
