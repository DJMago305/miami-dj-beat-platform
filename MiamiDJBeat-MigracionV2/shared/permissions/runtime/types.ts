/** MOD-003 Permissions — types — TICKET-MOD-003-CAPABILITY-REGISTRY-001 · TICKET-MOD-003-PROFILE-MATRIX-001 */

/** Portal binding for capability checks (includes guest browse). */
export type PermissionPortalId = 'client' | 'artist' | 'staff' | 'guest';

/** Documented roles — PERMISSIONS-SPEC.md §2 · ROLE-MATRIX.md. */
export type DocumentedRoleId =
  | 'guest'
  | 'buyer'
  | 'artist_lite'
  | 'artist_pro'
  | 'artist_elite'
  | 'staff_seller'
  | 'staff_manager'
  | 'staff_admin'
  | 'staff_owner';

export type ProfileKind = 'guest' | 'client' | 'staff' | 'artist';

export type ClientProfileId = 'client.regular' | 'client.vip' | 'client.commercial';

export type ClientProfileType = 'regular' | 'vip' | 'commercial';

export type StaffProfileId = 'staff.owner' | 'staff.manager' | 'staff.seller';

export type ArtistProfileId =
  | 'artist.dj'
  | 'artist.singer_solo'
  | 'artist.band_group'
  | 'artist.mc_host'
  | 'artist.musician'
  | 'artist.dancer_performer'
  | 'artist.clown_kids'
  | 'artist.custom';

/** Artistic discipline — orthogonal to ArtistTier. */
export type ArtistCategory =
  | 'DJ'
  | 'Singer'
  | 'Band'
  | 'MC'
  | 'Musician'
  | 'Dancer'
  | 'Clown'
  | 'Other';

/** Commercial artist tier — orthogonal to ArtistCategory. */
export type ArtistTier = 'Lite' | 'Pro' | 'Elite';

export type SupportedProfileId = ClientProfileId | StaffProfileId | ArtistProfileId;

export type ProfileResolveInput =
  | { readonly kind: 'guest' }
  | { readonly kind: 'client'; readonly profileId: ClientProfileId }
  | { readonly kind: 'staff'; readonly profileId: StaffProfileId }
  | {
      readonly kind: 'artist';
      readonly profileId: ArtistProfileId;
      readonly tier: ArtistTier;
    };

export type ResolvedProfile = {
  readonly profileId: string;
  readonly kind: ProfileKind;
  readonly documentedRole: DocumentedRoleId;
  readonly clientProfileType?: ClientProfileType;
  readonly artistCategory?: ArtistCategory;
  readonly artistTier?: ArtistTier;
};

export type DocumentedRoleDefinition = {
  readonly id: DocumentedRoleId;
  readonly label: string;
  readonly matrixKey: string;
  readonly portalHome: PermissionPortalId | null;
  readonly principal: 'buyer' | 'performer' | 'staff' | null;
};

export type ProfileDefinition = {
  readonly id: SupportedProfileId;
  readonly kind: Exclude<ProfileKind, 'guest'>;
  readonly label: string;
  readonly documentedRole: DocumentedRoleId | null;
  readonly clientProfileType?: ClientProfileType;
  readonly artistCategory?: ArtistCategory;
};

/** Top-level capability namespace — first segment of capability id. */
export type CapabilityDomain =
  | 'orders'
  | 'payments'
  | 'crm'
  | 'jobs'
  | 'artist'
  | 'client'
  | 'staff'
  | 'system'
  | 'guest'
  | 'notifications';

/** Branded capability id — `domain.resource.action[.scope]`. */
export type CapabilityId = string & { readonly __brand: 'CapabilityId' };

export type CapabilityDefinition = {
  readonly id: CapabilityId;
  readonly domain: CapabilityDomain;
  readonly description: string;
  readonly portals: readonly PermissionPortalId[];
  readonly redZone: boolean;
};

export type PermissionErrorCode =
  | 'PERM_INVALID_CAPABILITY_ID'
  | 'PERM_CAPABILITY_NOT_REGISTERED'
  | 'PERM_PORTAL_NOT_ALLOWED'
  | 'PERM_INVALID_PROFILE'
  | 'PERM_INVALID_ARTIST_TIER'
  | 'PERM_DOCUMENTED_ROLE_NOT_FOUND';

export const CAPABILITY_ID_FORMAT =
  /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export const CAPABILITY_REGISTRY_VERSION = '1.0.0' as const;
