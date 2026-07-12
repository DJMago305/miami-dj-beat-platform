/** MOD-002 Session Manager — provider — TICKET-MOD-002-SESSION-PROVIDER-STORE-001 · TICKET-MOD-003-PERMISSION-SESSION-WIRE-001 */

import { getConfig, type PortalId } from '@mdj/shared/config';
import { normalizeError } from '@mdj/shared/errors';
import { getLogger } from '@mdj/shared/logging';
import {
  resolvePermissionSnapshot,
  type PermissionPortalId,
  type PermissionSnapshot,
  type ProfileResolveInput,
  type SnapshotFlags,
} from '../../permissions/runtime';
import type { AccessPermissionResolutionFailure } from '../../services/access-permissions';
import type {
  AccessPermissionResolutionPort,
  PermissionsResolutionPhase,
} from './access-permission-resolution-port';
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
import { getSessionRegistry } from './session-registry';
import { SessionStore, type SessionStoreConfigSlice } from './session-store';
import type {
  AuthHandle,
  IdentitySnapshot,
  InitializeSessionOptions,
  PermissionChangedEventPayload,
  RoleChangedEventPayload,
  SessionAuthOutcome,
  SessionExpiryProbe,
  SessionLifecycleState,
  SessionPublicApi,
  SessionRefreshOptions,
  SessionRefreshPort,
  SessionRefreshPortResult,
  SessionRefreshPortSuccess,
  SessionRefreshRequest,
  SessionSnapshot,
  SessionErrorCode,
  UserLoginEventPayload,
  UserLogoutEventPayload,
} from './types';

export type SessionPermissionAttachment = {
  readonly permissions: PermissionSnapshot;
  readonly permissionVersion: number;
  readonly resolvedAt: string;
  readonly capabilityCount: number;
};

export type SessionSnapshotWithPermissions = SessionSnapshot & SessionPermissionAttachment;

type LastValidPermissionIdentity = {
  readonly userId: string;
  readonly sessionId: string;
  readonly portal: PortalId;
};

type PermissionResolutionTrigger = 'auth-handoff' | 'restore';

function toPermissionPortal(portal: SessionSnapshot['portal']): PermissionPortalId {
  return portal;
}

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
  private enrichedSnapshot: SessionSnapshotWithPermissions | null = null;
  private permissionProfile: ProfileResolveInput = { kind: 'guest' };
  private permissionFlags: SnapshotFlags = {};
  private permissionResolverInvokeCount = 0;
  private fatalErrorEmitted = false;
  private accessPermissionResolutionPort: AccessPermissionResolutionPort | null = null;
  private permissionsResolutionPhase: PermissionsResolutionPhase = 'idle';
  private permissionsResolveInFlight: Promise<SessionSnapshot> | null = null;
  private permissionsResolveInFlightGeneration: number | null = null;
  private sessionPermissionGeneration = 0;
  private permissionResolutionAbortController: AbortController | null = null;
  private lastValidPermissionProfile: ProfileResolveInput | null = null;
  private lastValidPermissionFlags: SnapshotFlags = {};
  private lastValidPermissionSnapshot: PermissionSnapshot | null = null;
  private lastValidPermissionIdentity: LastValidPermissionIdentity | null = null;
  private lastPermissionResolutionFailure: AccessPermissionResolutionFailure | null = null;
  private sessionAuthOutcomeInFlight: Promise<SessionSnapshot> | null = null;

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
    getSessionRegistry().clear();
    this.frozenApi = null;
    this.logoutInProgress = false;
    this.refreshInFlight = null;
    this.enrichedSnapshot = null;
    this.permissionProfile = { kind: 'guest' };
    this.permissionFlags = {};
    this.permissionResolverInvokeCount = 0;
    this.fatalErrorEmitted = false;
    this.invalidatePermissionResolutionState(false);
    this.accessPermissionResolutionPort = null;
  }

  setAccessPermissionResolutionPort(port: AccessPermissionResolutionPort | null): void {
    this.accessPermissionResolutionPort = port;
  }

  getPermissionsResolutionPhaseForTests(): PermissionsResolutionPhase {
    return this.permissionsResolutionPhase;
  }

  private invalidatePermissionResolutionState(bumpGeneration: boolean): void {
    if (bumpGeneration) {
      this.sessionPermissionGeneration += 1;
    }
    this.permissionResolutionAbortController?.abort();
    this.permissionResolutionAbortController = null;
    this.permissionsResolveInFlight = null;
    this.permissionsResolveInFlightGeneration = null;
    this.permissionsResolutionPhase = 'idle';
    this.clearLastValidPermissionCache();
    this.lastPermissionResolutionFailure = null;
    this.sessionAuthOutcomeInFlight = null;
  }

  private clearLastValidPermissionCache(): void {
    this.lastValidPermissionProfile = null;
    this.lastValidPermissionFlags = {};
    this.lastValidPermissionSnapshot = null;
    this.lastValidPermissionIdentity = null;
  }

  private buildPermissionIdentity(userId: string): LastValidPermissionIdentity {
    return Object.freeze({
      userId,
      sessionId: this.store.getSessionId(),
      portal: this.store.getPortal(),
    });
  }

  private matchesPermissionIdentity(
    left: LastValidPermissionIdentity,
    right: LastValidPermissionIdentity,
  ): boolean {
    return (
      left.userId === right.userId &&
      left.sessionId === right.sessionId &&
      left.portal === right.portal
    );
  }

  private invalidateLastValidUnlessSameIdentity(identity: LastValidPermissionIdentity): void {
    if (!this.lastValidPermissionIdentity) {
      return;
    }

    if (!this.matchesPermissionIdentity(this.lastValidPermissionIdentity, identity)) {
      this.clearLastValidPermissionCache();
    }
  }

  private cloneProfileResolveInput(profile: ProfileResolveInput): ProfileResolveInput {
    return Object.freeze({ ...profile });
  }

  private clonePermissionSnapshot(snapshot: PermissionSnapshot): PermissionSnapshot {
    return Object.freeze({
      ...snapshot,
      capabilities: Object.freeze([...snapshot.capabilities]),
      flags: Object.freeze({ ...snapshot.flags }),
      profile: Object.freeze({ ...snapshot.profile }),
    });
  }

  private trackSessionAuthOutcome(outcome: SessionAuthOutcome): Promise<SessionSnapshot> {
    const tracked = outcome instanceof Promise ? outcome : Promise.resolve(outcome);
    if (outcome instanceof Promise) {
      this.sessionAuthOutcomeInFlight = tracked;
      tracked.finally(() => {
        if (this.sessionAuthOutcomeInFlight === tracked) {
          this.sessionAuthOutcomeInFlight = null;
        }
      });
    }
    return tracked;
  }

  private commitSessionAuthOutcome(outcome: SessionAuthOutcome): void {
    const tracked = this.trackSessionAuthOutcome(outcome);
    if (outcome instanceof Promise) {
      tracked.catch((error) => this.handleSessionAuthOutcomeError(error));
    }
  }

  private handleSessionAuthOutcomeError(error: unknown): void {
    if (error instanceof SessionError) {
      publishSessionEvent('SESSION_ERROR', {
        code: error.code,
        sessionId: this.store.getSessionId(),
      });
    }
    getLogger().info('Session auth outcome rejected', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  getSessionAuthOutcomeInFlightForTests(): Promise<SessionSnapshot> | null {
    return this.sessionAuthOutcomeInFlight;
  }

  getLastPermissionResolutionFailureForTests(): AccessPermissionResolutionFailure | null {
    return this.lastPermissionResolutionFailure;
  }

  getLastValidPermissionIdentityForTests(): LastValidPermissionIdentity | null {
    return this.lastValidPermissionIdentity;
  }

  getLastValidPermissionSnapshotForTests(): PermissionSnapshot | null {
    return this.lastValidPermissionSnapshot;
  }

  private bumpSessionPermissionGeneration(): number {
    this.sessionPermissionGeneration += 1;
    return this.sessionPermissionGeneration;
  }

  private isPermissionGenerationCurrent(generation: number, sessionId: string): boolean {
    return (
      generation === this.sessionPermissionGeneration &&
      this.store.getSessionId() === sessionId &&
      this.store.getMachineState() === 'AUTHENTICATED'
    );
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

  setPermissionProfileForTests(profile: ProfileResolveInput): void {
    this.permissionProfile = profile;
  }

  setPermissionFlagsForTests(flags: SnapshotFlags): void {
    this.permissionFlags = Object.freeze({ ...flags });
  }

  getPermissionProfileForTests(): ProfileResolveInput {
    return this.permissionProfile;
  }

  getPermissionFlagsForTests(): SnapshotFlags {
    return this.permissionFlags;
  }

  getPermissionResolverInvokeCountForTests(): number {
    return this.permissionResolverInvokeCount;
  }

  private defaultAuthenticatedProfile(portal: SessionSnapshot['portal']): ProfileResolveInput {
    switch (portal) {
      case 'client':
        return { kind: 'client', profileId: 'client.regular' };
      case 'staff':
        return { kind: 'staff', profileId: 'staff.seller' };
      case 'artist':
        return { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' };
      default:
        return { kind: 'guest' };
    }
  }

  private isAccessSnapshotPermissionsEnabled(): boolean {
    return getConfig().features.accessSnapshotPermissions === true;
  }

  private applyMinimumPermissions(): void {
    this.permissionProfile = { kind: 'guest' };
    this.permissionFlags = {};
    this.enrichedSnapshot = null;
  }

  private applyResolvedPermissions(
    profile: ProfileResolveInput,
    flags: SnapshotFlags,
    permissions: PermissionSnapshot,
    userId: string,
  ): SessionSnapshotWithPermissions {
    const clonedProfile = this.cloneProfileResolveInput(profile);
    const clonedFlags = Object.freeze({ ...flags });
    this.permissionProfile = clonedProfile;
    this.permissionFlags = clonedFlags;
    this.enrichedSnapshot = null;

    const enriched = this.attachPermissions(this.store.getSnapshot());
    this.lastValidPermissionProfile = clonedProfile;
    this.lastValidPermissionFlags = clonedFlags;
    this.lastValidPermissionSnapshot = this.clonePermissionSnapshot(permissions);
    this.lastValidPermissionIdentity = this.buildPermissionIdentity(userId);
    this.lastPermissionResolutionFailure = null;
    return enriched;
  }

  private applyFailurePolicy(): void {
    this.permissionsResolutionPhase = 'failed';
    const currentUserId = this.store.getSnapshot().user?.userId;
    const currentIdentity =
      currentUserId !== undefined ? this.buildPermissionIdentity(currentUserId) : null;
    const canReuseLastValid =
      currentIdentity !== null &&
      this.lastValidPermissionIdentity !== null &&
      this.lastValidPermissionProfile !== null &&
      this.matchesPermissionIdentity(this.lastValidPermissionIdentity, currentIdentity);

    if (canReuseLastValid && this.lastValidPermissionProfile) {
      this.permissionProfile = this.lastValidPermissionProfile;
      this.permissionFlags = Object.freeze({ ...this.lastValidPermissionFlags });
    } else {
      this.clearLastValidPermissionCache();
      this.applyMinimumPermissions();
    }
    this.enrichedSnapshot = null;
  }

  private combinePermissionSignals(
    signals: readonly (AbortSignal | undefined)[],
  ): AbortSignal | undefined {
    const active = signals.filter((signal): signal is AbortSignal => signal !== undefined);
    if (active.length === 0) {
      return undefined;
    }
    if (active.length === 1) {
      return active[0];
    }
    if (typeof AbortSignal.any === 'function') {
      return AbortSignal.any(active);
    }

    const controller = new AbortController();
    for (const signal of active) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }

  private publishAuthenticatedSessionReady(reason: string): SessionSnapshot {
    const readySnapshot = this.publishSessionSnapshot('SESSION_READY');
    publishSessionEvent('SESSION_READY', {
      portal: readySnapshot.portal,
      sessionId: readySnapshot.sessionId,
      state: readySnapshot.state,
      reason,
    });
    return readySnapshot;
  }

  private async resolveAndCommitAccessPermissions(
    trigger: PermissionResolutionTrigger,
    generation: number,
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<SessionSnapshot> {
    if (!this.isAccessSnapshotPermissionsEnabled()) {
      throw new SessionError(
        'SESSION_ERROR_NOT_READY',
        'Access snapshot permissions are disabled for this resolve call.',
      );
    }

    const port = this.accessPermissionResolutionPort;
    if (!port) {
      this.applyFailurePolicy();
      return this.store.getSnapshot();
    }

    if (
      this.permissionsResolveInFlight &&
      this.permissionsResolveInFlightGeneration === generation
    ) {
      return this.permissionsResolveInFlight;
    }

    if (this.permissionsResolveInFlight) {
      this.permissionResolutionAbortController?.abort();
      this.permissionsResolveInFlight = null;
      this.permissionsResolveInFlightGeneration = null;
    }

    if (this.store.getMachineState() !== 'AUTHENTICATED') {
      this.applyFailurePolicy();
      return this.store.getSnapshot();
    }

    this.permissionsResolutionPhase = 'pending';
    const abortController = new AbortController();
    this.permissionResolutionAbortController = abortController;
    const combinedSignal = this.combinePermissionSignals([signal, abortController.signal]);

    const execution = (async (): Promise<SessionSnapshot> => {
      try {
        const snapshot = this.store.getSnapshot();
        const userId = snapshot.user?.userId;
        if (!userId) {
          this.applyFailurePolicy();
          return snapshot;
        }

        const result = await port.resolve({
          portal: this.store.getPortal(),
          userId,
          sessionId: snapshot.sessionId,
          snapshotVersion: snapshot.snapshotVersion,
          signal: combinedSignal,
        });

        if (!this.isPermissionGenerationCurrent(generation, sessionId)) {
          this.permissionsResolutionPhase = 'idle';
          return this.store.getSnapshot();
        }

        if (!result.ok) {
          if (result.cancelled || result.stale) {
            this.permissionsResolutionPhase = 'idle';
            return this.store.getSnapshot();
          }

          this.lastPermissionResolutionFailure = result;
          this.applyFailurePolicy();
          getLogger().info('Access permission resolution failed', {
            moduleId: 'MOD-002',
            trigger,
            stage: result.stage,
            retryable: result.retryable,
            permissionsResolutionPhase: this.permissionsResolutionPhase,
            resolutionEpoch: result.resolutionEpoch,
          });
          return this.store.getSnapshot();
        }

        this.applyResolvedPermissions(result.profile, result.flags, result.permissions, userId);
        this.permissionsResolutionPhase = 'resolved';
        return this.publishAuthenticatedSessionReady(`access-snapshot-${trigger}`);
      } catch (error) {
        if (this.isPermissionGenerationCurrent(generation, sessionId)) {
          this.lastPermissionResolutionFailure = null;
          this.applyFailurePolicy();
        }
        getLogger().info('Access permission resolution threw', {
          moduleId: 'MOD-002',
          trigger,
          permissionsResolutionPhase: this.permissionsResolutionPhase,
          error: error instanceof Error ? error.message : 'unknown',
        });
        return this.store.getSnapshot();
      } finally {
        this.permissionsResolveInFlight = null;
        this.permissionsResolveInFlightGeneration = null;
        if (this.permissionResolutionAbortController === abortController) {
          this.permissionResolutionAbortController = null;
        }
      }
    })();

    this.permissionsResolveInFlight = execution;
    this.permissionsResolveInFlightGeneration = generation;
    return execution;
  }

  private attachPermissions(baseSnapshot: SessionSnapshot): SessionSnapshotWithPermissions {
    const permissionSnapshot = resolvePermissionSnapshot({
      profile: this.permissionProfile,
      portal: toPermissionPortal(baseSnapshot.portal),
      flags: this.permissionFlags,
      userId: baseSnapshot.user?.userId ?? null,
      snapshotVersion: baseSnapshot.snapshotVersion,
    });

    const enriched: SessionSnapshotWithPermissions = Object.freeze({
      ...baseSnapshot,
      roles: Object.freeze([permissionSnapshot.documentedRole]),
      capabilities: Object.freeze([...permissionSnapshot.capabilities]),
      permissions: permissionSnapshot,
      permissionVersion: permissionSnapshot.snapshotVersion,
      resolvedAt: permissionSnapshot.resolvedAt,
      capabilityCount: permissionSnapshot.capabilityCount,
    });

    return enriched;
  }

  private syncSessionRegistry(snapshot: SessionSnapshot): void {
    const role =
      snapshot.roles[0] ??
      (snapshot.user ? 'authenticated' : 'guest');
    getSessionRegistry().register(
      snapshot,
      this.store.getMachineState(),
      role,
      snapshot.capabilities,
    );
  }

  private persistSessionRecord(snapshot: SessionSnapshot): void {
    if (!this.persistencePort.persist) {
      return;
    }

    this.persistencePort.persist(
      Object.freeze({
        recordVersion: PERSISTED_SESSION_RECORD_VERSION,
        sessionId: snapshot.sessionId,
        portal: snapshot.portal,
        userId: snapshot.user?.userId ?? null,
        email: snapshot.user?.email,
        mdjbId: snapshot.user?.mdjbId,
        expiresAt: snapshot.expiresAt,
        locale: snapshot.locale,
        theme: snapshot.theme,
        persistedAt: new Date().toISOString(),
      }),
    );
  }

  private publishSessionSnapshot(lifecycle: SessionLifecycleState): SessionSnapshot {
    const base = this.store.publishSnapshot(this.configSlice(), lifecycle);
    if (lifecycle !== 'SESSION_READY') {
      this.enrichedSnapshot = null;
      this.syncSessionRegistry(base);
      return base;
    }

    const enriched = this.attachPermissions(base);
    this.enrichedSnapshot = enriched;
    this.permissionResolverInvokeCount += 1;
    this.syncSessionRegistry(enriched);
    this.persistSessionRecord(enriched);
    return enriched;
  }

  private resolveSnapshotForRead(): SessionSnapshot {
    if (this.enrichedSnapshot) {
      return this.enrichedSnapshot;
    }

    const base = this.store.getSnapshot();
    if (base.state === 'SESSION_READY') {
      const enriched = this.attachPermissions(base);
      this.enrichedSnapshot = enriched;
      return enriched;
    }

    return base;
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
        accessSnapshotPermissions: config.features.accessSnapshotPermissions,
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
          return this.resolveSnapshotForRead();
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
    if (this.store.getMachineState() === 'ERROR') {
      return;
    }

    if (this.store.getLifecycleState() === 'SESSION_READY' && this.frozenApi) {
      return;
    }

    if (!this.frozenApi) {
      return;
    }

    if (this.store.getMachineState() === 'INITIAL') {
      this.commitSessionAuthOutcome(this.runHydrationRestore());
    }
  }

  handleUserLoginEvent(payload: UserLoginEventPayload): void {
    if (!this.frozenApi) {
      return;
    }

    try {
      const handle = this.authBoundary.buildAuthHandleFromUserLogin(payload);
      this.commitSessionAuthOutcome(this.ingestAuthHandle(handle));
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
    if (this.isAccessSnapshotPermissionsEnabled()) {
      if (this.permissionsResolutionPhase !== 'resolved' || lifecycle !== 'SESSION_READY') {
        return;
      }
    } else if (lifecycle !== 'SESSION_READY' && lifecycle !== 'SIGNED_IN') {
      return;
    }

    const readyLifecycle: SessionLifecycleState = 'SESSION_READY';
    const snapshot = this.publishSessionSnapshot(readyLifecycle);
    publishSessionEvent('SESSION_READY', {
      portal: snapshot.portal,
      sessionId: snapshot.sessionId,
      state: snapshot.state,
      reason,
    });
  }

  private completeFatalValidate(code: SessionErrorCode, reason: string): never {
    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_FAIL_FATAL', 'ERROR');
    }

    this.persistencePort.clear?.();
    this.store.setLifecycleState('SESSION_UNINITIALIZED');
    this.store.bumpSnapshotVersion();

    const errorSnapshot = this.store.publishSnapshot(this.configSlice(), 'SESSION_UNINITIALIZED');
    this.syncSessionRegistry(errorSnapshot);

    if (!this.fatalErrorEmitted) {
      publishSessionEvent('SESSION_ERROR', {
        code,
        sessionId: this.store.getSessionId(),
        reason,
      });
      this.fatalErrorEmitted = true;
    }

    getLogger().error('Session validate fatal', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      code,
      reason,
      machineState: this.store.getMachineState(),
    });

    throw new SessionError(code, reason);
  }

  /** Boot path — anonymous SESSION_READY (baseline PO 2026-07-06). Skips persistence restore. */
  markReadyAnonymous(): SessionSnapshot {
    return this.completeAnonymousReady();
  }

  /** Boot hydration — restore from PersistencePort then validate (Phase 4). */
  runHydrationRestore(): SessionAuthOutcome {
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
    this.permissionProfile = { kind: 'guest' };

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

    const snapshot = this.publishSessionSnapshot('SESSION_READY');

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

  private applyRestoredRecord(record: PersistedSessionRecord): SessionAuthOutcome {
    if (
      record.portal &&
      record.portal !== this.store.getPortal()
    ) {
      this.completeFatalValidate(
        'SESSION_ERROR_VALIDATE_FATAL',
        `portal-allowlist-mismatch: expected ${this.store.getPortal()}, found ${record.portal}`,
      );
    }

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

    if (!this.isAccessSnapshotPermissionsEnabled()) {
      return this.applyRestoredRecordFlagOff(record, userId);
    }

    return this.applyRestoredRecordFlagOn(record, userId);
  }

  private applyRestoredRecordFlagOff(
    record: PersistedSessionRecord,
    userId: string,
  ): SessionSnapshot {
    this.store.appendHydrationTraceStep('restore_found');
    this.store.setUser({
      userId,
      email: record.email,
      mdjbId: record.mdjbId,
    });
    this.store.setExpiresAt(record.expiresAt ?? null);
    this.store.setHydrationPhase('initial');
    this.store.bumpSnapshotVersion();
    this.permissionProfile = this.defaultAuthenticatedProfile(this.store.getPortal());

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_OK_USER', 'AUTHENTICATED');
    }

    this.store.appendHydrationTraceStep('validate_authenticated');
    this.store.publishSnapshot(this.configSlice(), 'SIGNED_IN');
    publishSessionEvent('SESSION_CREATED', {
      userId,
      hydrationPhase: 'initial',
    });

    const readySnapshot = this.publishSessionSnapshot('SESSION_READY');
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

  private async applyRestoredRecordFlagOn(
    record: PersistedSessionRecord,
    userId: string,
  ): Promise<SessionSnapshot> {
    this.store.appendHydrationTraceStep('restore_found');
    this.store.setUser({
      userId,
      email: record.email,
      mdjbId: record.mdjbId,
    });
    this.store.setExpiresAt(record.expiresAt ?? null);
    this.store.setHydrationPhase('initial');
    this.store.bumpSnapshotVersion();
    this.invalidateLastValidUnlessSameIdentity(this.buildPermissionIdentity(userId));
    this.applyMinimumPermissions();

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_OK_USER', 'AUTHENTICATED');
    }

    this.store.appendHydrationTraceStep('validate_authenticated');
    this.store.publishSnapshot(this.configSlice(), 'SIGNED_IN');
    publishSessionEvent('SESSION_CREATED', {
      userId,
      hydrationPhase: 'initial',
    });

    const generation = this.bumpSessionPermissionGeneration();
    const sessionId = this.store.getSessionId();
    const outcome = await this.resolveAndCommitAccessPermissions('restore', generation, sessionId);

    this.store.appendHydrationTraceStep('ready');
    this.store.completeHydrationTrace();

    getLogger().info('Session restored from persistence', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      userId,
      hydrationPhase: 'initial',
      machineState: this.store.getMachineState(),
      hydrationTrace: this.store.getHydrationTrace()?.steps,
      permissionsResolutionPhase: this.permissionsResolutionPhase,
    });

    return outcome;
  }

  ingestAuthHandle(handle: AuthHandle, identity?: IdentitySnapshot): SessionAuthOutcome {
    if (!this.isAccessSnapshotPermissionsEnabled()) {
      return this.ingestAuthHandleFlagOff(handle, identity);
    }
    return this.ingestAuthHandleFlagOn(handle, identity);
  }

  private ingestAuthHandleAllowsLifecycle(lifecycle: SessionLifecycleState): boolean {
    if (lifecycle === 'SESSION_READY' || lifecycle === 'SIGNED_OUT' || lifecycle === 'SESSION_EXPIRED') {
      return true;
    }
    return this.isAccessSnapshotPermissionsEnabled() && lifecycle === 'SIGNED_IN';
  }

  private ingestAuthHandleFlagOff(
    handle: AuthHandle,
    identity?: IdentitySnapshot,
  ): SessionSnapshot {
    const lifecycle = this.store.getLifecycleState();
    if (!this.ingestAuthHandleAllowsLifecycle(lifecycle)) {
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
    this.store.setCredential(acceptedHandle.accessTokenRef, validated.userRef.userId);
    this.store.setHydrationPhase(validated.hydrationPhase);
    this.store.bumpSnapshotVersion();

    if (this.permissionProfile.kind === 'guest') {
      this.permissionProfile = this.defaultAuthenticatedProfile(this.store.getPortal());
    }

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_OK_USER', 'AUTHENTICATED');
    }

    this.store.publishSnapshot(this.configSlice(), 'SIGNED_IN');
    publishSessionEvent('SESSION_CREATED', {
      userId: validated.userRef.userId,
      hydrationPhase: validated.hydrationPhase,
      handoffId: acceptedHandle.handoffId,
    });

    const readySnapshot = this.publishSessionSnapshot('SESSION_READY');
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

  private async ingestAuthHandleFlagOn(
    handle: AuthHandle,
    identity?: IdentitySnapshot,
  ): Promise<SessionSnapshot> {
    const lifecycle = this.store.getLifecycleState();
    if (!this.ingestAuthHandleAllowsLifecycle(lifecycle)) {
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
    this.store.setCredential(acceptedHandle.accessTokenRef, validated.userRef.userId);
    this.store.setHydrationPhase(validated.hydrationPhase);
    this.store.bumpSnapshotVersion();
    this.invalidateLastValidUnlessSameIdentity(this.buildPermissionIdentity(validated.userRef.userId));
    this.applyMinimumPermissions();

    if (this.store.getMachineState() === 'LOADING') {
      this.store.applyMachineTransition('LOADING', 'VALIDATE_OK_USER', 'AUTHENTICATED');
    }

    this.store.publishSnapshot(this.configSlice(), 'SIGNED_IN');
    publishSessionEvent('SESSION_CREATED', {
      userId: validated.userRef.userId,
      hydrationPhase: validated.hydrationPhase,
      handoffId: acceptedHandle.handoffId,
    });

    const generation = this.bumpSessionPermissionGeneration();
    const sessionId = this.store.getSessionId();
    const outcome = await this.resolveAndCommitAccessPermissions(
      'auth-handoff',
      generation,
      sessionId,
    );

    getLogger().info('Session signed in via AuthHandle handoff', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      userId: validated.userRef.userId,
      handoffId: acceptedHandle.handoffId,
      hydrationPhase: validated.hydrationPhase,
      machineState: this.store.getMachineState(),
      permissionsResolutionPhase: this.permissionsResolutionPhase,
    });

    return outcome;
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
    this.syncSessionRegistry(snapshot);
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

  /** Lifecycle — explicit expiry transition with SESSION_EXPIRED emission. */
  expireSession(reason = 'expiry-detected'): SessionSnapshot {
    return this.handleSessionExpiry(reason);
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
    this.publishSessionSnapshot('SESSION_READY');

    publishSessionEvent('SESSION_REFRESH', {
      sessionId: this.store.getSessionId(),
      userId: snapshot.user.userId,
      phase: 'start',
    });

    const refreshResult = await resolveRefreshResult(
      unwrapRefreshResult(
        this.refreshPort.refresh({
          sessionId: this.store.getSessionId(),
          userId: snapshot.user.userId,
          accessTokenRef: options?.accessTokenRef ?? this.store.getAccessTokenRef() ?? 'mock-access-ref',
          expiresAt: snapshot.expiresAt,
        }),
      ),
    );

    if (!refreshResult.ok) {
      return this.finalizeRefreshFailure(refreshResult.reason, options?.reason);
    }

    return this.finalizeRefreshSuccess(refreshResult, options?.reason);
  }

  private finalizeRefreshSuccess(refreshResult: SessionRefreshPortSuccess, reason?: string): SessionSnapshot {
    if (this.store.getMachineState() === 'REFRESHING') {
      this.store.applyMachineTransition('REFRESHING', 'REFRESH_OK', 'AUTHENTICATED');
    }

    this.store.setExpiresAt(refreshResult.expiresAt);
    const userId = this.store.getSnapshot().user?.userId;
    if (refreshResult.accessTokenRef && userId) {
      this.store.updateCredentialAccessToken(refreshResult.accessTokenRef, userId);
    }
    this.store.setRefreshing(false);
    this.store.bumpSnapshotVersion();

    const readySnapshot = this.publishSessionSnapshot('SESSION_READY');
    publishSessionEvent('SESSION_REFRESH', {
      sessionId: readySnapshot.sessionId,
      userId: readySnapshot.user?.userId ?? 'anonymous',
      phase: 'done',
    });
    publishSessionEvent('SESSION_READY', {
      portal: readySnapshot.portal,
      sessionId: readySnapshot.sessionId,
      state: readySnapshot.state,
      reason: reason ?? 'refresh-ok',
    });

    getLogger().info('Session refresh succeeded', {
      moduleId: 'MOD-002',
      sessionId: this.store.getSessionId(),
      expiresAt: refreshResult.expiresAt,
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
    this.syncSessionRegistry(expiredSnapshot);
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
    this.invalidatePermissionResolutionState(true);
    this.store.clearCredential();
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
    const sessionId = this.store.getSessionId();
    this.invalidatePermissionResolutionState(true);
    this.store.clearCredential();
    publishSessionEvent('SESSION_DESTROYED', {
      reason,
      sessionId,
    });
    getSessionRegistry().remove(sessionId);
    this.persistencePort.clear?.();
    this.store.invalidateSnapshot();
    this.frozenApi = null;

    getLogger().info('Session destroyed', {
      moduleId: 'MOD-002',
      reason,
    });
  }

  /** Lifecycle — allocate session identity and public API without hydration. */
  createSession(options: InitializeSessionOptions): SessionPublicApi {
    if (this.store.getLifecycleState() === 'SESSION_READY' && this.frozenApi) {
      this.wireEventListeners();
      return this.frozenApi;
    }

    this.store.beginSession(options.portal);

    getLogger().info('Session creation started', {
      moduleId: 'MOD-002',
      portal: options.portal,
      state: this.store.getLifecycleState(),
      machineState: this.store.getMachineState(),
    });

    this.frozenApi = this.buildPublicApi();
    this.wireEventListeners();
    return this.frozenApi;
  }

  /** Lifecycle — restore and validate persisted session state. */
  hydrateSession(): SessionAuthOutcome {
    if (!this.frozenApi) {
      throw new SessionError('SESSION_ERROR_NOT_READY', 'Call createSession() before hydrateSession().');
    }
    return this.runHydrationRestore();
  }

  initialize(options: InitializeSessionOptions): SessionPublicApi {
    if (this.store.getLifecycleState() === 'SESSION_READY' && this.frozenApi) {
      this.wireEventListeners();
      return this.frozenApi;
    }

    const api = this.createSession(options);
    this.commitSessionAuthOutcome(this.runHydrationRestore());
    return api;
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
