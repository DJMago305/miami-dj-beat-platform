/** MOD-003 Permissions — types — TICKET-MOD-003-CAPABILITY-REGISTRY-001 */

/** Portal binding for capability checks (includes guest browse). */
export type PermissionPortalId = 'client' | 'artist' | 'staff' | 'guest';

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
  | 'PERM_PORTAL_NOT_ALLOWED';

export const CAPABILITY_ID_FORMAT =
  /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export const CAPABILITY_REGISTRY_VERSION = '1.0.0' as const;
