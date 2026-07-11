/** MOD-002 Session Manager — public API — TICKET-V2-RUNTIME-SESSION-001 */

export { SessionError, isSessionError } from './errors';
export {
  AuthSessionBoundary,
  getAuthSessionBoundary,
  resetAuthSessionBoundaryForTests,
} from './auth-session-boundary';
export {
  asSessionSnapshotWithPermissions,
  clearSession,
  createSession,
  createSessionAuthorizationReader,
  deliverAuthHandoff,
  destroySession,
  detectSessionExpiry,
  expireSession,
  getAuthSessionBoundaryForTests,
  getSessionAuthorizationHeader,
  getSessionAuthorizationState,
  getSessionManager,
  getSessionPermissionResolverInvokeCountForTests,
  getSessionProviderForTests,
  getSessionRegistry,
  getSessionRegistryForTests,
  getSessionSnapshot,
  getSessionState,
  getSessionStoreForTests,
  handleSessionExpiry,
  hasSessionCapability,
  hydrateSession,
  ingestAuthHandle,
  initializeSession,
  refreshSession,
  resetSessionForTests,
  setSessionPermissionFlagsForTests,
  setSessionPermissionProfileForTests,
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
export { SessionProvider, createMockRefreshPort, createNoopRefreshPort } from './session-provider';
export type {
  MockRefreshPortConfig,
  SessionPermissionAttachment,
  SessionSnapshotWithPermissions,
} from './session-provider';
export {
  createInMemoryPersistencePort,
  createNoopPersistencePort,
  PERSISTED_SESSION_RECORD_VERSION,
} from './persistence-port';
export type { PersistedSessionRecord, PersistencePort, RestoreResult } from './persistence-port';
export {
  createLocalStorageAdapter,
  createMemoryStorageAdapter,
  createSessionStorageAdapter,
  SESSION_STORAGE_KEY,
} from './session-storage';
export type { SessionStorageAdapter, SessionStorageBackend } from './session-storage';
export {
  resetSessionRegistryForTests,
  SessionRegistry,
} from './session-registry';
export type { SessionRegistryEntry } from './session-registry';
export type { SessionLifecycleApi } from './session-lifecycle';
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
  AuthHandoffAcceptance,
  AuthHandoffInput,
  AuthHandoffRejection,
  AuthHandoffResult,
  AuthLogoutBoundaryResult,
  AuthLogoutInput,
  AuthProvider,
  HydrationPhase,
  HydrationTrace,
  HydrationTraceStep,
  IdentitySnapshot,
  InitializeSessionOptions,
  SessionAuthorizationNoneReason,
  SessionAuthorizationReaderPort,
  SessionAuthorizationState,
  SessionEmitEventName,
  SessionErrorCode,
  SessionLifecycleState,
  SessionPublicApi,
  SessionRefreshOptions,
  SessionRefreshPort,
  SessionRefreshPortFailure,
  SessionRefreshPortResult,
  SessionRefreshPortSuccess,
  SessionRefreshRequest,
  SessionExpiryProbe,
  SessionSnapshot,
  SessionStateMachineState,
  SessionTransitionEvent,
  SessionTransitionFrom,
  UserLoginEventPayload,
  UserLogoutEventPayload,
  RoleChangedEventPayload,
  PermissionChangedEventPayload,
  UserRef,
  ValidatedAuthHandoff,
} from './types';
