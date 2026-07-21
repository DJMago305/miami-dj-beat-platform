/** LC-8 — Legal document submission errors */

import type { LegalDocumentSubmissionStatus } from './legal-document-submission-status';

export type LegalDocumentSubmissionErrorCode =
  | 'submission_not_found'
  | 'duplicate_submission_id'
  | 'invalid_submission_status_transition'
  | 'submission_already_terminal'
  | 'invalid_mime_type'
  | 'submission_too_large'
  | 'invalid_filename'
  | 'invalid_checksum'
  | 'invalid_submission_input'
  | 'submission_actor_not_authorized'
  | 'submission_workflow_not_ready'
  | 'submission_instance_mismatch'
  | 'submission_replace_not_allowed'
  | 'submission_coordination_failed';

export type LegalDocumentSubmissionError = {
  readonly ok: false;
  readonly code: LegalDocumentSubmissionErrorCode;
  readonly message: string;
  readonly context?: Readonly<Record<string, string | number | boolean | null>>;
};

export type LegalDocumentSubmissionResult<T> =
  | { readonly ok: true; readonly value: T }
  | LegalDocumentSubmissionError;

export function legalDocumentSubmissionError(
  code: LegalDocumentSubmissionErrorCode,
  message: string,
  context?: Readonly<Record<string, string | number | boolean | null>>,
): LegalDocumentSubmissionError {
  return Object.freeze({
    ok: false,
    code,
    message,
    ...(context ? { context: Object.freeze({ ...context }) } : {}),
  });
}

export function legalDocumentSubmissionSuccess<T>(value: T): LegalDocumentSubmissionResult<T> {
  return Object.freeze({ ok: true, value });
}

export function submissionTransitionContext(
  currentStatus: LegalDocumentSubmissionStatus,
  nextStatus: LegalDocumentSubmissionStatus,
): Readonly<Record<string, string>> {
  return Object.freeze({ currentStatus, nextStatus });
}
