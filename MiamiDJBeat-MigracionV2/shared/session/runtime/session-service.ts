/** MOD-002 Session Manager — service facade — TICKET-V2-RUNTIME-SESSION-001 · TICKET-MOD-003-PERMISSION-SESSION-WIRE-001 */

import { getErrorState } from '@mdj/shared/errors';
import { hasCapability, type PermissionPortalId, type ProfileResolveInput, type SnapshotFlags } from '../../permissions/runtime';
import {
  getAuthSessionBoundary,
  resetAuthSessionBoundaryForTests,
} from './auth-session-boundary';
import { SessionError } from './errors';
import {
  SessionProvider,
  type SessionSnapshotWithPermissions,
} from './session-provider';
import { resetSessionStoreCounterForTests, SessionStore } from './session-store';
import {
  getSessionRegistry,
  resetSessionRegistryForTests,
} from './session-registry';
import type {
  AuthHandle,
  AuthHandoffInput,
  IdentitySnapshot,
  InitializeSessionOptions,
  SessionAuthorizationNoneReason,
  SessionAuthorizationReaderPort,
  SessionAuthorizationState,
  SessionExpiryProbe,
  SessionLifecycleState,
  SessionPublicApi,
  SessionRefreshOptions,
  SessionSnapshot,
} from './types';

const sessionStore = new SessionStore();
const sessionProvider = new SessionProvider(sessionStore);

/** Requires ERR_READY — boot order ends at Session. */
export function initializeSession(options: InitializeSessionOptions): SessionPublicApi {
  if (getErrorState() !== 'ERR_READY') {
    throw new SessionError('SESSION_ERROR_NOT_READY', 'Error Handler must be ERR_READY before Session initialization.');
  }

  return sessionProvider.initialize(options);
}

export function getSessionState(): SessionLifecycleState {
  return sessionProvider.getLifecycleState();
}

export function getSessionSnapshot(): SessionSnapshot {
  return getSessionManager().getSnapshot();
}

/** MOD-005 composition root — opaque Authorization header from Session slot (no Event Bus). */
export function getSessionAuthorizationHeader(): string | null {
  return sessionStore.resolveAuthorizationHeader();
}

export function getSessionAuthorizationState(): SessionAuthorizationState {
  const header = sessionStore.resolveAuthorizationHeader();
  const userId = sessionStore.getCurrentUser()?.userId;
  const machine = sessionStore.getMachineState();

  if (header && userId) {
    return Object.freeze({
      kind: 'ready',
      authorizationHeader: header,
      credentialVersion: sessionStore.getCredentialVersion(),
      userId,
      isRefreshing: sessionStore.isRefreshingCredential(),
    });
  }

  let reason: SessionAuthorizationNoneReason = 'anonymous';
  if (machine === 'EXPIRED') {
    reason = 'expired';
  } else if (machine === 'DESTROYED') {
    reason = 'destroyed';
  } else if (machine === 'ERROR') {
    reason = 'error';
  } else if (sessionStore.getBoundUserId() && userId && sessionStore.getBoundUserId() !== userId) {
    reason = 'unbound';
  } else if (!sessionStore.getAccessTokenRef() && userId) {
    reason = 'cleared';
  }

  return Object.freeze({ kind: 'none', reason });
}

export function createSessionAuthorizationReader(): SessionAuthorizationReaderPort {
  return Object.freeze({
    getAuthorizationHeader: () => getSessionAuthorizationHeader(),
    getAuthorizationState: () => getSessionAuthorizationState(),
  });
}

export function asSessionSnapshotWithPermissions(
  snapshot: SessionSnapshot,
): SessionSnapshotWithPermissions {
  return snapshot as SessionSnapshotWithPermissions;
}

export function hasSessionCapability(
  capabilityId: string,
  portal?: PermissionPortalId,
): boolean {
  const snapshot = asSessionSnapshotWithPermissions(getSessionSnapshot());
  if (!snapshot.permissions) {
    return false;
  }

  return hasCapability(snapshot.permissions, capabilityId, portal);
}

export function setSessionPermissionProfileForTests(profile: ProfileResolveInput): void {
  sessionProvider.setPermissionProfileForTests(profile);
}

export function setSessionPermissionFlagsForTests(flags: SnapshotFlags): void {
  sessionProvider.setPermissionFlagsForTests(flags);
}

export function getSessionPermissionResolverInvokeCountForTests(): number {
  return sessionProvider.getPermissionResolverInvokeCountForTests();
}

export function ingestAuthHandle(handle: AuthHandle, identity?: IdentitySnapshot): SessionSnapshot {
  return getSessionManager().ingestAuthHandle(handle, identity);
}

/** MOD-001 → MOD-002 handoff entry — contract facade for Auth module. */
export function deliverAuthHandoff(input: AuthHandoffInput): SessionSnapshot {
  return ingestAuthHandle(input.handle, input.identity);
}

export function clearSession(reason?: string): SessionSnapshot {
  return getSessionManager().clearSession(reason);
}

export function destroySession(reason?: string): void {
  getSessionManager().destroySession(reason);
}

export function refreshSession(options?: SessionRefreshOptions): Promise<SessionSnapshot> {
  return getSessionManager().refreshSession(options);
}

export function detectSessionExpiry(): SessionExpiryProbe {
  return sessionProvider.detectSessionExpiry();
}

export function handleSessionExpiry(reason?: string): SessionSnapshot {
  return sessionProvider.handleSessionExpiry(reason);
}

/** Lifecycle facade — explicit expiry transition. */
export function expireSession(reason?: string): SessionSnapshot {
  return sessionProvider.expireSession(reason);
}

/** Lifecycle facade — create session identity without hydration. */
export function createSession(options: InitializeSessionOptions): SessionPublicApi {
  if (getErrorState() !== 'ERR_READY') {
    throw new SessionError('SESSION_ERROR_NOT_READY', 'Error Handler must be ERR_READY before Session creation.');
  }
  return sessionProvider.createSession(options);
}

/** Lifecycle facade — restore and validate persisted session state. */
export function hydrateSession(): SessionSnapshot {
  return sessionProvider.hydrateSession();
}

export function getSessionManager(): SessionPublicApi {
  return sessionProvider.getPublicApi();
}

/** Internal access for unit tests — not part of portal boot API. */
export function getSessionProviderForTests(): SessionProvider {
  return sessionProvider;
}

/** Internal access for unit tests — not part of portal boot API. */
export function getSessionStoreForTests(): SessionStore {
  return sessionStore;
}

export function getSessionRegistryForTests() {
  return getSessionRegistry();
}

export { getSessionRegistry } from './session-registry';

export function getAuthSessionBoundaryForTests() {
  return getAuthSessionBoundary();
}

/** Test-only reset — not for production portals. */
export function resetSessionForTests(): void {
  sessionProvider.reset();
  resetSessionStoreCounterForTests();
  resetSessionRegistryForTests();
  resetAuthSessionBoundaryForTests();
}
