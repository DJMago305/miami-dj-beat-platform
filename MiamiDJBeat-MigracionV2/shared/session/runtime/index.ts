/** MOD-002 Session Manager — public API — TICKET-V2-RUNTIME-SESSION-001 */

export { SessionError, isSessionError } from './errors';
export {
  clearSession,
  destroySession,
  getSessionManager,
  getSessionProviderForTests,
  getSessionSnapshot,
  getSessionState,
  getSessionStoreForTests,
  ingestAuthHandle,
  initializeSession,
  resetSessionForTests,
} from './session-service';
export {
  areSessionEventListenersRegistered,
  ensureSessionEventListeners,
  parsePermissionChangedPayload,
  parseRoleChangedPayload,
  parseUserLoginPayload,
  parseUserLogoutPayload,
  publishSessionEvent,
  resetSessionEventListenersForTests,
} from './session-listeners';
export type { SessionEventListenerHandlers } from './session-listeners';
export { SessionProvider } from './session-provider';
export {
  createInMemoryPersistencePort,
  createNoopPersistencePort,
  PERSISTED_SESSION_RECORD_VERSION,
} from './persistence-port';
export type { PersistedSessionRecord, PersistencePort, RestoreResult } from './persistence-port';
export { SessionStore, resetSessionStoreCounterForTests } from './session-store';
export type { SessionStoreConfigSlice } from './session-store';
export {
  assertTransition,
  getEntryState,
  isValidTransition,
  listValidTransitionsFrom,
  SESSION_STATE_MACHINE_STATES,
  SESSION_TRANSITION_TABLE,
} from './state-machine';
export type {
  AuthHandle,
  AuthProvider,
  HydrationPhase,
  HydrationTrace,
  HydrationTraceStep,
  InitializeSessionOptions,
  SessionEmitEventName,
  SessionErrorCode,
  SessionLifecycleState,
  SessionPublicApi,
  SessionSnapshot,
  SessionStateMachineState,
  SessionTransitionEvent,
  SessionTransitionFrom,
  UserLoginEventPayload,
  UserLogoutEventPayload,
  RoleChangedEventPayload,
  PermissionChangedEventPayload,
  UserRef,
} from './types';
