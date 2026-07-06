import { describe, expect, it } from 'vitest';
import { SessionError } from '../../shared/session/runtime/errors';
import {
  assertTransition,
  getEntryState,
  isValidTransition,
  listValidTransitionsFrom,
  SESSION_STATE_MACHINE_STATES,
  SESSION_TRANSITION_TABLE,
} from '../../shared/session/runtime/state-machine';
import type { SessionStateMachineState, SessionTransitionEvent } from '../../shared/session/runtime/types';

const VALID_TRANSITIONS: Array<{
  from: SessionStateMachineState | null;
  event: SessionTransitionEvent;
  to: SessionStateMachineState;
}> = [
  { from: null, event: 'MODULE_LOAD', to: 'INITIAL' },
  { from: 'INITIAL', event: 'SYSTEM_READY', to: 'LOADING' },
  { from: 'LOADING', event: 'VALIDATE_OK_USER', to: 'AUTHENTICATED' },
  { from: 'LOADING', event: 'VALIDATE_OK_NO_USER', to: 'ANONYMOUS' },
  { from: 'LOADING', event: 'VALIDATE_FAIL_RECOVERABLE', to: 'ANONYMOUS' },
  { from: 'LOADING', event: 'VALIDATE_FAIL_FATAL', to: 'ERROR' },
  { from: 'AUTHENTICATED', event: 'USER_LOGIN', to: 'LOADING' },
  { from: 'AUTHENTICATED', event: 'PERMISSION_CHANGED', to: 'AUTHENTICATED' },
  { from: 'AUTHENTICATED', event: 'REFRESH_START', to: 'REFRESHING' },
  { from: 'REFRESHING', event: 'REFRESH_OK', to: 'AUTHENTICATED' },
  { from: 'REFRESHING', event: 'REFRESH_FAIL', to: 'EXPIRED' },
  { from: 'AUTHENTICATED', event: 'EXPIRY_DETECTED', to: 'EXPIRED' },
  { from: 'EXPIRED', event: 'USER_LOGIN', to: 'LOADING' },
  { from: 'EXPIRED', event: 'USER_LOGOUT', to: 'LOGGING_OUT' },
  { from: 'ANONYMOUS', event: 'USER_LOGIN', to: 'LOADING' },
  { from: 'ANONYMOUS', event: 'USER_LOGOUT', to: 'LOGGING_OUT' },
  { from: 'AUTHENTICATED', event: 'USER_LOGOUT', to: 'LOGGING_OUT' },
  { from: 'ANONYMOUS', event: 'PERMISSION_CHANGED', to: 'ANONYMOUS' },
  { from: 'LOGGING_OUT', event: 'TEARDOWN_COMPLETE', to: 'DESTROYED' },
  { from: 'ERROR', event: 'MANUAL_RECOVERY', to: 'INITIAL' },
  { from: 'DESTROYED', event: 'NEW_BOOT_CYCLE', to: 'INITIAL' },
];

describe('MOD-002 Session State Machine — TICKET-MOD-002-SESSION-STATE-MACHINE-001', () => {
  it('defines exactly 9 official states', () => {
    expect(SESSION_STATE_MACHINE_STATES).toHaveLength(9);
    expect(new Set(SESSION_STATE_MACHINE_STATES).size).toBe(9);
  });

  it('exports 21 canonical transitions from SESSION-STATE-MACHINE.md', () => {
    expect(SESSION_TRANSITION_TABLE).toHaveLength(21);
  });

  it('accepts every listed valid transition via assertTransition', () => {
    for (const rule of VALID_TRANSITIONS) {
      expect(() => assertTransition(rule.from, rule.to, rule.event)).not.toThrow();
      expect(isValidTransition(rule.from, rule.to, rule.event)).toBe(true);
    }
  });

  it('returns INITIAL on module load entry', () => {
    expect(getEntryState()).toBe('INITIAL');
  });

  it('lists valid transitions from a stable state', () => {
    const fromAuthenticated = listValidTransitionsFrom('AUTHENTICATED');
    expect(fromAuthenticated.map((rule) => rule.event)).toEqual(
      expect.arrayContaining(['USER_LOGIN', 'PERMISSION_CHANGED', 'REFRESH_START', 'EXPIRY_DETECTED', 'USER_LOGOUT']),
    );
  });

  describe('illegal transitions', () => {
    const illegalCases: Array<{
      from: SessionStateMachineState | null;
      event: SessionTransitionEvent;
      to: SessionStateMachineState;
    }> = [
      { from: 'INITIAL', event: 'MODULE_LOAD', to: 'LOADING' },
      { from: 'LOADING', event: 'SYSTEM_READY', to: 'AUTHENTICATED' },
      { from: 'ANONYMOUS', event: 'REFRESH_START', to: 'REFRESHING' },
      { from: 'REFRESHING', event: 'USER_LOGOUT', to: 'LOGGING_OUT' },
      { from: 'DESTROYED', event: 'USER_LOGIN', to: 'LOADING' },
      { from: 'ERROR', event: 'USER_LOGOUT', to: 'LOGGING_OUT' },
      { from: 'AUTHENTICATED', event: 'TEARDOWN_COMPLETE', to: 'DESTROYED' },
      { from: null, event: 'SYSTEM_READY', to: 'LOADING' },
      { from: 'INITIAL', event: 'USER_LOGIN', to: 'LOADING' },
    ];

    it.each(illegalCases)('rejects $from + $event -> $to', ({ from, event, to }) => {
      expect(isValidTransition(from, to, event)).toBe(false);
      expect(() => assertTransition(from, to, event)).toThrow(SessionError);
      try {
        assertTransition(from, to, event);
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        if (error instanceof SessionError) {
          expect(error.code).toBe('SESSION_ERROR_ILLEGAL_TRANSITION');
        }
      }
    });
  });

  it('rejects self-transitions not explicitly listed', () => {
    expect(isValidTransition('LOADING', 'LOADING', 'SYSTEM_READY')).toBe(false);
    expect(isValidTransition('INITIAL', 'INITIAL', 'SYSTEM_READY')).toBe(false);
  });
});
