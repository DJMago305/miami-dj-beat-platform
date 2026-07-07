/** MOD-003 Permissions — component guards — TICKET-MOD-003-COMPONENT-GUARDS-001 */

import {
  getComponentDefinition,
  listComponentsForRoute,
  type ComponentDefinition,
  type ComponentId,
  type ComponentPortalId,
} from './component-capability-map';
import { ROUTE_CAPABILITY_MAP, type RouteId } from './route-capability-map';
import { hasCapability } from './permission-resolver';
import type { CapabilityId, PermissionPortalId, PermissionSnapshot } from './types';

export type ComponentVisibilityPolicy = 'VISIBLE' | 'HIDDEN' | 'DISABLED' | 'READ_ONLY';

export type ComponentGuardReason =
  | 'GRANTED'
  | 'COMPONENT_NOT_REGISTERED'
  | 'COMPONENT_PORTAL_MISMATCH'
  | 'SNAPSHOT_REQUIRED'
  | 'SNAPSHOT_STALE'
  | 'CAPABILITY_DENIED'
  | 'READ_ONLY';

export type ComponentGuardInput = {
  readonly componentId: string;
  readonly portal: ComponentPortalId;
  readonly snapshot: PermissionSnapshot | null | undefined;
  readonly checkPortal?: PermissionPortalId;
  readonly minSnapshotVersion?: number;
};

export type ComponentGuardResult = {
  readonly allowed: boolean;
  readonly componentId: ComponentId;
  readonly visibility: ComponentVisibilityPolicy;
  readonly reason: ComponentGuardReason;
  readonly requiredCapabilities: readonly CapabilityId[];
  readonly matchedCapabilities: readonly CapabilityId[];
};

const STAFF_DASHBOARD_CAPABILITY = 'staff.dashboard.access' as CapabilityId;

function asComponentId(componentId: string): ComponentId {
  return componentId as ComponentId;
}

function buildResult(
  componentId: string,
  allowed: boolean,
  visibility: ComponentVisibilityPolicy,
  reason: ComponentGuardReason,
  requiredCapabilities: readonly CapabilityId[],
  matchedCapabilities: readonly CapabilityId[],
): ComponentGuardResult {
  return Object.freeze({
    allowed,
    componentId: asComponentId(componentId),
    visibility,
    reason,
    requiredCapabilities: Object.freeze([...requiredCapabilities]),
    matchedCapabilities: Object.freeze([...matchedCapabilities]),
  });
}

function evaluateCapabilities(
  snapshot: PermissionSnapshot,
  capabilities: readonly CapabilityId[],
  effectivePortal: PermissionPortalId,
  match: ComponentDefinition['match'],
): { readonly ok: boolean; readonly matched: CapabilityId[] } {
  if (capabilities.length === 0) {
    return { ok: true, matched: [] };
  }

  const matched: CapabilityId[] = [];

  if (match === 'any') {
    for (const capability of capabilities) {
      if (hasCapability(snapshot, capability, effectivePortal)) {
        matched.push(capability);
      }
    }

    return { ok: matched.length > 0, matched };
  }

  for (const capability of capabilities) {
    if (!hasCapability(snapshot, capability, effectivePortal)) {
      return { ok: false, matched };
    }

    matched.push(capability);
  }

  return { ok: true, matched };
}

function getRelatedWriteCapabilities(definition: ComponentDefinition): readonly CapabilityId[] {
  const writeRouteId = `${definition.relatedRouteId}.write` as RouteId;
  if (!(writeRouteId in ROUTE_CAPABILITY_MAP)) {
    return Object.freeze([]);
  }

  const writeCaps = new Set<CapabilityId>();
  for (const component of listComponentsForRoute(writeRouteId)) {
    for (const capability of component.requiredCapabilities) {
      if (capability !== STAFF_DASHBOARD_CAPABILITY) {
        writeCaps.add(capability);
      }
    }
  }

  return Object.freeze([...writeCaps]);
}

function shouldRenderReadOnly(
  definition: ComponentDefinition,
  snapshot: PermissionSnapshot,
  effectivePortal: PermissionPortalId,
): boolean {
  if (definition.kind !== 'surface' || definition.readCapabilities.length === 0) {
    return false;
  }

  const readEvaluation = evaluateCapabilities(
    snapshot,
    definition.readCapabilities,
    effectivePortal,
    definition.match,
  );
  if (!readEvaluation.ok) {
    return false;
  }

  const requiredEvaluation = evaluateCapabilities(
    snapshot,
    definition.requiredCapabilities,
    effectivePortal,
    definition.match,
  );
  if (!requiredEvaluation.ok) {
    return false;
  }

  const writeCapabilities = getRelatedWriteCapabilities(definition);
  if (writeCapabilities.length === 0) {
    return false;
  }

  for (const capability of writeCapabilities) {
    if (!hasCapability(snapshot, capability, effectivePortal)) {
      return true;
    }
  }

  return false;
}

type GuardContext = {
  readonly definition: ComponentDefinition;
  readonly input: ComponentGuardInput;
  readonly effectivePortal: PermissionPortalId;
};

function resolveGuardContext(input: ComponentGuardInput):
  | { readonly ok: false; readonly result: ComponentGuardResult }
  | { readonly ok: true; readonly context: GuardContext } {
  const definition = getComponentDefinition(input.componentId);

  if (!definition) {
    return {
      ok: false,
      result: buildResult(
        input.componentId,
        false,
        'HIDDEN',
        'COMPONENT_NOT_REGISTERED',
        [],
        [],
      ),
    };
  }

  if (definition.portal !== input.portal) {
    return {
      ok: false,
      result: buildResult(
        input.componentId,
        false,
        'HIDDEN',
        'COMPONENT_PORTAL_MISMATCH',
        definition.requiredCapabilities,
        [],
      ),
    };
  }

  if (!input.snapshot) {
    return {
      ok: false,
      result: buildResult(
        input.componentId,
        false,
        'HIDDEN',
        'SNAPSHOT_REQUIRED',
        definition.requiredCapabilities,
        [],
      ),
    };
  }

  if (
    input.minSnapshotVersion !== undefined &&
    input.snapshot.snapshotVersion < input.minSnapshotVersion
  ) {
    return {
      ok: false,
      result: buildResult(
        input.componentId,
        false,
        'HIDDEN',
        'SNAPSHOT_STALE',
        definition.requiredCapabilities,
        [],
      ),
    };
  }

  return {
    ok: true,
    context: {
      definition,
      input,
      effectivePortal: input.checkPortal ?? input.portal,
    },
  };
}

export function canRenderComponent(input: ComponentGuardInput): ComponentGuardResult {
  const resolved = resolveGuardContext(input);
  if (!resolved.ok) {
    return resolved.result;
  }

  const { definition, effectivePortal } = resolved.context;
  const snapshot = input.snapshot!;

  const requiredEvaluation = evaluateCapabilities(
    snapshot,
    definition.requiredCapabilities,
    effectivePortal,
    definition.match,
  );

  if (requiredEvaluation.ok) {
    if (shouldRenderReadOnly(definition, snapshot, effectivePortal)) {
      const readEvaluation = evaluateCapabilities(
        snapshot,
        definition.readCapabilities,
        effectivePortal,
        definition.match,
      );

      return buildResult(
        input.componentId,
        true,
        'READ_ONLY',
        'READ_ONLY',
        definition.requiredCapabilities,
        [...requiredEvaluation.matched, ...readEvaluation.matched],
      );
    }

    return buildResult(
      input.componentId,
      true,
      'VISIBLE',
      'GRANTED',
      definition.requiredCapabilities,
      requiredEvaluation.matched,
    );
  }

  const readEvaluation = evaluateCapabilities(
    snapshot,
    definition.readCapabilities,
    effectivePortal,
    definition.match,
  );

  if (definition.readCapabilities.length > 0 && readEvaluation.ok) {
    return buildResult(
      input.componentId,
      true,
      'READ_ONLY',
      'READ_ONLY',
      definition.requiredCapabilities,
      readEvaluation.matched,
    );
  }

  const deniedVisibility = definition.statePolicy.onDeniedRender;
  return buildResult(
    input.componentId,
    false,
    deniedVisibility,
    'CAPABILITY_DENIED',
    definition.requiredCapabilities,
    readEvaluation.matched,
  );
}

export function canEnableComponent(input: ComponentGuardInput): ComponentGuardResult {
  const renderResult = canRenderComponent(input);

  if (renderResult.visibility === 'HIDDEN') {
    return renderResult;
  }

  if (renderResult.reason === 'READ_ONLY' || renderResult.visibility === 'READ_ONLY') {
    const definition = getComponentDefinition(input.componentId)!;
    return buildResult(
      input.componentId,
      false,
      'DISABLED',
      'READ_ONLY',
      definition.requiredCapabilities,
      renderResult.matchedCapabilities,
    );
  }

  if (!renderResult.allowed) {
    const definition = getComponentDefinition(input.componentId)!;
    return buildResult(
      input.componentId,
      false,
      definition.statePolicy.onDeniedEnable,
      renderResult.reason,
      definition.requiredCapabilities,
      renderResult.matchedCapabilities,
    );
  }

  return renderResult;
}

export function canUseAction(input: ComponentGuardInput): ComponentGuardResult {
  const resolved = resolveGuardContext(input);
  if (!resolved.ok) {
    return resolved.result;
  }

  const { definition, effectivePortal } = resolved.context;
  const snapshot = input.snapshot!;

  if (shouldRenderReadOnly(definition, snapshot, effectivePortal)) {
    return buildResult(
      input.componentId,
      false,
      'HIDDEN',
      'READ_ONLY',
      definition.requiredCapabilities,
      [],
    );
  }

  const requiredEvaluation = evaluateCapabilities(
    snapshot,
    definition.requiredCapabilities,
    effectivePortal,
    definition.match,
  );

  if (requiredEvaluation.ok) {
    return buildResult(
      input.componentId,
      true,
      'VISIBLE',
      'GRANTED',
      definition.requiredCapabilities,
      requiredEvaluation.matched,
    );
  }

  const readEvaluation = evaluateCapabilities(
    snapshot,
    definition.readCapabilities,
    effectivePortal,
    definition.match,
  );

  return buildResult(
    input.componentId,
    false,
    definition.statePolicy.onDeniedEnable,
    'CAPABILITY_DENIED',
    definition.requiredCapabilities,
    readEvaluation.matched,
  );
}
