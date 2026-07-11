/** MOD-002 Session Manager — in-memory store — TICKET-MOD-002-SESSION-PROVIDER-STORE-001 */

import type { PortalId } from '@mdj/shared/config';
import { assertTransition } from './state-machine';
import type {
  HydrationPhase,
  HydrationTrace,
  HydrationTraceStep,
  SessionLifecycleState,
  SessionSnapshot,
  SessionStateMachineState,
  SessionTransitionEvent,
  UserRef,
} from './types';

export type SessionStoreConfigSlice = {
  readonly locale: SessionSnapshot['locale'];
  readonly theme: SessionSnapshot['theme'];
  readonly featureFlags: SessionSnapshot['featureFlags'];
};

let sessionCounter = 0;

function nextSessionId(): string {
  sessionCounter += 1;
  return `ses_${String(sessionCounter).padStart(8, '0')}`;
}

function deepFreezeSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  return Object.freeze({
    ...snapshot,
    roles: Object.freeze([...snapshot.roles]),
    capabilities: Object.freeze([...snapshot.capabilities]),
    featureFlags: Object.freeze({ ...snapshot.featureFlags }),
    ...(snapshot.user ? { user: Object.freeze({ ...snapshot.user }) } : { user: null }),
  });
}

/** Authoritative mutable session memory — exposes immutable snapshots only. */
export class SessionStore {
  private machineState: SessionStateMachineState | null = null;
  private lifecycleState: SessionLifecycleState = 'SESSION_UNINITIALIZED';
  private portal: PortalId = 'client';
  private sessionId = '';
  private snapshotVersion = 0;
  private currentUser: UserRef | null = null;
  private expiresAt: string | null = null;
  private hydrationPhase: HydrationPhase = 'none';
  private hydrationTrace: HydrationTrace | null = null;
  private isRefreshing = false;
  private frozenSnapshot: SessionSnapshot | null = null;
  private accessTokenRef: string | null = null;
  private boundUserId: string | null = null;
  private credentialVersion = 0;

  reset(): void {
    this.machineState = null;
    this.lifecycleState = 'SESSION_UNINITIALIZED';
    this.portal = 'client';
    this.sessionId = '';
    this.snapshotVersion = 0;
    this.currentUser = null;
    this.expiresAt = null;
    this.hydrationPhase = 'none';
    this.hydrationTrace = null;
    this.isRefreshing = false;
    this.frozenSnapshot = null;
    this.accessTokenRef = null;
    this.boundUserId = null;
    this.credentialVersion = 0;
  }

  beginHydrationTrace(): void {
    this.hydrationTrace = Object.freeze({
      steps: Object.freeze([] as HydrationTraceStep[]),
      startedAt: new Date().toISOString(),
      completedAt: null,
    });
  }

  appendHydrationTraceStep(step: HydrationTraceStep): void {
    if (!this.hydrationTrace) {
      this.beginHydrationTrace();
    }

    const current = this.hydrationTrace as HydrationTrace;
    this.hydrationTrace = Object.freeze({
      ...current,
      steps: Object.freeze([...current.steps, step]),
    });
  }

  completeHydrationTrace(): void {
    if (!this.hydrationTrace) {
      return;
    }

    this.hydrationTrace = Object.freeze({
      ...this.hydrationTrace,
      completedAt: new Date().toISOString(),
    });
  }

  getHydrationTrace(): HydrationTrace | null {
    return this.hydrationTrace;
  }

  getMachineState(): SessionStateMachineState | null {
    return this.machineState;
  }

  getLifecycleState(): SessionLifecycleState {
    return this.lifecycleState;
  }

  getPortal(): PortalId {
    return this.portal;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  setPortal(portal: PortalId): void {
    this.portal = portal;
  }

  setLifecycleState(state: SessionLifecycleState): void {
    this.lifecycleState = state;
  }

  bumpSnapshotVersion(): void {
    this.snapshotVersion += 1;
  }

  setUser(user: UserRef | null): void {
    this.currentUser = user;
  }

  getCurrentUser(): UserRef | null {
    return this.currentUser;
  }

  setExpiresAt(value: string | null): void {
    this.expiresAt = value;
  }

  setHydrationPhase(phase: HydrationPhase): void {
    this.hydrationPhase = phase;
  }

  setRefreshing(value: boolean): void {
    this.isRefreshing = value;
  }

  clearIdentity(): void {
    this.currentUser = null;
    this.expiresAt = null;
  }

  setCredential(accessTokenRef: string, boundUserId: string): void {
    const trimmed = accessTokenRef.trim();
    if (!trimmed || !boundUserId) {
      return;
    }

    this.accessTokenRef = trimmed;
    this.boundUserId = boundUserId;
    this.credentialVersion += 1;
  }

  updateCredentialAccessToken(accessTokenRef: string, boundUserId: string): void {
    const trimmed = accessTokenRef.trim();
    if (!trimmed || !boundUserId) {
      return;
    }

    if (this.accessTokenRef === trimmed && this.boundUserId === boundUserId) {
      return;
    }

    this.accessTokenRef = trimmed;
    this.boundUserId = boundUserId;
    this.credentialVersion += 1;
  }

  clearCredential(): void {
    if (this.accessTokenRef === null && this.boundUserId === null) {
      return;
    }

    this.accessTokenRef = null;
    this.boundUserId = null;
    this.credentialVersion += 1;
  }

  getAccessTokenRef(): string | null {
    return this.accessTokenRef;
  }

  getBoundUserId(): string | null {
    return this.boundUserId;
  }

  getCredentialVersion(): number {
    return this.credentialVersion;
  }

  isRefreshingCredential(): boolean {
    return this.isRefreshing;
  }

  private isExpiredIsoTimestamp(value: string | null): boolean {
    if (!value) {
      return false;
    }

    const expiryMs = Date.parse(value);
    return Number.isNaN(expiryMs) || expiryMs <= Date.now();
  }

  private isAuthorizationDeniedByMachineState(): boolean {
    const machine = this.machineState;
    if (!machine) {
      return true;
    }

    return (
      machine === 'INITIAL' ||
      machine === 'LOADING' ||
      machine === 'ANONYMOUS' ||
      machine === 'EXPIRED' ||
      machine === 'LOGGING_OUT' ||
      machine === 'DESTROYED' ||
      machine === 'ERROR'
    );
  }

  /** Internal — preformatted Authorization header for MOD-005 composition root. */
  resolveAuthorizationHeader(): string | null {
    if (this.isAuthorizationDeniedByMachineState()) {
      return null;
    }

    if (!this.currentUser) {
      return null;
    }

    if (!this.accessTokenRef || !this.boundUserId) {
      return null;
    }

    if (this.boundUserId !== this.currentUser.userId) {
      return null;
    }

    if (this.isExpiredIsoTimestamp(this.expiresAt)) {
      return null;
    }

    return `Bearer ${this.accessTokenRef}`;
  }

  beginSession(portal: PortalId): void {
    this.portal = portal;
    this.sessionId = nextSessionId();
    this.lifecycleState = 'INITIAL_SESSION';
    this.applyMachineTransition(null, 'MODULE_LOAD', 'INITIAL');
  }

  applyMachineTransition(
    from: SessionStateMachineState | null,
    event: SessionTransitionEvent,
    to: SessionStateMachineState,
  ): SessionStateMachineState {
    const source = from ?? this.machineState;
    assertTransition(source, to, event);
    this.machineState = to;
    return to;
  }

  publishSnapshot(config: SessionStoreConfigSlice, lifecycleState: SessionLifecycleState): SessionSnapshot {
    this.lifecycleState = lifecycleState;
    const snapshot = deepFreezeSnapshot({
      user: this.currentUser ? { ...this.currentUser } : null,
      portal: this.portal,
      roles: this.currentUser ? ['guest'] : [],
      capabilities: [],
      locale: config.locale,
      theme: config.theme,
      featureFlags: config.featureFlags,
      sessionId: this.sessionId,
      expiresAt: this.expiresAt,
      hydrationPhase: this.hydrationPhase,
      state: lifecycleState,
      snapshotVersion: this.snapshotVersion,
      updatedAt: new Date().toISOString(),
      isRefreshing: this.isRefreshing,
    });
    this.frozenSnapshot = snapshot;
    return snapshot;
  }

  getSnapshot(): SessionSnapshot {
    if (!this.frozenSnapshot) {
      throw new Error('SessionStore snapshot is not available.');
    }
    return this.frozenSnapshot;
  }

  invalidateSnapshot(): void {
    this.frozenSnapshot = null;
    this.sessionId = '';
    this.snapshotVersion = 0;
    this.machineState = null;
    this.lifecycleState = 'SESSION_UNINITIALIZED';
    this.clearIdentity();
    this.clearCredential();
    this.hydrationPhase = 'none';
    this.hydrationTrace = null;
    this.isRefreshing = false;
  }
}

/** Test-only counter reset — not for production portals. */
export function resetSessionStoreCounterForTests(): void {
  sessionCounter = 0;
}
