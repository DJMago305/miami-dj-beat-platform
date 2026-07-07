/** MOD-003 Permissions — public API — TICKET-MOD-003-CAPABILITY-REGISTRY-001 · TICKET-MOD-003-PROFILE-MATRIX-001 · TICKET-MOD-003-PERMISSION-RESOLVER-001 · TICKET-MOD-003-ROUTE-GUARDS-001 · TICKET-MOD-003-COMPONENT-MAP-001 */

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
  ROUTE_CAPABILITY_MAP,
  ROUTE_COUNT,
  canActivateRoute,
  getRouteDefinition,
  isRegisteredRoute,
  listRoutesForPortal,
} from './route-guards';
export type {
  RouteAccessMode,
  RouteCapabilityMatch,
  RouteDefinition,
  RouteGuardAllowedResult,
  RouteGuardDeniedResult,
  RouteGuardDenyReason,
  RouteGuardInput,
  RouteGuardResult,
  RouteId,
  RoutePortalId,
  RouteRedirectHint,
} from './route-guards';
export {
  COMPONENT_CAPABILITY_MAP,
  COMPONENT_COUNT,
  getComponentDefinition,
  isRegisteredComponent,
  listComponentsForPortal,
  listComponentsForRoute,
} from './component-capability-map';
export type {
  ComponentCapabilityMatch,
  ComponentDefinition,
  ComponentId,
  ComponentKind,
  ComponentPortalId,
  ComponentStatePolicy,
} from './component-capability-map';
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
