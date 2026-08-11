/** Profiles domain service — public barrel — Paso 2+3 (read model + read fetch). */

export type {
  AccessSnapshotDTO,
  AccessSnapshotFailureDTO,
  AccessSnapshotProfileKind,
  AccessSnapshotRpcPayload,
  AccessSnapshotSuccessDTO,
  ArtistProfileReadDTO,
  ArtistTaxonomySignals,
  BuyerBillingTier,
  ClientProfileReadDTO,
  ClientTaxonomySignals,
  ClientVenueType,
  PublicArtistCardDTO,
  StaffIdentityDTO,
  StaffTaxonomySignals,
} from './profiles.types';

export {
  MOCK_ACCESS_SNAPSHOT_ARTIST_PRO,
  MOCK_ACCESS_SNAPSHOT_BUYER,
  MOCK_ACCESS_SNAPSHOT_FAILURE,
  MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
  MOCK_ACCESS_SNAPSHOT_VIP,
  MOCK_ARTIST_PROFILE_DJ_PRO,
  MOCK_CLIENT_PROFILE_REGULAR,
  MOCK_PUBLIC_ARTIST_CARD,
  MOCK_STAFF_IDENTITY_OWNER,
} from './profiles.mocks';

export { mapAccessSnapshotRpcToDto } from './profiles.map-snapshot';

export {
  firstRestRow,
  mapArtistProfileRow,
  mapClientProfileRow,
  mapPublicArtistCardRow,
  mapStaffIdentityFromRole,
} from './profiles.map-rows';

export {
  classifyPlatformIdentity,
  toPermissionSnapshotFlags,
} from './profiles.identity-map';
export type {
  ClassifyPlatformIdentityInput,
  ProfilesIdentityClassification,
  ProfilesIdentityClassificationFailure,
  ProfilesIdentityClassificationSuccess,
  ProfilesIdentityFlags,
  ProfilesIdentityPrincipal,
} from './profiles.identity-map';

export {
  createApiProfilesDataPort,
  createProfilesService,
  createProfilesServiceFromApiClient,
} from './profiles.service';
export type {
  CreateProfilesServiceFromApiClientInput,
  CreateProfilesServiceInput,
  ProfilesDataPort,
  ProfilesFetchOptions,
  ProfilesIdentityClassificationSuccessData,
  ProfilesService,
  ProfilesServiceErrorCode,
} from './profiles.service';

export {
  artistCategoryToProfileId,
  mapArtistTierFromSnapshot,
  resolveArtistCategoryFromSpecialty,
  resolveArtistTaxonomy,
  resolveClientProfileId,
  resolveClientProfileType,
  resolveStaffProfileId,
  staffIsManagement,
  staffIsStaff,
} from './profile-taxonomy-resolve';
