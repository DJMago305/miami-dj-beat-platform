/** LC-8 — Legal document submission transitions */

import {
  legalDocumentSubmissionError,
  legalDocumentSubmissionSuccess,
  submissionTransitionContext,
  type LegalDocumentSubmissionResult,
} from './legal-document-submission-errors';
import { freezeLegalDocumentSubmission } from './legal-document-submission-immutability';
import type { LegalDocumentSubmission } from './legal-document-submission-types';
import {
  isTerminalLegalDocumentSubmissionStatus,
  type LegalDocumentSubmissionStatus,
} from './legal-document-submission-status';

const ALLOWED_TRANSITIONS = {
  pending_upload: ['uploaded', 'deleted'],
  uploaded: ['under_review', 'deleted'],
  under_review: ['accepted', 'rejected', 'deleted'],
  accepted: [],
  rejected: [],
  deleted: [],
} as const satisfies Record<
  LegalDocumentSubmissionStatus,
  readonly LegalDocumentSubmissionStatus[]
>;

export function canTransitionSubmissionStatus(
  currentStatus: LegalDocumentSubmissionStatus,
  nextStatus: LegalDocumentSubmissionStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return false;
  }
  if (isTerminalLegalDocumentSubmissionStatus(currentStatus)) {
    return false;
  }
  return (ALLOWED_TRANSITIONS[currentStatus] as readonly LegalDocumentSubmissionStatus[]).includes(
    nextStatus,
  );
}

export function transitionSubmissionStatus(
  submission: LegalDocumentSubmission,
  nextStatus: LegalDocumentSubmissionStatus,
  updatedAt: string,
): LegalDocumentSubmissionResult<LegalDocumentSubmission> {
  if (isTerminalLegalDocumentSubmissionStatus(submission.status)) {
    return legalDocumentSubmissionError(
      'submission_already_terminal',
      `Submission ${submission.id} is terminal (${submission.status}).`,
      Object.freeze({ status: submission.status }),
    );
  }

  if (submission.status === nextStatus) {
    return legalDocumentSubmissionSuccess(
      freezeLegalDocumentSubmission({ ...submission, updatedAt }),
    );
  }

  if (!canTransitionSubmissionStatus(submission.status, nextStatus)) {
    return legalDocumentSubmissionError(
      'invalid_submission_status_transition',
      `Cannot transition submission ${submission.id} from ${submission.status} to ${nextStatus}.`,
      submissionTransitionContext(submission.status, nextStatus),
    );
  }

  return legalDocumentSubmissionSuccess(
    freezeLegalDocumentSubmission({
      ...submission,
      status: nextStatus,
      updatedAt,
    }),
  );
}

export function toSubmissionPublicView(
  submission: LegalDocumentSubmission,
): import('./legal-document-submission-types').LegalDocumentSubmissionPublicView {
  return Object.freeze({
    id: submission.id,
    workflowId: submission.workflowId,
    filename: submission.filename,
    mimeType: submission.mimeType,
    sizeBytes: submission.sizeBytes,
    status: submission.status,
    submittedAt: submission.submittedAt,
    updatedAt: submission.updatedAt,
    statusLabel: submissionStatusLabel(submission.status),
  });
}

export function submissionStatusLabel(status: LegalDocumentSubmissionStatus): string {
  switch (status) {
    case 'pending_upload':
      return 'Awaiting upload';
    case 'uploaded':
      return 'Uploaded';
    case 'under_review':
      return 'Under review';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'deleted':
      return 'Deleted';
    default:
      return status;
  }
}
