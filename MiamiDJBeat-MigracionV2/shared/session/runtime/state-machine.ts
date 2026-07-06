/** MOD-002 Session Manager — state machine — TICKET-MOD-002-SESSION-STATE-MACHINE-001 */

import { SessionError } from './errors';
import type { SessionStateMachineState, SessionTransitionEvent, SessionTransitionFrom } from './types';

/** Official 9 states — SESSION-STATE-MACHINE.md */
export const SESSION_STATE_MACHINE_STATES = [
  'INITIAL',
  'LOADING',
  'AUTHENTICATED',
  'ANONYMOUS',
  'EXPIRED',
  'REFRESHING',
  'LOGGING_OUT',
  'DESTROYED',
  'ERROR',
] as const satisfies readonly SessionStateMachineState[];

type TransitionRule = {
  readonly from: SessionTransitionFrom;
  readonly event: SessionTransitionEvent;
  readonly to: SessionStateMachineState;
};

/** Canonical transition table — SESSION-STATE-MACHINE.md § Tabla de transiciones */
export const SESSION_TRANSITION_TABLE: readonly TransitionRule[] = [
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
] as const;

function transitionKey(
  from: SessionTransitionFrom,
  event: SessionTransitionEvent,
  to: SessionStateMachineState,
): string {
  return `${from ?? 'ENTRY'}|${event}|${to}`;
}

const ALLOWED_TRANSITIONS = new Set(
  SESSION_TRANSITION_TABLE.map((rule) => transitionKey(rule.from, rule.event, rule.to)),
);

function formatTransition(from: SessionTransitionFrom, event: SessionTransitionEvent, to: SessionStateMachineState): string {
  const fromLabel = from ?? 'ENTRY';
  return `${fromLabel} --[${event}]--> ${to}`;
}

/** Returns true when the transition is listed in the official table. */
export function isValidTransition(
  from: SessionTransitionFrom,
  to: SessionStateMachineState,
  event: SessionTransitionEvent,
): boolean {
  return ALLOWED_TRANSITIONS.has(transitionKey(from, event, to));
}

/**
 * Validates a session state transition against SESSION-STATE-MACHINE.md.
 * @throws {SessionError} SESSION_ERROR_ILLEGAL_TRANSITION when not allowed
 */
export function assertTransition(
  from: SessionTransitionFrom,
  to: SessionStateMachineState,
  event: SessionTransitionEvent,
): void {
  if (isValidTransition(from, to, event)) {
    return;
  }

  throw new SessionError(
    'SESSION_ERROR_ILLEGAL_TRANSITION',
    `Illegal session transition: ${formatTransition(from, event, to)}`,
  );
}

/** Entry state after MODULE_LOAD — not wired to boot in Phase 1. */
export function getEntryState(): SessionStateMachineState {
  assertTransition(null, 'INITIAL', 'MODULE_LOAD');
  return 'INITIAL';
}

/** Lists all legal (event, to) pairs from a given state. */
export function listValidTransitionsFrom(from: SessionTransitionFrom): readonly TransitionRule[] {
  return SESSION_TRANSITION_TABLE.filter((rule) => rule.from === from);
}
