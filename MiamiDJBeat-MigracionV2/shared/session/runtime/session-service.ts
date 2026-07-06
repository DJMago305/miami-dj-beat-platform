/** MOD-002 Session Manager — service facade — TICKET-V2-RUNTIME-SESSION-001 */

import { getErrorState } from '@mdj/shared/errors';
import { SessionError } from './errors';
import { SessionProvider } from './session-provider';
import { resetSessionStoreCounterForTests, SessionStore } from './session-store';
import type {
  AuthHandle,
  InitializeSessionOptions,
  SessionLifecycleState,
  SessionPublicApi,
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

export function ingestAuthHandle(handle: AuthHandle): SessionSnapshot {
  return getSessionManager().ingestAuthHandle(handle);
}

export function clearSession(reason?: string): SessionSnapshot {
  return getSessionManager().clearSession(reason);
}

export function destroySession(reason?: string): void {
  getSessionManager().destroySession(reason);
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

/** Test-only reset — not for production portals. */
export function resetSessionForTests(): void {
  sessionProvider.reset();
  resetSessionStoreCounterForTests();
}
