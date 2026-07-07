/** MOD-003 Permissions — route guards — TICKET-MOD-003-ROUTE-GUARDS-001 */

import { hasCapability } from './permission-resolver';
import {
  ROUTE_CAPABILITY_MAP,
  type RouteDefinition,
  type RouteId,
  type RoutePortalId,
} from './route-capability-map';
import type { CapabilityId, PermissionPortalId, PermissionSnapshot } from './types';

export type RouteGuardDenyReason =
  | 'ROUTE_NOT_REGISTERED'
  | 'ROUTE_PORTAL_MISMATCH'
  | 'SNAPSHOT_REQUIRED'
  | 'SNAPSHOT_STALE'
  | 'CAPABILITY_DENIED';

export type RouteRedirectHint =
  | 'none'
  | 'login'
  | 'portal-home'
  | 'forbidden'
  | 'staff-gate-failed';

export type RouteGuardInput = {
  readonly routeId: string;
  readonly portal: RoutePortalId;
  readonly snapshot: PermissionSnapshot | null | undefined;
  readonly checkPortal?: PermissionPortalId;
  readonly minSnapshotVersion?: number;
};

export type RouteGuardAllowedResult = {
  readonly allowed: true;
  readonly routeId: RouteId;
  readonly matchedCapabilities: readonly CapabilityId[];
  readonly redirectHint: 'none';
};

export type RouteGuardDeniedResult = {
  readonly allowed: false;
  readonly routeId: RouteId;
  readonly reason: RouteGuardDenyReason;
  readonly requiredCapabilities: readonly CapabilityId[];
  readonly matchedCapabilities: readonly CapabilityId[];
  readonly redirectHint: RouteRedirectHint;
};

export type RouteGuardResult = RouteGuardAllowedResult | RouteGuardDeniedResult;

const STAFF_DASHBOARD_CAPABILITY = 'staff.dashboard.access' as CapabilityId;

function asRouteId(routeId: string): RouteId {
  return routeId as RouteId;
}

function denied(
  routeId: string,
  reason: RouteGuardDenyReason,
  requiredCapabilities: readonly CapabilityId[],
  redirectHint: RouteRedirectHint,
  matchedCapabilities: readonly CapabilityId[] = [],
): RouteGuardDeniedResult {
  return Object.freeze({
    allowed: false,
    routeId: asRouteId(routeId),
    reason,
    requiredCapabilities: Object.freeze([...requiredCapabilities]),
    matchedCapabilities: Object.freeze([...matchedCapabilities]),
    redirectHint,
  });
}

function allowed(
  routeId: string,
  matchedCapabilities: readonly CapabilityId[],
): RouteGuardAllowedResult {
  return Object.freeze({
    allowed: true,
    routeId: asRouteId(routeId),
    matchedCapabilities: Object.freeze([...matchedCapabilities]),
    redirectHint: 'none',
  });
}

function inferCapabilityDeniedHint(
  portal: RoutePortalId,
  snapshot: PermissionSnapshot,
  route: RouteDefinition,
  effectivePortal: PermissionPortalId,
): RouteRedirectHint {
  if (
    portal === 'staff' &&
    route.requiredCapabilities.includes(STAFF_DASHBOARD_CAPABILITY) &&
    !hasCapability(snapshot, STAFF_DASHBOARD_CAPABILITY, effectivePortal)
  ) {
    return 'staff-gate-failed';
  }

  return 'forbidden';
}

function evaluateCapabilities(
  snapshot: PermissionSnapshot,
  route: RouteDefinition,
  effectivePortal: PermissionPortalId,
): { readonly ok: boolean; readonly matched: CapabilityId[] } {
  const required = route.requiredCapabilities;

  if (required.length === 0) {
    return { ok: true, matched: [] };
  }

  const matched: CapabilityId[] = [];

  if (route.match === 'any') {
    for (const capability of required) {
      if (hasCapability(snapshot, capability, effectivePortal)) {
        matched.push(capability);
      }
    }

    return { ok: matched.length > 0, matched };
  }

  for (const capability of required) {
    if (!hasCapability(snapshot, capability, effectivePortal)) {
      return { ok: false, matched };
    }

    matched.push(capability);
  }

  return { ok: true, matched };
}

export function getRouteDefinition(routeId: string): RouteDefinition | null {
  return ROUTE_CAPABILITY_MAP[routeId as RouteId] ?? null;
}

export function isRegisteredRoute(routeId: string): boolean {
  return getRouteDefinition(routeId) !== null;
}

export function listRoutesForPortal(portal: RoutePortalId): readonly RouteDefinition[] {
  return Object.freeze(
    Object.values(ROUTE_CAPABILITY_MAP).filter((definition) => definition.portal === portal),
  );
}

export function canActivateRoute(input: RouteGuardInput): RouteGuardResult {
  const route = getRouteDefinition(input.routeId);

  if (!route) {
    return denied(input.routeId, 'ROUTE_NOT_REGISTERED', [], 'forbidden');
  }

  if (route.portal !== input.portal) {
    return denied(
      input.routeId,
      'ROUTE_PORTAL_MISMATCH',
      route.requiredCapabilities,
      'portal-home',
    );
  }

  if (route.access === 'public') {
    return allowed(input.routeId, []);
  }

  if (!input.snapshot) {
    return denied(
      input.routeId,
      'SNAPSHOT_REQUIRED',
      route.requiredCapabilities,
      'login',
    );
  }

  if (
    input.minSnapshotVersion !== undefined &&
    input.snapshot.snapshotVersion < input.minSnapshotVersion
  ) {
    return denied(
      input.routeId,
      'SNAPSHOT_STALE',
      route.requiredCapabilities,
      'login',
    );
  }

  const effectivePortal = input.checkPortal ?? input.portal;
  const evaluation = evaluateCapabilities(input.snapshot, route, effectivePortal);

  if (evaluation.ok) {
    return allowed(input.routeId, evaluation.matched);
  }

  return denied(
    input.routeId,
    'CAPABILITY_DENIED',
    route.requiredCapabilities,
    inferCapabilityDeniedHint(input.portal, input.snapshot, route, effectivePortal),
    evaluation.matched,
  );
}

export { ROUTE_CAPABILITY_MAP, ROUTE_COUNT } from './route-capability-map';
export type {
  RouteAccessMode,
  RouteCapabilityMatch,
  RouteDefinition,
  RouteId,
  RoutePortalId,
} from './route-capability-map';
