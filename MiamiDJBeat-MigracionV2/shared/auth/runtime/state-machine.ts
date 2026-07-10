/** MOD-001 Authentication — state machine — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

import { AuthError } from './errors';
import type { AuthLifecycleState, AuthTransitionEvent, AuthTransitionFrom } from './types';

export const AUTH_STATE_MACHINE_STATES = [
  'UNKNOWN',
  'CHECKING_EXISTING_AUTH',
  'UNAUTHENTICATED',
  'AUTHENTICATING',
  'AUTHENTICATED_IDENTITY_RECEIVED',
  'SESSION_HANDOFF_PENDING',
  'SESSION_HANDOFF_SUCCEEDED',
  'REFRESHING',
  'EXPIRED',
  'LOGGING_OUT',
  'LOGGED_OUT',
  'FAILED',
] as const satisfies readonly AuthLifecycleState[];

type TransitionRule = {
  readonly from: AuthTransitionFrom;
  readonly event: AuthTransitionEvent;
  readonly to: AuthLifecycleState;
};

/** Canonical transition table — AUTH-LIFECYCLE.md */
export const AUTH_TRANSITION_TABLE: readonly TransitionRule[] = [
  { from: null, event: 'BOOT_START', to: 'UNKNOWN' },
  { from: 'UNKNOWN', event: 'BOOT_START', to: 'CHECKING_EXISTING_AUTH' },
  { from: 'CHECKING_EXISTING_AUTH', event: 'RESTORE_EMPTY', to: 'UNAUTHENTICATED' },
  { from: 'CHECKING_EXISTING_AUTH', event: 'RESTORE_FOUND', to: 'AUTHENTICATED_IDENTITY_RECEIVED' },
  { from: 'CHECKING_EXISTING_AUTH', event: 'SIGN_IN_FAIL', to: 'UNAUTHENTICATED' },
  { from: 'UNAUTHENTICATED', event: 'SIGN_IN_REQUEST', to: 'AUTHENTICATING' },
  { from: 'AUTHENTICATING', event: 'SIGN_IN_SUCCESS', to: 'AUTHENTICATED_IDENTITY_RECEIVED' },
  { from: 'AUTHENTICATING', event: 'SIGN_IN_FAIL', to: 'FAILED' },
  { from: 'AUTHENTICATED_IDENTITY_RECEIVED', event: 'USER_LOGIN_EMITTED', to: 'SESSION_HANDOFF_PENDING' },
  { from: 'SESSION_HANDOFF_PENDING', event: 'HANDOFF_ACCEPTED', to: 'SESSION_HANDOFF_SUCCEEDED' },
  { from: 'SESSION_HANDOFF_PENDING', event: 'HANDOFF_REJECTED', to: 'FAILED' },
  { from: 'SESSION_HANDOFF_SUCCEEDED', event: 'REFRESH_REQUEST', to: 'REFRESHING' },
  { from: 'SESSION_HANDOFF_SUCCEEDED', event: 'SIGN_OUT_REQUEST', to: 'LOGGING_OUT' },
  { from: 'SESSION_HANDOFF_SUCCEEDED', event: 'TOKEN_EXPIRED', to: 'EXPIRED' },
  { from: 'REFRESHING', event: 'REFRESH_SUCCESS', to: 'SESSION_HANDOFF_SUCCEEDED' },
  { from: 'REFRESHING', event: 'USER_LOGIN_EMITTED', to: 'SESSION_HANDOFF_PENDING' },
  { from: 'REFRESHING', event: 'HANDOFF_ACCEPTED', to: 'SESSION_HANDOFF_SUCCEEDED' },
  { from: 'REFRESHING', event: 'HANDOFF_REJECTED', to: 'FAILED' },
  { from: 'REFRESHING', event: 'REFRESH_FAIL', to: 'EXPIRED' },
  { from: 'EXPIRED', event: 'RESET_TO_ANONYMOUS', to: 'UNAUTHENTICATED' },
  { from: 'EXPIRED', event: 'SIGN_IN_REQUEST', to: 'AUTHENTICATING' },
  { from: 'LOGGING_OUT', event: 'SIGN_OUT_SUCCESS', to: 'LOGGED_OUT' },
  { from: 'LOGGING_OUT', event: 'SIGN_OUT_FAIL', to: 'FAILED' },
  { from: 'LOGGED_OUT', event: 'RESET_TO_ANONYMOUS', to: 'UNAUTHENTICATED' },
  { from: 'FAILED', event: 'RESET_TO_ANONYMOUS', to: 'UNAUTHENTICATED' },
] as const;

function transitionKey(
  from: AuthTransitionFrom,
  event: AuthTransitionEvent,
  to: AuthLifecycleState,
): string {
  return `${from ?? 'ENTRY'}|${event}|${to}`;
}

const ALLOWED_TRANSITIONS = new Set(
  AUTH_TRANSITION_TABLE.map((rule) => transitionKey(rule.from, rule.event, rule.to)),
);

function formatTransition(
  from: AuthTransitionFrom,
  event: AuthTransitionEvent,
  to: AuthLifecycleState,
): string {
  const fromLabel = from ?? 'ENTRY';
  return `${fromLabel} --[${event}]--> ${to}`;
}

export function isValidAuthTransition(
  from: AuthTransitionFrom,
  to: AuthLifecycleState,
  event: AuthTransitionEvent,
): boolean {
  return ALLOWED_TRANSITIONS.has(transitionKey(from, event, to));
}

export function assertAuthTransition(
  from: AuthTransitionFrom,
  to: AuthLifecycleState,
  event: AuthTransitionEvent,
): void {
  if (isValidAuthTransition(from, to, event)) {
    return;
  }

  throw new AuthError(
    'ERR-AUTH-001',
    `Illegal auth transition: ${formatTransition(from, event, to)}`,
  );
}

export function getAuthEntryState(): AuthLifecycleState {
  assertAuthTransition(null, 'UNKNOWN', 'BOOT_START');
  return 'UNKNOWN';
}
