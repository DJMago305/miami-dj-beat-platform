/** LC-8 — Legal document submission statuses */

export const LEGAL_DOCUMENT_SUBMISSION_STATUSES = [
  'pending_upload',
  'uploaded',
  'under_review',
  'accepted',
  'rejected',
  'deleted',
] as const;

export type LegalDocumentSubmissionStatus = (typeof LEGAL_DOCUMENT_SUBMISSION_STATUSES)[number];

export const TERMINAL_LEGAL_DOCUMENT_SUBMISSION_STATUSES = [
  'accepted',
  'rejected',
  'deleted',
] as const satisfies readonly LegalDocumentSubmissionStatus[];

export type TerminalLegalDocumentSubmissionStatus =
  (typeof TERMINAL_LEGAL_DOCUMENT_SUBMISSION_STATUSES)[number];

export function isTerminalLegalDocumentSubmissionStatus(
  status: LegalDocumentSubmissionStatus,
): status is TerminalLegalDocumentSubmissionStatus {
  return (TERMINAL_LEGAL_DOCUMENT_SUBMISSION_STATUSES as readonly string[]).includes(status);
}

export function isActiveLegalDocumentSubmissionStatus(status: LegalDocumentSubmissionStatus): boolean {
  return status !== 'deleted';
}
