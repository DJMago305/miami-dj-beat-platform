/** MOD-004 Event Bus — event catalog — TICKET-V2-RUNTIME-EVENT-BUS-001 */

import type { CatalogEntry } from './types';

/** Base + extended catalog entries from EVENT-BUS-SPEC.md (validation only). */
export const EVENT_CATALOG: readonly CatalogEntry[] = [
  {
    name: 'BUS_READY',
    scope: 'internal',
    authorizedEmitters: ['MOD-004'],
    requiredPayloadKeys: ['busVersion'],
    onceEligible: true,
    defaultVersion: 1,
  },
  {
    name: 'SYSTEM_READY',
    scope: 'internal',
    authorizedEmitters: ['MOD-RUNTIME'],
    requiredPayloadKeys: ['busVersion', 'runtimeVersion'],
    onceEligible: true,
    defaultVersion: 1,
  },
  {
    name: 'SYSTEM_ERROR',
    scope: 'internal',
    authorizedEmitters: ['MOD-014', 'MOD-005'],
    requiredPayloadKeys: ['code'],
    defaultVersion: 1,
  },
  {
    name: 'USER_LOGIN',
    scope: 'public',
    authorizedEmitters: ['MOD-001'],
    requiredPayloadKeys: ['userId'],
    defaultVersion: 1,
  },
  {
    name: 'USER_LOGOUT',
    scope: 'public',
    authorizedEmitters: ['MOD-001', 'MOD-002'],
    requiredPayloadKeys: ['reason'],
    defaultVersion: 1,
  },
  {
    name: 'SESSION_CREATED',
    scope: 'internal',
    authorizedEmitters: ['MOD-002'],
    requiredPayloadKeys: ['userId', 'hydrationPhase'],
    defaultVersion: 1,
  },
  {
    name: 'SESSION_DESTROYED',
    scope: 'internal',
    authorizedEmitters: ['MOD-002'],
    requiredPayloadKeys: ['reason'],
    defaultVersion: 1,
  },
  {
    name: 'SESSION_CLEARED',
    scope: 'internal',
    authorizedEmitters: ['MOD-002'],
    requiredPayloadKeys: ['sessionId'],
    defaultVersion: 1,
  },
  {
    name: 'ROLE_CHANGED',
    scope: 'internal',
    authorizedEmitters: ['MOD-003'],
    requiredPayloadKeys: ['userId', 'role', 'principal'],
    defaultVersion: 1,
  },
  {
    name: 'PERMISSION_CHANGED',
    scope: 'internal',
    authorizedEmitters: ['MOD-003'],
    requiredPayloadKeys: ['userId', 'snapshotVersion'],
    defaultVersion: 1,
  },
  {
    name: 'ORDER_CREATED',
    scope: 'public',
    authorizedEmitters: ['MOD-409'],
    requiredPayloadKeys: ['orderId', 'status'],
    defaultVersion: 1,
  },
  {
    name: 'ORDER_UPDATED',
    scope: 'public',
    authorizedEmitters: ['MOD-409'],
    requiredPayloadKeys: ['orderId', 'status'],
    defaultVersion: 1,
  },
  {
    name: 'ORDER_CLOSED',
    scope: 'public',
    authorizedEmitters: ['MOD-409'],
    requiredPayloadKeys: ['orderId'],
    defaultVersion: 1,
  },
  {
    name: 'PAYMENT_CREATED',
    scope: 'public',
    authorizedEmitters: ['MOD-409'],
    requiredPayloadKeys: ['paymentId'],
    defaultVersion: 1,
  },
  {
    name: 'PAYMENT_COMPLETED',
    scope: 'public',
    authorizedEmitters: ['MOD-409'],
    requiredPayloadKeys: ['paymentId', 'status'],
    defaultVersion: 1,
  },
  {
    name: 'PROFILE_UPDATED',
    scope: 'public',
    authorizedEmitters: ['MOD-409'],
    requiredPayloadKeys: ['profileType', 'userId'],
    defaultVersion: 1,
  },
  {
    name: 'NOTIFICATION_CREATED',
    scope: 'public',
    authorizedEmitters: ['MOD-011'],
    requiredPayloadKeys: ['notificationId'],
    defaultVersion: 1,
  },
  {
    name: 'THEME_READY',
    scope: 'public',
    authorizedEmitters: ['MOD-007'],
    requiredPayloadKeys: ['mode', 'themeId'],
    onceEligible: true,
    defaultVersion: 1,
  },
  {
    name: 'THEME_CHANGED',
    scope: 'public',
    authorizedEmitters: ['MOD-007'],
    requiredPayloadKeys: ['mode'],
    defaultVersion: 1,
  },
  {
    name: 'LANGUAGE_CHANGED',
    scope: 'public',
    authorizedEmitters: ['MOD-015'],
    requiredPayloadKeys: ['locale'],
    defaultVersion: 1,
  },
  {
    name: 'PORTAL_READY',
    scope: 'public',
    authorizedEmitters: ['MOD-PORTAL-SHELL'],
    requiredPayloadKeys: ['portal', 'surface'],
    onceEligible: true,
    defaultVersion: 1,
  },
  {
    name: 'DASHBOARD_READY',
    scope: 'public',
    authorizedEmitters: ['MOD-PORTAL-SHELL'],
    requiredPayloadKeys: ['portal'],
    onceEligible: true,
    defaultVersion: 1,
  },
  {
    name: 'SESSION_READY',
    scope: 'public',
    authorizedEmitters: ['MOD-002'],
    requiredPayloadKeys: ['portal'],
    defaultVersion: 1,
  },
  {
    name: 'SESSION_EXPIRED',
    scope: 'public',
    authorizedEmitters: ['MOD-002'],
    requiredPayloadKeys: ['reason'],
    defaultVersion: 1,
  },
  {
    name: 'SESSION_REFRESH',
    scope: 'internal',
    authorizedEmitters: ['MOD-002'],
    requiredPayloadKeys: ['userId'],
    defaultVersion: 1,
  },
  {
    name: 'SESSION_ERROR',
    scope: 'internal',
    authorizedEmitters: ['MOD-002'],
    requiredPayloadKeys: ['code'],
    defaultVersion: 1,
  },
  {
    name: 'FLAGS_READY',
    scope: 'public',
    authorizedEmitters: ['MOD-013'],
    requiredPayloadKeys: ['registryVersion'],
    defaultVersion: 1,
  },
  {
    name: 'FLAGS_UPDATED',
    scope: 'public',
    authorizedEmitters: ['MOD-013'],
    requiredPayloadKeys: ['key'],
    defaultVersion: 1,
  },
  {
    name: 'RESPONSIVE_READY',
    scope: 'public',
    authorizedEmitters: ['MOD-016'],
    requiredPayloadKeys: ['breakpoint'],
    defaultVersion: 1,
  },
  {
    name: 'BREAKPOINT_CHANGED',
    scope: 'public',
    authorizedEmitters: ['MOD-016'],
    requiredPayloadKeys: ['breakpoint'],
    defaultVersion: 1,
  },
  {
    name: 'ORIENTATION_CHANGED',
    scope: 'public',
    authorizedEmitters: ['MOD-016'],
    requiredPayloadKeys: ['orientation'],
    defaultVersion: 1,
  },
] as const;

const catalogByName = new Map<string, CatalogEntry>(
  EVENT_CATALOG.map((entry) => [entry.name, entry]),
);

export function getCatalogEntry(name: string): CatalogEntry | undefined {
  return catalogByName.get(name);
}

export function isValidEventName(name: string): boolean {
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(name);
}
