/** MOD-001 Authentication — runtime exports — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

export type { AuthProviderPort } from './auth-provider-port';
export type { AuthPort } from './auth-port';
export type { AuthInitializeOptions } from './auth-port';
export type { SessionHandoffDeliveryInput, SessionHandoffPort } from './session-handoff-port';

export { AuthError, createAuthError, isAuthError } from './errors';
export {
  AUTH_STATE_MACHINE_STATES,
  AUTH_TRANSITION_TABLE,
  assertAuthTransition,
  getAuthEntryState,
  isValidAuthTransition,
} from './state-machine';
export {
  AuthService,
  createAuthService,
  resetAuthHandoffCounterForTests,
  type AuthServiceDependencies,
} from './auth-service';
export {
  MockAuthProvider,
  createMockAuthProvider,
  type MockAuthProviderOptions,
} from './mock-auth-provider';
export type {
  AuthErrorCode,
  AuthIdentityView,
  AuthLifecycleState,
  AuthSnapshot,
  AuthTransitionEvent,
  BuiltAuthHandoff,
  ProviderSignInResult,
  RefreshAuthResult,
  RestoreAuthResult,
  SignInCredentials,
  SignInResult,
  SignOutRequest,
  SignOutResult,
} from './types';

import type { AuthPort } from './auth-port';
import { AuthService, createAuthService, resetAuthHandoffCounterForTests, type AuthServiceDependencies } from './auth-service';
import { getAuthEntryState } from './state-machine';

let defaultAuthService: AuthService | null = null;

export function initializeAuth(deps: AuthServiceDependencies): AuthPort {
  const service = createAuthService(deps);
  defaultAuthService = service;
  return service;
}

export function getAuthService(): AuthPort {
  if (!defaultAuthService) {
    throw new Error('MOD-001 Authentication is not initialized.');
  }
  return defaultAuthService;
}

export function getAuthEntryStateForTests(): ReturnType<typeof getAuthEntryState> {
  return getAuthEntryState();
}

/** Test-only reset — not for production portals. */
export function resetAuthForTests(): void {
  defaultAuthService?.resetForTests();
  defaultAuthService = null;
  resetAuthHandoffCounterForTests();
}
