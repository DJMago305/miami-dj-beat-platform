/** LC-7 — W-9 workflow errors */

import type { LegalW9RequestStatus } from './legal-w9-request-status';

export type LegalW9WorkflowErrorCode =
  | 'w9_request_not_found'
  | 'w9_duplicate_request_id'
  | 'w9_actor_not_authorized'
  | 'w9_recipient_not_allowed'
  | 'w9_invalid_recipient'
  | 'w9_invalid_due_at'
  | 'w9_invalid_status_transition'
  | 'w9_instance_creation_failed'
  | 'w9_instance_transition_failed'
  | 'w9_request_already_terminal'
  | 'w9_expiration_not_due'
  | 'w9_template_unavailable'
  | 'w9_active_request_exists';

export type LegalW9WorkflowError = {
  readonly ok: false;
  readonly code: LegalW9WorkflowErrorCode;
  readonly message: string;
  readonly context?: Readonly<Record<string, string | number | boolean | null>>;
};

export type LegalW9WorkflowResult<T> = { readonly ok: true; readonly value: T } | LegalW9WorkflowError;

export function legalW9WorkflowError(
  code: LegalW9WorkflowErrorCode,
  message: string,
  context?: Readonly<Record<string, string | number | boolean | null>>,
): LegalW9WorkflowError {
  return Object.freeze({
    ok: false,
    code,
    message,
    ...(context ? { context: Object.freeze({ ...context }) } : {}),
  });
}

export function legalW9WorkflowSuccess<T>(value: T): LegalW9WorkflowResult<T> {
  return Object.freeze({ ok: true, value });
}

export function w9TransitionContext(
  currentStatus: LegalW9RequestStatus,
  nextStatus: LegalW9RequestStatus,
): Readonly<Record<string, string>> {
  return Object.freeze({ currentStatus, nextStatus });
}
