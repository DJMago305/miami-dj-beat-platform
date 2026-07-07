/** MOD-003 Permissions — public API — TICKET-MOD-003-CAPABILITY-REGISTRY-001 */

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
export type {
  CapabilityDefinition,
  CapabilityDomain,
  CapabilityId,
  PermissionErrorCode,
  PermissionPortalId,
} from './types';
export { CAPABILITY_ID_FORMAT, CAPABILITY_REGISTRY_VERSION } from './types';
