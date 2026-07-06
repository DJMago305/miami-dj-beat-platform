import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore, resetSessionStoreCounterForTests } from '../../shared/session/runtime/session-store';

describe('MOD-002 SessionStore — TICKET-MOD-002-SESSION-PROVIDER-STORE-001', () => {
  let store: SessionStore;

  const configSlice = {
    locale: 'en' as const,
    theme: 'dark' as const,
    featureFlags: { eventBus: true, strictConfig: true, debugPanel: true },
  };

  beforeEach(() => {
    resetSessionStoreCounterForTests();
    store = new SessionStore();
  });

  it('starts uninitialized with no snapshot', () => {
    expect(store.getLifecycleState()).toBe('SESSION_UNINITIALIZED');
    expect(store.getMachineState()).toBeNull();
    expect(() => store.getSnapshot()).toThrow(/not available/i);
  });

  it('beginSession assigns portal, session id, INITIAL lifecycle and machine state', () => {
    store.beginSession('artist');

    expect(store.getPortal()).toBe('artist');
    expect(store.getSessionId()).toMatch(/^ses_/);
    expect(store.getLifecycleState()).toBe('INITIAL_SESSION');
    expect(store.getMachineState()).toBe('INITIAL');
  });

  it('applyMachineTransition enforces the official state machine', () => {
    store.beginSession('client');
    store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');
    store.applyMachineTransition('LOADING', 'VALIDATE_OK_NO_USER', 'ANONYMOUS');

    expect(store.getMachineState()).toBe('ANONYMOUS');
  });

  it('publishSnapshot returns a deep-frozen immutable snapshot', () => {
    store.beginSession('staff');
    store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');
    store.applyMachineTransition('LOADING', 'VALIDATE_OK_NO_USER', 'ANONYMOUS');

    const snapshot = store.publishSnapshot(configSlice, 'SESSION_READY');

    expect(snapshot.state).toBe('SESSION_READY');
    expect(snapshot.portal).toBe('staff');
    expect(snapshot.user).toBeNull();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.featureFlags)).toBe(true);
    expect(Object.isFrozen(snapshot.roles)).toBe(true);
    expect(Object.isFrozen(snapshot.capabilities)).toBe(true);
    expect(store.getSnapshot()).toBe(snapshot);
  });

  it('bumpSnapshotVersion increments published snapshot version', () => {
    store.beginSession('client');
    store.bumpSnapshotVersion();
    store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');
    store.applyMachineTransition('LOADING', 'VALIDATE_OK_NO_USER', 'ANONYMOUS');

    const first = store.publishSnapshot(configSlice, 'SESSION_READY');
    store.bumpSnapshotVersion();
    const second = store.publishSnapshot(configSlice, 'SESSION_READY');

    expect(second.snapshotVersion).toBe(first.snapshotVersion + 1);
  });

  it('invalidateSnapshot resets to uninitialized', () => {
    store.beginSession('client');
    store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');
    store.applyMachineTransition('LOADING', 'VALIDATE_OK_NO_USER', 'ANONYMOUS');
    store.publishSnapshot(configSlice, 'SESSION_READY');

    store.invalidateSnapshot();

    expect(store.getLifecycleState()).toBe('SESSION_UNINITIALIZED');
    expect(store.getMachineState()).toBeNull();
    expect(() => store.getSnapshot()).toThrow(/not available/i);
  });

  it('reset clears all internal state', () => {
    store.beginSession('client');
    store.publishSnapshot(configSlice, 'SESSION_READY');
    store.reset();

    expect(store.getLifecycleState()).toBe('SESSION_UNINITIALIZED');
    expect(store.getMachineState()).toBeNull();
  });
});
