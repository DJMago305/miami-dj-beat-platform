/** LC-8 — Legal document submission factory */

import type { LegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import { createSystemLegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import {
  legalDocumentSubmissionError,
  legalDocumentSubmissionSuccess,
  type LegalDocumentSubmissionResult,
} from './legal-document-submission-errors';
import {
  buildStorageKey,
  formatLegalDocumentSubmissionId,
  freezeLegalDocumentSubmission,
  isValidLegalDocumentSubmissionId,
} from './legal-document-submission-immutability';
import type {
  LegalDocumentSubmission,
  StoreLegalDocumentSubmissionInput,
} from './legal-document-submission-types';
import {
  validateSubmissionChecksum,
  validateSubmissionContentReference,
  validateSubmissionFilename,
  validateSubmissionMimeType,
  validateSubmissionSizeBytes,
} from './legal-document-submission-validation';

export type CreateLegalDocumentSubmissionDependencies = {
  readonly clock?: LegalDocumentInstanceClock;
  readonly nextSequence?: () => number;
};

export function createLegalDocumentSubmission(
  input: StoreLegalDocumentSubmissionInput,
  dependencies: CreateLegalDocumentSubmissionDependencies = {},
): LegalDocumentSubmissionResult<LegalDocumentSubmission> {
  const clock = dependencies.clock ?? createSystemLegalDocumentInstanceClock();
  const now = clock.now();

  const mimeResult = validateSubmissionMimeType(input.mimeType);
  if (!mimeResult.ok) {
    return mimeResult;
  }
  const sizeResult = validateSubmissionSizeBytes(input.sizeBytes);
  if (!sizeResult.ok) {
    return sizeResult;
  }
  const filenameResult = validateSubmissionFilename(input.filename);
  if (!filenameResult.ok) {
    return filenameResult;
  }
  const checksumResult = validateSubmissionChecksum(input.checksum);
  if (!checksumResult.ok) {
    return checksumResult;
  }

  if (!input.documentInstanceId.trim() || !input.templateId.trim() || !input.templateVersionId.trim()) {
    return legalDocumentSubmissionError(
      'invalid_submission_input',
      'documentInstanceId, templateId, and templateVersionId are required.',
    );
  }

  const contentReferenceResult = validateSubmissionContentReference(input.contentReference);
  if (!contentReferenceResult.ok) {
    return contentReferenceResult;
  }

  let id: string;
  if (input.id !== undefined) {
    if (!isValidLegalDocumentSubmissionId(input.id)) {
      return legalDocumentSubmissionError(
        'invalid_submission_input',
        'Submission id must match LDS-###### pattern.',
      );
    }
    id = input.id.trim();
  } else {
    const sequence = dependencies.nextSequence?.();
    if (sequence === undefined || !Number.isInteger(sequence) || sequence < 1) {
      return legalDocumentSubmissionError(
        'invalid_submission_input',
        'Auto-generated submission ids require nextSequence().',
      );
    }
    id = formatLegalDocumentSubmissionId(sequence);
  }

  const storageKey = buildStorageKey(input.documentInstanceId.trim(), id);
  const initialStatus = input.initialStatus ?? 'uploaded';

  return legalDocumentSubmissionSuccess(
    freezeLegalDocumentSubmission({
      id,
      documentInstanceId: input.documentInstanceId.trim(),
      ...(input.workflowId ? { workflowId: input.workflowId.trim() } : {}),
      templateId: input.templateId.trim(),
      templateVersionId: input.templateVersionId.trim(),
      storageKey,
      filename: filenameResult.value,
      mimeType: mimeResult.value,
      sizeBytes: sizeResult.value,
      checksum: checksumResult.value,
      contentReference: contentReferenceResult.value,
      createdAt: now,
      submittedBy: Object.freeze({ ...input.submittedBy }),
      submittedAt: now,
      updatedAt: now,
      status: initialStatus,
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    }),
  );
}
