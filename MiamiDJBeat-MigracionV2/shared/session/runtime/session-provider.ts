/** MOD-002 Session Manager — provider — TICKET-MOD-002-SESSION-PROVIDER-STORE-001 */

import { getConfig } from '@mdj/shared/config';
import { normalizeError } from '@mdj/shared/errors';
import { getLogger } from '@mdj/shared/logging';
import { SessionError } from './errors';
import {
  ensureSessionEventListeners,
  publishSessionEvent,
  resetSessionEventListenersForTests,
} from './session-listeners';
import { SessionStore, type SessionStoreConfigSlice } from './session-store';
import type {
  AuthHandle,
  InitializeSessionOptions,
  PermissionChangedEventPayload,
  RoleChangedEventPayload,
  SessionLifecycleState,
  SessionPublicApi,
  SessionSnapshot,
  UserLoginEventPayload,
  UserLogoutEventPayload,
} from './types';

function validateAuthHandle(handle: AuthHandle): void {
  const requiredFields = [
    handle.handoffId,
    handle.userId,
    handle.accessTokenRef,
    handle.expiresAt,
    handle.issuedAt,
  ];

  if (requiredFields.some((value) => value.length === 0)) {
    throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'AuthHandle is missing required fields.');
  }

  const allowedProviders: AuthHandle['provider'][] = ['mock', 'supabase'];
  if (!allowedProviders.includes(handle.provider)) {
    throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'AuthHandle provider is invalid.');
  }

  const expiryMs = Date.parse(handle.expiresAt);
  if (Number.isNaN(expiryMs)) {
    throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'AuthHandle expiresAt is invalid.');
  }

  if (expiryMs <= Date.now()) {
    throw new SessionError('SESSION_ERROR_EXPIRED_HANDLE', 'AuthHandle is expired.');
  }
}

function userLoginPayloadToAuthHandle(payload: UserLoginEventPayload): AuthHandle {
  if (!payload.userId) {
    throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'USER_LOGIN payload is missing userId.');
  }

  return {
    handoffId: payload.handoffId ?? `handoff-${payload.userId}`,
    userId: payload.userId,
    accessTokenRef: payload.accessTokenRef ?? 'mock-access-ref',
    refreshTokenRef: payload.refreshTokenRef,
    expiresAt: payload.expiresAt ?? new Date(Date.now() + 3_600_000).toISOString(),
    provider: payload.provider ?? 'mock',
    issuedAt: payload.issuedAt ?? new Date().toISOString(),
  };
}

/** Orchestrates session lifecycle using SessionStore + state machine + Event Bus. */
export class SessionProvider {
  private readonly store: SessionStore;
  private frozenApi: SessionPublicApi | null = null;
  private logoutInProgress = false;

  constructor(store: SessionStore) {
    this.store = store;
  }

  reset(): void {
    resetSessionEventListenersForTests();
    this.store.reset();
    this.frozenApi = null;
    this.logoutInProgress = false;
  }

  getStore(): SessionStore {
    return this.store;
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
      ingestAuthHandle: (handle: AuthHandle) => this.ingestAuthHandle(handle),
      clearSession: (reason?: string) => this.clearSession(reason),
      destroySession: (reason?: string) => this.destroySession(reason),
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
      this.markReadyAnonymous();
    }
  }

  handleUserLoginEvent(payload: UserLoginEventPayload): void {
    if (!this.frozenApi) {
      return;
    }

    try {
      this.ingestAuthHandle(userLoginPayloadToAuthHandle(payload));
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
      this.clearSession(payload.reason);
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

  /** Boot path — anonymous SESSION_READY (baseline PO 2026-07-06). */
  markReadyAnonymous(): SessionSnapshot {
    this.store.clearIdentity();
    this.store.setHydrationPhase('initial');
    this.store.bumpSnapshotVersion();

    if (this.store.getMachineState() === 'INITIAL') {
      this.store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');
    }

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_OK_NO_USER', 'ANONYMOUS');
    }

    const snapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_READY');

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
    });

    return snapshot;
  }

  ingestAuthHandle(handle: AuthHandle): SessionSnapshot {
    const lifecycle = this.store.getLifecycleState();
    if (lifecycle !== 'SESSION_READY' && lifecycle !== 'SIGNED_OUT' && lifecycle !== 'SESSION_EXPIRED') {
      throw new SessionError('SESSION_ERROR_NOT_READY', 'Session is not ready to ingest AuthHandle.');
    }

    try {
      validateAuthHandle(handle);
    } catch (error) {
      if (error instanceof SessionError && error.code === 'SESSION_ERROR_EXPIRED_HANDLE') {
        this.store.setLifecycleState('SESSION_EXPIRED');
        publishSessionEvent('SESSION_EXPIRED', {
          reason: 'expired',
          sessionId: this.store.getSessionId(),
        });
        normalizeError(error, { moduleId: 'MOD-002' });
        throw error;
      }

      if (error instanceof SessionError) {
        publishSessionEvent('SESSION_ERROR', {
          code: error.code,
          sessionId: this.store.getSessionId(),
        });
      }
      normalizeError(error, { moduleId: 'MOD-002' });
      throw error;
    }

    const machine = this.store.getMachineState();
    if (machine === 'ANONYMOUS' || machine === 'EXPIRED') {
      this.store.applyMachineTransition(machine, 'USER_LOGIN', 'LOADING');
    } else if (machine === 'AUTHENTICATED') {
      this.store.applyMachineTransition('AUTHENTICATED', 'USER_LOGIN', 'LOADING');
    }

    this.store.setUser({ userId: handle.userId });
    this.store.setExpiresAt(handle.expiresAt);
    this.store.setHydrationPhase('signed_in');
    this.store.bumpSnapshotVersion();

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_OK_USER', 'AUTHENTICATED');
    }

    this.store.publishSnapshot(this.configSlice(), 'SIGNED_IN');
    publishSessionEvent('SESSION_CREATED', {
      userId: handle.userId,
      hydrationPhase: 'signed_in',
    });

    const readySnapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_READY');
    publishSessionEvent('SESSION_READY', {
      portal: this.store.getPortal(),
      sessionId: this.store.getSessionId(),
      state: readySnapshot.state,
    });

    getLogger().info('Session signed in via AuthHandle', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      userId: handle.userId,
      hydrationPhase: 'signed_in',
      machineState: this.store.getMachineState(),
    });

    return readySnapshot;
  }

  clearSession(reason = 'clear'): SessionSnapshot {
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
    this.wireEventListeners();
    this.markReadyAnonymous();

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
