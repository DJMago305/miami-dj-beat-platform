/** MOD-002 Session Manager — provider — TICKET-MOD-002-SESSION-PROVIDER-STORE-001 */

import { getConfig } from '@mdj/shared/config';
import { normalizeError } from '@mdj/shared/errors';
import { getLogger } from '@mdj/shared/logging';
import { SessionError } from './errors';
import {
  AuthSessionBoundary,
  getAuthSessionBoundary,
} from './auth-session-boundary';
import {
  createNoopPersistencePort,
  PERSISTED_SESSION_RECORD_VERSION,
  type PersistedSessionRecord,
  type PersistencePort,
  type RestoreResult,
} from './persistence-port';
import {
  ensureSessionEventListeners,
  publishSessionEvent,
  resetSessionEventListenersForTests,
} from './session-listeners';
import { SessionStore, type SessionStoreConfigSlice } from './session-store';
import type {
  AuthHandle,
  IdentitySnapshot,
  InitializeSessionOptions,
  PermissionChangedEventPayload,
  RoleChangedEventPayload,
  SessionExpiryProbe,
  SessionLifecycleState,
  SessionPublicApi,
  SessionRefreshOptions,
  SessionRefreshPort,
  SessionRefreshPortResult,
  SessionRefreshRequest,
  SessionSnapshot,
  UserLoginEventPayload,
  UserLogoutEventPayload,
} from './types';

export type MockRefreshPortConfig = {
  readonly fail?: boolean;
  readonly delayMs?: number;
  readonly failReason?: string;
  readonly newExpiresAt?: () => string;
};

/** Default boot port — synchronous mock refresh success. */
export function createNoopRefreshPort(): SessionRefreshPort {
  return createMockRefreshPort();
}

/** Lab/test refresh port — optional delay for single-flight assertions. */
export function createMockRefreshPort(config: MockRefreshPortConfig = {}): SessionRefreshPort {
  return {
    refresh: (request: SessionRefreshRequest) => {
      const execute = (): SessionRefreshPortResult => {
        if (config.fail) {
          return Object.freeze({
            ok: false,
            reason: config.failReason ?? 'mock-refresh-failed',
          });
        }

        return Object.freeze({
          ok: true,
          expiresAt: config.newExpiresAt?.() ?? new Date(Date.now() + 3_600_000).toISOString(),
          accessTokenRef: request.accessTokenRef,
        });
      };

      if (config.delayMs && config.delayMs > 0) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(execute()), config.delayMs);
        });
      }

      return execute();
    },
  };
}

function unwrapRefreshResult(
  result: SessionRefreshPortResult | Promise<SessionRefreshPortResult>,
): SessionRefreshPortResult | Promise<SessionRefreshPortResult> {
  return result;
}

async function resolveRefreshResult(
  result: SessionRefreshPortResult | Promise<SessionRefreshPortResult>,
): Promise<SessionRefreshPortResult> {
  return result instanceof Promise ? result : result;
}

function unwrapRestoreResult(result: RestoreResult | Promise<RestoreResult>): RestoreResult {
  if (result instanceof Promise) {
    throw new SessionError(
      'SESSION_ERROR_NOT_READY',
      'PersistencePort.restore() must be synchronous during boot hydration.',
    );
  }
  return result;
}

function isExpiredIsoTimestamp(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const expiryMs = Date.parse(value);
  return Number.isNaN(expiryMs) || expiryMs <= Date.now();
}

/** Orchestrates session lifecycle using SessionStore + state machine + Event Bus. */
export class SessionProvider {
  private readonly store: SessionStore;
  private readonly persistencePort: PersistencePort;
  private readonly authBoundary: AuthSessionBoundary;
  private readonly refreshPort: SessionRefreshPort;
  private frozenApi: SessionPublicApi | null = null;
  private logoutInProgress = false;
  private refreshInFlight: Promise<SessionSnapshot> | null = null;

  constructor(
    store: SessionStore,
    persistencePort: PersistencePort = createNoopPersistencePort(),
    authBoundary: AuthSessionBoundary = getAuthSessionBoundary(),
    refreshPort: SessionRefreshPort = createNoopRefreshPort(),
  ) {
    this.store = store;
    this.persistencePort = persistencePort;
    this.authBoundary = authBoundary;
    this.refreshPort = refreshPort;
  }

  reset(): void {
    resetSessionEventListenersForTests();
    this.store.reset();
    this.frozenApi = null;
    this.logoutInProgress = false;
    this.refreshInFlight = null;
  }

  getStore(): SessionStore {
    return this.store;
  }

  getPersistencePort(): PersistencePort {
    return this.persistencePort;
  }

  getAuthBoundary(): AuthSessionBoundary {
    return this.authBoundary;
  }

  getRefreshPort(): SessionRefreshPort {
    return this.refreshPort;
  }

  private configSlice(): SessionStoreConfigSlice {
    const config = getConfig();
    return {
      locale: config.i18n.defaultLocale,
      theme: config.theme.defaultMode,
      featureFlags: {
        eventBus: config.features.eventBus,
        strictConfig: config.features.strictConfig,
        debugPanel: config.features.debugPanel,
      },
    };
  }

  private buildPublicApi(): SessionPublicApi {
    return Object.freeze({
      ingestAuthHandle: (handle: AuthHandle, identity?: IdentitySnapshot) =>
        this.ingestAuthHandle(handle, identity),
      clearSession: (reason?: string) => this.clearSession(reason),
      destroySession: (reason?: string) => this.destroySession(reason),
      refreshSession: (options?: SessionRefreshOptions) => this.refreshSession(options),
      getSnapshot: () => {
        try {
          return this.store.getSnapshot();
        } catch {
          throw new SessionError('SESSION_ERROR_NOT_READY', 'Session snapshot is not available.');
        }
      },
      getState: () => this.store.getLifecycleState(),
    });
  }

  private wireEventListeners(): void {
    ensureSessionEventListeners({
      onSystemReady: () => this.handleSystemReadyEvent(),
      onUserLogin: (payload) => this.handleUserLoginEvent(payload),
      onUserLogout: (payload) => this.handleUserLogoutEvent(payload),
      onRoleChanged: (payload) => this.handleRoleChangedEvent(payload),
      onPermissionChanged: (payload) => this.handlePermissionChangedEvent(payload),
    });
  }

  /** Idempotent — no duplicate boot when initializeSession() already completed. */
  handleSystemReadyEvent(): void {
    if (this.store.getLifecycleState() === 'SESSION_READY' && this.frozenApi) {
      return;
    }

    if (!this.frozenApi) {
      return;
    }

    if (this.store.getMachineState() === 'INITIAL') {
      this.runHydrationRestore();
    }
  }

  handleUserLoginEvent(payload: UserLoginEventPayload): void {
    if (!this.frozenApi) {
      return;
    }

    try {
      const handle = this.authBoundary.buildAuthHandleFromUserLogin(payload);
      this.ingestAuthHandle(handle);
    } catch (error) {
      if (error instanceof SessionError) {
        publishSessionEvent('SESSION_ERROR', {
          code: error.code,
          sessionId: this.store.getSessionId(),
        });
      }
      throw error;
    }
  }

  handleUserLogoutEvent(payload: UserLogoutEventPayload): void {
    if (!this.frozenApi || this.logoutInProgress) {
      return;
    }

    this.logoutInProgress = true;
    try {
      const logout = this.authBoundary.normalizeLogout(payload);
      this.clearSession(logout.reason);
    } finally {
      this.logoutInProgress = false;
    }
  }

  handleRoleChangedEvent(payload: RoleChangedEventPayload): void {
    if (!this.frozenApi || !payload.userId) {
      return;
    }

    const snapshot = this.store.getSnapshot();
    if (snapshot.user?.userId && snapshot.user.userId !== payload.userId) {
      return;
    }

    this.store.bumpSnapshotVersion();
    this.republishReadySnapshot('role-changed');
  }

  handlePermissionChangedEvent(payload: PermissionChangedEventPayload): void {
    if (!this.frozenApi || !payload.userId) {
      return;
    }

    const snapshot = this.store.getSnapshot();
    if (snapshot.user?.userId && snapshot.user.userId !== payload.userId) {
      return;
    }

    const machine = this.store.getMachineState();
    if (machine === 'AUTHENTICATED') {
      this.store.applyMachineTransition('AUTHENTICATED', 'PERMISSION_CHANGED', 'AUTHENTICATED');
    } else if (machine === 'ANONYMOUS') {
      this.store.applyMachineTransition('ANONYMOUS', 'PERMISSION_CHANGED', 'ANONYMOUS');
    }

    this.store.bumpSnapshotVersion();
    this.republishReadySnapshot('permission-changed');
  }

  private republishReadySnapshot(reason: string): void {
    const lifecycle = this.store.getLifecycleState();
    if (lifecycle !== 'SESSION_READY' && lifecycle !== 'SIGNED_IN') {
      return;
    }

    const readyLifecycle: SessionLifecycleState = 'SESSION_READY';
    const snapshot = this.store.publishSnapshot(this.configSlice(), readyLifecycle);
    publishSessionEvent('SESSION_READY', {
      portal: snapshot.portal,
      sessionId: snapshot.sessionId,
      state: snapshot.state,
      reason,
    });
  }

  /** Boot path — anonymous SESSION_READY (baseline PO 2026-07-06). Skips persistence restore. */
  markReadyAnonymous(): SessionSnapshot {
    return this.completeAnonymousReady();
  }

  /** Boot hydration — restore from PersistencePort then validate (Phase 4). */
  runHydrationRestore(): SessionSnapshot {
    this.store.beginHydrationTrace();
    this.store.appendHydrationTraceStep('boot_started');
    this.store.setHydrationPhase('initial');

    if (this.store.getMachineState() === 'INITIAL') {
      this.store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');
    }

    this.store.appendHydrationTraceStep('restore_begin');
    const restoreResult = unwrapRestoreResult(this.persistencePort.restore());

    if (!restoreResult.found || !restoreResult.record) {
      return this.completeAnonymousReady({ restoreReason: 'restore_empty' });
    }

    return this.applyRestoredRecord(restoreResult.record);
  }

  private completeAnonymousReady(options?: {
    restoreReason?: 'restore_empty' | 'restore_expired' | 'restore_invalid';
    validateEvent?: 'VALIDATE_OK_NO_USER' | 'VALIDATE_FAIL_RECOVERABLE';
  }): SessionSnapshot {
    const tracing = Boolean(options?.restoreReason);

    if (options?.restoreReason) {
      this.store.appendHydrationTraceStep(options.restoreReason);
    }

    this.store.clearIdentity();
    this.store.setHydrationPhase('initial');
    this.store.bumpSnapshotVersion();

    const machine = this.store.getMachineState();
    if (machine === 'INITIAL') {
      this.store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');
    }

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition(
        'LOADING',
        options?.validateEvent ?? 'VALIDATE_OK_NO_USER',
        'ANONYMOUS',
      );
    }

    if (tracing) {
      this.store.appendHydrationTraceStep('validate_anonymous');
    }

    const snapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_READY');

    if (tracing) {
      this.store.appendHydrationTraceStep('ready');
      this.store.completeHydrationTrace();
    }

    publishSessionEvent('SESSION_CREATED', {
      userId: 'anonymous',
      hydrationPhase: 'initial',
    });
    publishSessionEvent('SESSION_READY', {
      portal: this.store.getPortal(),
      sessionId: this.store.getSessionId(),
      state: snapshot.state,
    });

    getLogger().info('Session ready (anonymous)', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      portal: this.store.getPortal(),
      state: snapshot.state,
      machineState: this.store.getMachineState(),
      hydrationTrace: this.store.getHydrationTrace()?.steps,
    });

    return snapshot;
  }

  private applyRestoredRecord(record: PersistedSessionRecord): SessionSnapshot {
    if (record.recordVersion !== PERSISTED_SESSION_RECORD_VERSION) {
      return this.completeAnonymousReady({
        restoreReason: 'restore_invalid',
        validateEvent: 'VALIDATE_FAIL_RECOVERABLE',
      });
    }

    if (isExpiredIsoTimestamp(record.expiresAt)) {
      return this.completeAnonymousReady({
        restoreReason: 'restore_expired',
        validateEvent: 'VALIDATE_FAIL_RECOVERABLE',
      });
    }

    const userId = record.userId?.trim();
    if (!userId) {
      return this.completeAnonymousReady({ restoreReason: 'restore_empty' });
    }

    this.store.appendHydrationTraceStep('restore_found');
    this.store.setUser({
      userId,
      email: record.email,
      mdjbId: record.mdjbId,
    });
    this.store.setExpiresAt(record.expiresAt ?? null);
    this.store.setHydrationPhase('initial');
    this.store.bumpSnapshotVersion();

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_OK_USER', 'AUTHENTICATED');
    }

    this.store.appendHydrationTraceStep('validate_authenticated');
    this.store.publishSnapshot(this.configSlice(), 'SIGNED_IN');
    publishSessionEvent('SESSION_CREATED', {
      userId,
      hydrationPhase: 'initial',
    });

    const readySnapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_READY');
    this.store.appendHydrationTraceStep('ready');
    this.store.completeHydrationTrace();

    publishSessionEvent('SESSION_READY', {
      portal: this.store.getPortal(),
      sessionId: this.store.getSessionId(),
      state: readySnapshot.state,
    });

    getLogger().info('Session restored from persistence', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      userId,
      hydrationPhase: 'initial',
      machineState: this.store.getMachineState(),
      hydrationTrace: this.store.getHydrationTrace()?.steps,
    });

    return readySnapshot;
  }

  ingestAuthHandle(handle: AuthHandle, identity?: IdentitySnapshot): SessionSnapshot {
    const lifecycle = this.store.getLifecycleState();
    if (lifecycle !== 'SESSION_READY' && lifecycle !== 'SIGNED_OUT' && lifecycle !== 'SESSION_EXPIRED') {
      throw new SessionError('SESSION_ERROR_NOT_READY', 'Session is not ready to ingest AuthHandle.');
    }

    let validated;
    try {
      validated = this.authBoundary.validateAuthHandoff({ handle, identity });
    } catch (error) {
      if (error instanceof SessionError && error.code === 'SESSION_ERROR_EXPIRED_HANDLE') {
        this.store.setLifecycleState('SESSION_EXPIRED');
        publishSessionEvent('SESSION_EXPIRED', {
          reason: 'expired',
          sessionId: this.store.getSessionId(),
          handoffId: handle.handoffId,
        });
        normalizeError(error, { moduleId: 'MOD-002' });
        throw error;
      }

      if (error instanceof SessionError) {
        publishSessionEvent('SESSION_ERROR', {
          code: error.code,
          sessionId: this.store.getSessionId(),
          handoffId: handle.handoffId,
        });
      }
      normalizeError(error, { moduleId: 'MOD-002' });
      throw error;
    }

    const acceptedHandle = validated.handle;
    const machine = this.store.getMachineState();
    if (machine === 'ANONYMOUS' || machine === 'EXPIRED') {
      this.store.applyMachineTransition(machine, 'USER_LOGIN', 'LOADING');
    } else if (machine === 'AUTHENTICATED') {
      this.store.applyMachineTransition('AUTHENTICATED', 'USER_LOGIN', 'LOADING');
    }

    this.store.setUser(validated.userRef);
    this.store.setExpiresAt(acceptedHandle.expiresAt);
    this.store.setHydrationPhase(validated.hydrationPhase);
    this.store.bumpSnapshotVersion();

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_OK_USER', 'AUTHENTICATED');
    }

    this.store.publishSnapshot(this.configSlice(), 'SIGNED_IN');
    publishSessionEvent('SESSION_CREATED', {
      userId: validated.userRef.userId,
      hydrationPhase: validated.hydrationPhase,
      handoffId: acceptedHandle.handoffId,
    });

    const readySnapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_READY');
    publishSessionEvent('SESSION_READY', {
      portal: this.store.getPortal(),
      sessionId: this.store.getSessionId(),
      state: readySnapshot.state,
      handoffId: acceptedHandle.handoffId,
    });

    getLogger().info('Session signed in via AuthHandle handoff', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      userId: validated.userRef.userId,
      handoffId: acceptedHandle.handoffId,
      hydrationPhase: validated.hydrationPhase,
      machineState: this.store.getMachineState(),
    });

    return readySnapshot;
  }

  detectSessionExpiry(): SessionExpiryProbe {
    try {
      const snapshot = this.store.getSnapshot();
      const expired =
        snapshot.user !== null &&
        snapshot.expiresAt !== null &&
        isExpiredIsoTimestamp(snapshot.expiresAt);

      return Object.freeze({
        expired,
        expiresAt: snapshot.expiresAt,
        sessionId: snapshot.sessionId,
      });
    } catch {
      return Object.freeze({
        expired: false,
        expiresAt: null,
        sessionId: '',
      });
    }
  }

  handleSessionExpiry(reason = 'expiry-detected'): SessionSnapshot {
    if (!this.frozenApi) {
      throw new SessionError('SESSION_ERROR_NOT_READY', 'Session is not initialized.');
    }

    const machine = this.store.getMachineState();
    if (machine === 'AUTHENTICATED') {
      this.store.applyMachineTransition('AUTHENTICATED', 'EXPIRY_DETECTED', 'EXPIRED');
    }

    this.store.setRefreshing(false);
    this.store.setLifecycleState('SESSION_EXPIRED');
    this.store.bumpSnapshotVersion();

    const snapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_EXPIRED');
    publishSessionEvent('SESSION_EXPIRED', {
      reason,
      sessionId: this.store.getSessionId(),
    });

    getLogger().info('Session expired', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      reason,
      machineState: this.store.getMachineState(),
    });

    return snapshot;
  }

  /** Single-flight refresh — concurrent callers await the same in-flight operation. */
  refreshSession(options?: SessionRefreshOptions): Promise<SessionSnapshot> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.executeRefreshSession(options).finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  private async executeRefreshSession(options?: SessionRefreshOptions): Promise<SessionSnapshot> {
    if (!this.frozenApi) {
      throw new SessionError('SESSION_ERROR_NOT_READY', 'Session is not initialized.');
    }

    const machine = this.store.getMachineState();
    if (machine !== 'AUTHENTICATED') {
      throw new SessionError(
        'SESSION_ERROR_NOT_READY',
        'Session refresh requires AUTHENTICATED machine state.',
      );
    }

    const snapshot = this.store.getSnapshot();
    if (!snapshot.user) {
      throw new SessionError('SESSION_ERROR_NOT_READY', 'Session refresh requires an authenticated user.');
    }

    this.store.applyMachineTransition('AUTHENTICATED', 'REFRESH_START', 'REFRESHING');
    this.store.setRefreshing(true);
    this.store.bumpSnapshotVersion();
    this.store.publishSnapshot(this.configSlice(), 'SESSION_READY');

    const refreshResult = await resolveRefreshResult(
      unwrapRefreshResult(
        this.refreshPort.refresh({
          sessionId: this.store.getSessionId(),
          userId: snapshot.user.userId,
          accessTokenRef: options?.accessTokenRef ?? 'mock-access-ref',
          expiresAt: snapshot.expiresAt,
        }),
      ),
    );

    if (!refreshResult.ok) {
      return this.finalizeRefreshFailure(refreshResult.reason, options?.reason);
    }

    return this.finalizeRefreshSuccess(refreshResult.expiresAt, options?.reason);
  }

  private finalizeRefreshSuccess(expiresAt: string, reason?: string): SessionSnapshot {
    if (this.store.getMachineState() === 'REFRESHING') {
      this.store.applyMachineTransition('REFRESHING', 'REFRESH_OK', 'AUTHENTICATED');
    }

    this.store.setExpiresAt(expiresAt);
    this.store.setRefreshing(false);
    this.store.bumpSnapshotVersion();

    const readySnapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_READY');
    publishSessionEvent('SESSION_READY', {
      portal: readySnapshot.portal,
      sessionId: readySnapshot.sessionId,
      state: readySnapshot.state,
      reason: reason ?? 'refresh-ok',
    });

    getLogger().info('Session refresh succeeded', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      expiresAt,
      machineState: this.store.getMachineState(),
    });

    return readySnapshot;
  }

  private finalizeRefreshFailure(failReason: string, triggerReason?: string): SessionSnapshot {
    if (this.store.getMachineState() === 'REFRESHING') {
      this.store.applyMachineTransition('REFRESHING', 'REFRESH_FAIL', 'EXPIRED');
    }

    this.store.setRefreshing(false);
    this.store.setLifecycleState('SESSION_EXPIRED');
    this.store.bumpSnapshotVersion();

    const expiredSnapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_EXPIRED');
    publishSessionEvent('SESSION_EXPIRED', {
      reason: triggerReason ?? failReason,
      sessionId: this.store.getSessionId(),
    });

    getLogger().info('Session refresh failed — expired', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      reason: triggerReason ?? failReason,
      machineState: this.store.getMachineState(),
    });

    return expiredSnapshot;
  }

  clearSession(reason = 'clear'): SessionSnapshot {
    this.refreshInFlight = null;
    this.store.clearIdentity();
    this.store.setHydrationPhase('none');
    this.store.bumpSnapshotVersion();

    this.store.publishSnapshot(this.configSlice(), 'SIGNED_OUT');

    getLogger().info('Session cleared', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      reason,
    });

    return this.rebootstrapAnonymousMachine(reason);
  }

  destroySession(reason = 'destroy'): void {
    publishSessionEvent('SESSION_DESTROYED', {
      reason,
      sessionId: this.store.getSessionId(),
    });
    this.store.invalidateSnapshot();
    this.frozenApi = null;

    getLogger().info('Session destroyed', {
      moduleId: 'MOD-002',
      reason,
    });
  }

  initialize(options: InitializeSessionOptions): SessionPublicApi {
    if (this.store.getLifecycleState() === 'SESSION_READY' && this.frozenApi) {
      this.wireEventListeners();
      return this.frozenApi;
    }

    this.store.beginSession(options.portal);

    getLogger().info('Session initialization started', {
      moduleId: 'MOD-002',
      portal: options.portal,
      state: this.store.getLifecycleState(),
      machineState: this.store.getMachineState(),
    });

    this.frozenApi = this.buildPublicApi();
    this.runHydrationRestore();
    this.wireEventListeners();

    return this.frozenApi;
  }

  getPublicApi(): SessionPublicApi {
    if (!this.frozenApi || this.store.getLifecycleState() === 'SESSION_UNINITIALIZED') {
      throw new SessionError(
        'SESSION_ERROR_NOT_READY',
        'Session is not initialized. Call initializeSession() during boot.',
      );
    }
    return this.frozenApi;
  }

  getLifecycleState(): SessionLifecycleState {
    return this.store.getLifecycleState();
  }

  private rebootstrapAnonymousMachine(reason: string): SessionSnapshot {
    const machine = this.store.getMachineState();

    if (machine === 'AUTHENTICATED' || machine === 'ANONYMOUS' || machine === 'EXPIRED') {
      this.store.applyMachineTransition(machine, 'USER_LOGOUT', 'LOGGING_OUT');
      this.store.applyMachineTransition('LOGGING_OUT', 'TEARDOWN_COMPLETE', 'DESTROYED');
      publishSessionEvent('SESSION_DESTROYED', {
        reason,
        sessionId: this.store.getSessionId(),
      });
      this.store.applyMachineTransition('DESTROYED', 'NEW_BOOT_CYCLE', 'INITIAL');
      this.store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');
    }

    return this.markReadyAnonymous();
  }
}

export { resetSessionEventListenersForTests };
