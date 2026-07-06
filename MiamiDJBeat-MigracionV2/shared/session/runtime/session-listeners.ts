/** MOD-002 Session Manager — event bus wiring — TICKET-MOD-002-SESSION-EVENT-WIRING-001 */

import type { EventEnvelope } from '@mdj/shared/events';
import { getEventBus } from '@mdj/shared/events';
import type {
  PermissionChangedEventPayload,
  RoleChangedEventPayload,
  SessionEmitEventName,
  UserLoginEventPayload,
  UserLogoutEventPayload,
} from './types';

const SESSION_EMITTER = { moduleId: 'MOD-002', subsystem: 'session' } as const;

const PUBLIC_EMIT_EVENTS = new Set<SessionEmitEventName>(['SESSION_READY', 'SESSION_EXPIRED']);

export type SessionEventListenerHandlers = {
  readonly onSystemReady: () => void;
  readonly onUserLogin: (payload: UserLoginEventPayload) => void;
  readonly onUserLogout: (payload: UserLogoutEventPayload) => void;
  readonly onRoleChanged: (payload: RoleChangedEventPayload) => void;
  readonly onPermissionChanged: (payload: PermissionChangedEventPayload) => void;
};

let listenersRegistered = false;
const subscriptionIds: string[] = [];

function asRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object') {
    return payload as Record<string, unknown>;
  }
  return {};
}

function readString(payload: Record<string, unknown>, key: string, fallback = ''): string {
  const value = payload[key];
  return typeof value === 'string' ? value : fallback;
}

function readStringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function parseUserLoginPayload(envelope: EventEnvelope): UserLoginEventPayload {
  const payload = asRecord(envelope.payload);
  return {
    userId: readString(payload, 'userId'),
    handoffId: readString(payload, 'handoffId') || undefined,
    accessTokenRef: readString(payload, 'accessTokenRef') || undefined,
    refreshTokenRef: readString(payload, 'refreshTokenRef') || undefined,
    expiresAt: readString(payload, 'expiresAt') || undefined,
    issuedAt: readString(payload, 'issuedAt') || undefined,
    provider: payload.provider === 'supabase' ? 'supabase' : payload.provider === 'mock' ? 'mock' : undefined,
  };
}

export function parseUserLogoutPayload(envelope: EventEnvelope): UserLogoutEventPayload {
  const payload = asRecord(envelope.payload);
  return {
    reason: readString(payload, 'reason', 'logout'),
    userId: readString(payload, 'userId') || undefined,
  };
}

export function parseRoleChangedPayload(envelope: EventEnvelope): RoleChangedEventPayload {
  const payload = asRecord(envelope.payload);
  return {
    userId: readString(payload, 'userId'),
    role: readString(payload, 'role'),
    principal: readString(payload, 'principal'),
    roles: readStringArray(payload, 'roles'),
  };
}

export function parsePermissionChangedPayload(envelope: EventEnvelope): PermissionChangedEventPayload {
  const payload = asRecord(envelope.payload);
  return {
    userId: readString(payload, 'userId'),
    snapshotVersion:
      typeof payload.snapshotVersion === 'number' && Number.isFinite(payload.snapshotVersion)
        ? payload.snapshotVersion
        : undefined,
    capabilities: readStringArray(payload, 'capabilities'),
  };
}

/** Publish official MOD-002 session events through the existing Event Bus. */
export function publishSessionEvent(name: SessionEmitEventName, payload: Record<string, unknown>): void {
  getEventBus().publish({
    name,
    payload,
    emitter: SESSION_EMITTER,
    scope: PUBLIC_EMIT_EVENTS.has(name) ? 'public' : 'internal',
  });
}

/** Idempotent — registers listeners exactly once per runtime boot cycle. */
export function ensureSessionEventListeners(handlers: SessionEventListenerHandlers): void {
  if (listenersRegistered) {
    return;
  }

  const bus = getEventBus();

  subscriptionIds.push(
    bus.subscribe('SYSTEM_READY', () => {
      handlers.onSystemReady();
    }),
  );

  subscriptionIds.push(
    bus.subscribe('USER_LOGIN', (envelope) => {
      handlers.onUserLogin(parseUserLoginPayload(envelope));
    }),
  );

  subscriptionIds.push(
    bus.subscribe('USER_LOGOUT', (envelope) => {
      handlers.onUserLogout(parseUserLogoutPayload(envelope));
    }),
  );

  subscriptionIds.push(
    bus.subscribe('ROLE_CHANGED', (envelope) => {
      handlers.onRoleChanged(parseRoleChangedPayload(envelope));
    }),
  );

  subscriptionIds.push(
    bus.subscribe('PERMISSION_CHANGED', (envelope) => {
      handlers.onPermissionChanged(parsePermissionChangedPayload(envelope));
    }),
  );

  listenersRegistered = true;
}

export function areSessionEventListenersRegistered(): boolean {
  return listenersRegistered;
}

/** Test-only teardown — not for production portals. */
export function resetSessionEventListenersForTests(): void {
  if (!listenersRegistered) {
    return;
  }

  const bus = getEventBus();
  for (const subscriptionId of subscriptionIds) {
    bus.unsubscribe(subscriptionId);
  }
  subscriptionIds.length = 0;
  listenersRegistered = false;
}
