/** MOD-003 Permissions — public API — TICKET-MOD-003-CAPABILITY-REGISTRY-001 · TICKET-MOD-003-PROFILE-MATRIX-001 · TICKET-MOD-003-PERMISSION-RESOLVER-001 */

export { PermissionError, isPermissionError } from './errors';
export {
  CAPABILITY_COUNT,
  CAPABILITY_REGISTRY,
  assertCapabilityAllowedOnPortal,
  assertCapabilityIdFormat,
  assertCapabilityRegistered,
  capabilityAllowedOnPortal,
  getCapabilityDefinition,
  isRegisteredCapability,
  isValidCapabilityIdFormat,
  listAllCapabilities,
  listCapabilitiesByDomain,
  listCapabilityDomains,
} from './capability-registry';
export {
  assertCapability,
  hasCapability,
  listEffectiveCapabilities,
  resolvePermissionSnapshot,
} from './permission-resolver';
export {
  PROFILE_COUNT,
  PROFILE_REGISTRY,
  assertSupportedProfile,
  getProfileDefinition,
  isArtistProfile,
  isArtistProfileId,
  isArtistTier,
  isClientProfile,
  isClientProfileId,
  isStaffProfile,
  isStaffProfileId,
  isSupportedProfileId,
  listSupportedProfiles,
  resolveDocumentedRole,
  resolveProfile,
} from './profile-matrix';
export {
  ROLE_CAPABILITY_COUNTS,
  ROLE_CAPABILITY_MATRIX,
  assertRoleCapabilities,
  getRoleCapabilities,
  getRoleCapabilityCount,
  listRoleCapabilityMatrixRoles,
} from './role-capability-matrix';
export {
  DOCUMENTED_ROLE_COUNT,
  DOCUMENTED_ROLE_REGISTRY,
  assertDocumentedRole,
  getDocumentedRoleDefinition,
  isDocumentedRoleId,
  listSupportedRoles,
} from './role-matrix';
export type {
  ArtistCategory,
  ArtistProfileId,
  ArtistTier,
  CapabilityDefinition,
  CapabilityDomain,
  CapabilityId,
  ClientProfileId,
  ClientProfileType,
  DocumentedRoleDefinition,
  DocumentedRoleId,
  PermissionErrorCode,
  PermissionPortalId,
  PermissionResolverInput,
  PermissionSnapshot,
  ProfileDefinition,
  ProfileKind,
  ProfileResolveInput,
  ResolvedProfile,
  SnapshotFlags,
  StaffProfileId,
  SupportedProfileId,
} from './types';
export { CAPABILITY_ID_FORMAT, CAPABILITY_REGISTRY_VERSION } from './types';
