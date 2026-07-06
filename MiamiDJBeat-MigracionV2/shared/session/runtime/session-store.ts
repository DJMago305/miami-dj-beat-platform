/** MOD-002 Session Manager — in-memory store — TICKET-MOD-002-SESSION-PROVIDER-STORE-001 */

import type { PortalId } from '@mdj/shared/config';
import { assertTransition } from './state-machine';
import type {
  HydrationPhase,
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
  private isRefreshing = false;
  private frozenSnapshot: SessionSnapshot | null = null;

  reset(): void {
    this.machineState = null;
    this.lifecycleState = 'SESSION_UNINITIALIZED';
    this.portal = 'client';
    this.sessionId = '';
    this.snapshotVersion = 0;
    this.currentUser = null;
    this.expiresAt = null;
    this.hydrationPhase = 'none';
    this.isRefreshing = false;
    this.frozenSnapshot = null;
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
    this.hydrationPhase = 'none';
    this.isRefreshing = false;
  }
}

/** Test-only counter reset — not for production portals. */
export function resetSessionStoreCounterForTests(): void {
  sessionCounter = 0;
}
