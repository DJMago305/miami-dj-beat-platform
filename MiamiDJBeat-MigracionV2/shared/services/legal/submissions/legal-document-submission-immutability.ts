/** LC-8 — Legal document submission immutability */

import type { LegalDocumentSubmission } from './legal-document-submission-types';

export function freezeLegalDocumentSubmission(
  submission: LegalDocumentSubmission,
): LegalDocumentSubmission {
  return Object.freeze({
    ...submission,
    submittedBy: Object.freeze({ ...submission.submittedBy }),
    metadata: Object.freeze({ ...submission.metadata }),
  });
}

export function cloneLegalDocumentSubmission(
  submission: LegalDocumentSubmission,
): LegalDocumentSubmission {
  return freezeLegalDocumentSubmission({
    ...submission,
    submittedBy: { ...submission.submittedBy },
    metadata: { ...submission.metadata },
  });
}

export function parseLegalDocumentSubmissionSequence(id: string): number | null {
  const match = /^LDS-(\d+)$/.exec(id.trim());
  if (!match) {
    return null;
  }
  const numeric = Number.parseInt(match[1], 10);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return null;
  }
  return numeric;
}

export function formatLegalDocumentSubmissionId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('Legal document submission sequence must be a positive integer.');
  }
  return `LDS-${String(sequence).padStart(6, '0')}`;
}

export function bumpSubmissionSequenceFloor(currentSequence: number, submissionId: string): number {
  const parsed = parseLegalDocumentSubmissionSequence(submissionId);
  if (parsed === null) {
    return currentSequence;
  }
  return Math.max(currentSequence, parsed);
}

export function isValidLegalDocumentSubmissionId(value: string): boolean {
  return /^LDS-\d{6,}$/.test(value.trim());
}

export function buildStorageKey(documentInstanceId: string, submissionId: string): string {
  return `legal/submissions/${documentInstanceId}/${submissionId}`;
}
