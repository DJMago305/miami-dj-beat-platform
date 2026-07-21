/** LC-6 — Legal document instance domain errors */

import type { LegalDocumentInstanceStatus } from './legal-document-instance-status';

export type LegalDocumentInstanceErrorCode =
  | 'instance_not_found'
  | 'duplicate_instance_id'
  | 'invalid_status_transition'
  | 'invalid_instance_version'
  | 'invalid_recipient'
  | 'invalid_template_reference'
  | 'already_terminal'
  | 'expiration_not_allowed'
  | 'expiration_not_due'
  | 'invalid_instance_timestamp';

export type LegalDocumentInstanceError = {
  readonly ok: false;
  readonly code: LegalDocumentInstanceErrorCode;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
};

export type LegalDocumentInstanceResult<T> =
  | { readonly ok: true; readonly value: T }
  | LegalDocumentInstanceError;

export function legalDocumentInstanceError(
  code: LegalDocumentInstanceErrorCode,
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): LegalDocumentInstanceError {
  return Object.freeze({
    ok: false,
    code,
    message,
    ...(metadata ? { metadata: Object.freeze({ ...metadata }) } : {}),
  });
}

export function legalDocumentInstanceSuccess<T>(value: T): LegalDocumentInstanceResult<T> {
  return Object.freeze({ ok: true, value });
}

export function transitionErrorMetadata(
  currentStatus: LegalDocumentInstanceStatus,
  nextStatus: LegalDocumentInstanceStatus,
): Readonly<Record<string, string>> {
  return Object.freeze({ currentStatus, nextStatus });
}
