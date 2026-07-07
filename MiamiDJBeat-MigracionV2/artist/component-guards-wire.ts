/** MOD-003 Artist Portal — component guards wire — TICKET-MOD-003-PORTAL-COMPONENT-GUARDS-ARTIST-001 */

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

export const ARTIST_PORTAL_ID = 'artist' as const;

export type ArtistComponentGuardBundle = {
  readonly componentId: ComponentId;
  readonly render: ComponentGuardResult;
  readonly enable: ComponentGuardResult;
  readonly action: ComponentGuardResult;
  readonly sessionCapabilityProbe: boolean | null;
};

export type ArtistComponentGuardRegistry = {
  readonly portal: typeof ARTIST_PORTAL_ID;
  readonly resolvedAt: string;
  readonly componentCount: number;
  readonly components: readonly ArtistComponentGuardBundle[];
};

let artistComponentGuardRegistry: ArtistComponentGuardRegistry | null = null;

function probeSessionCapability(
  requiredCapabilities: readonly string[],
  readCapabilities: readonly string[],
): boolean | null {
  const capabilityId = requiredCapabilities[0] ?? readCapabilities[0] ?? null;
  if (!capabilityId) {
    return null;
  }

  return hasSessionCapability(capabilityId, ARTIST_PORTAL_ID);
}

function resolveBundle(
  definition: ReturnType<typeof listComponentsForPortal>[number],
  permissions: ReturnType<typeof asSessionSnapshotWithPermissions>['permissions'] | null,
): ArtistComponentGuardBundle {
  const input = {
    componentId: definition.id,
    portal: ARTIST_PORTAL_ID,
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

export function resolveArtistPortalComponentGuards(): ArtistComponentGuardRegistry {
  const permissions = asSessionSnapshotWithPermissions(getSessionSnapshot()).permissions ?? null;
  const components = Object.freeze(
    listComponentsForPortal(ARTIST_PORTAL_ID).map((definition) =>
      resolveBundle(definition, permissions),
    ),
  );

  const registry: ArtistComponentGuardRegistry = Object.freeze({
    portal: ARTIST_PORTAL_ID,
    resolvedAt: new Date().toISOString(),
    componentCount: components.length,
    components,
  });

  artistComponentGuardRegistry = registry;
  return registry;
}

export function getArtistPortalComponentGuardRegistry(): ArtistComponentGuardRegistry | null {
  return artistComponentGuardRegistry;
}

export function getArtistPortalComponentGuardBundle(
  componentId: string,
): ArtistComponentGuardBundle | null {
  const registry = artistComponentGuardRegistry;
  if (!registry) {
    return null;
  }

  return registry.components.find((entry) => entry.componentId === componentId) ?? null;
}

/** Test-only reset — not for production portals. */
export function resetArtistPortalComponentGuardRegistryForTests(): void {
  artistComponentGuardRegistry = null;
}
