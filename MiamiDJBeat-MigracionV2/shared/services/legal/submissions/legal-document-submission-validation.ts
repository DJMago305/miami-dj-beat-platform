/** LC-8 — Submission input validation */

import {
  legalDocumentSubmissionError,
  legalDocumentSubmissionSuccess,
  type LegalDocumentSubmissionResult,
} from './legal-document-submission-errors';
import {
  LEGAL_DOCUMENT_SUBMISSION_ALLOWED_MIME_TYPES,
  LEGAL_DOCUMENT_SUBMISSION_MAX_BYTES,
} from './legal-document-submission-types';

const UNSAFE_FILENAME_PATTERN = /(\.\.|\/|\\|\0|[\u0000-\u001f])/;

/** Expected digest format: algorithm:encoded-digest (e.g. sha256:abc123). */
const CHECKSUM_PATTERN = /^[a-z0-9_-]+:[A-Za-z0-9+/=_-]{8,}$/;

/** LC-8 metadata pointer — not a public URL. */
const CONTENT_REFERENCE_PATTERN = /^in-memory:\/\/[a-zA-Z0-9/_.-]+$/;

export function isValidSubmissionFilename(filename: string): boolean {
  const trimmed = filename.trim();
  return trimmed.length > 0 && !UNSAFE_FILENAME_PATTERN.test(trimmed);
}

export function isValidSubmissionChecksum(checksum: string): boolean {
  const trimmed = checksum.trim();
  return CHECKSUM_PATTERN.test(trimmed);
}

export function isValidSubmissionContentReference(contentReference: string): boolean {
  const trimmed = contentReference.trim();
  return CONTENT_REFERENCE_PATTERN.test(trimmed);
}

export function validateSubmissionMimeType(
  mimeType: string,
): LegalDocumentSubmissionResult<typeof LEGAL_DOCUMENT_SUBMISSION_ALLOWED_MIME_TYPES[number]> {
  if (!LEGAL_DOCUMENT_SUBMISSION_ALLOWED_MIME_TYPES.includes(mimeType as typeof LEGAL_DOCUMENT_SUBMISSION_ALLOWED_MIME_TYPES[number])) {
    return legalDocumentSubmissionError(
      'invalid_mime_type',
      'Only application/pdf submissions are allowed.',
      Object.freeze({ mimeType }),
    );
  }
  return legalDocumentSubmissionSuccess(mimeType as typeof LEGAL_DOCUMENT_SUBMISSION_ALLOWED_MIME_TYPES[number]);
}

export function validateSubmissionSizeBytes(
  sizeBytes: number,
): LegalDocumentSubmissionResult<number> {
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1) {
    return legalDocumentSubmissionError('invalid_submission_input', 'sizeBytes must be a positive integer.');
  }
  if (sizeBytes > LEGAL_DOCUMENT_SUBMISSION_MAX_BYTES) {
    return legalDocumentSubmissionError(
      'submission_too_large',
      `Submission exceeds ${LEGAL_DOCUMENT_SUBMISSION_MAX_BYTES} bytes.`,
      Object.freeze({ sizeBytes, maxBytes: LEGAL_DOCUMENT_SUBMISSION_MAX_BYTES }),
    );
  }
  return legalDocumentSubmissionSuccess(sizeBytes);
}

export function validateSubmissionFilename(
  filename: string,
): LegalDocumentSubmissionResult<string> {
  if (!isValidSubmissionFilename(filename)) {
    return legalDocumentSubmissionError(
      'invalid_filename',
      'filename must be non-empty and must not contain path traversal characters.',
      Object.freeze({ filename }),
    );
  }
  return legalDocumentSubmissionSuccess(filename.trim());
}

export function validateSubmissionChecksum(
  checksum: string,
): LegalDocumentSubmissionResult<string> {
  if (!isValidSubmissionChecksum(checksum)) {
    return legalDocumentSubmissionError(
      'invalid_checksum',
      'checksum must use algorithm:encoded-digest format (e.g. sha256:...).',
      Object.freeze({ checksum }),
    );
  }
  return legalDocumentSubmissionSuccess(checksum.trim());
}

export function validateSubmissionContentReference(
  contentReference: string,
): LegalDocumentSubmissionResult<string> {
  if (!isValidSubmissionContentReference(contentReference)) {
    return legalDocumentSubmissionError(
      'invalid_submission_input',
      'contentReference must be an in-memory metadata pointer (in-memory://...).',
      Object.freeze({ contentReference }),
    );
  }
  return legalDocumentSubmissionSuccess(contentReference.trim());
}
