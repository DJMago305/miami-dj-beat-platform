/** MOD-003 Staff Portal — component guards wire — TICKET-MOD-003-STAFF-WIRE-AND-CLOSEOUT-001 */

import {
  canEnableComponent,
  canRenderComponent,
  canUseAction,
  listComponentsForPortal,
  type ComponentGuardResult,
  type ComponentId,
} from '../shared/permissions/runtime';
import {
  asSessionSnapshotWithPermissions,
  getSessionSnapshot,
  hasSessionCapability,
} from '@mdj/shared/session';

export const STAFF_PORTAL_ID = 'staff' as const;

export type StaffComponentGuardBundle = {
  readonly componentId: ComponentId;
  readonly render: ComponentGuardResult;
  readonly enable: ComponentGuardResult;
  readonly action: ComponentGuardResult;
  readonly sessionCapabilityProbe: boolean | null;
};

export type StaffComponentGuardRegistry = {
  readonly portal: typeof STAFF_PORTAL_ID;
  readonly resolvedAt: string;
  readonly componentCount: number;
  readonly components: readonly StaffComponentGuardBundle[];
};

let staffComponentGuardRegistry: StaffComponentGuardRegistry | null = null;

function probeSessionCapability(
  requiredCapabilities: readonly string[],
  readCapabilities: readonly string[],
): boolean | null {
  const capabilityId = requiredCapabilities[0] ?? readCapabilities[0] ?? null;
  if (!capabilityId) {
    return null;
  }

  return hasSessionCapability(capabilityId, STAFF_PORTAL_ID);
}

function resolveBundle(
  definition: ReturnType<typeof listComponentsForPortal>[number],
  permissions: ReturnType<typeof asSessionSnapshotWithPermissions>['permissions'] | null,
): StaffComponentGuardBundle {
  const input = {
    componentId: definition.id,
    portal: STAFF_PORTAL_ID,
    snapshot: permissions,
  };

  return Object.freeze({
    componentId: definition.id,
    render: canRenderComponent(input),
    enable: canEnableComponent(input),
    action: canUseAction(input),
    sessionCapabilityProbe: probeSessionCapability(
      definition.requiredCapabilities,
      definition.readCapabilities,
    ),
  });
}

export function resolveStaffPortalComponentGuards(): StaffComponentGuardRegistry {
  const permissions = asSessionSnapshotWithPermissions(getSessionSnapshot()).permissions ?? null;
  const components = Object.freeze(
    listComponentsForPortal(STAFF_PORTAL_ID).map((definition) =>
      resolveBundle(definition, permissions),
    ),
  );

  const registry: StaffComponentGuardRegistry = Object.freeze({
    portal: STAFF_PORTAL_ID,
    resolvedAt: new Date().toISOString(),
    componentCount: components.length,
    components,
  });

  staffComponentGuardRegistry = registry;
  return registry;
}

export function getStaffPortalComponentGuardRegistry(): StaffComponentGuardRegistry | null {
  return staffComponentGuardRegistry;
}

export function getStaffPortalComponentGuardBundle(
  componentId: string,
): StaffComponentGuardBundle | null {
  const registry = staffComponentGuardRegistry;
  if (!registry) {
    return null;
  }

  return registry.components.find((entry) => entry.componentId === componentId) ?? null;
}

/** Test-only reset — not for production portals. */
export function resetStaffPortalComponentGuardRegistryForTests(): void {
  staffComponentGuardRegistry = null;
}
