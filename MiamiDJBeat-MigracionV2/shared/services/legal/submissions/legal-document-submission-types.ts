/** LC-8 — Legal document submission types */

import type { LegalDocumentSubmissionStatus } from './legal-document-submission-status';

export type LegalDocumentSubmissionId = string;

export const LEGAL_DOCUMENT_SUBMISSION_MAX_BYTES = 20 * 1024 * 1024;

export const LEGAL_DOCUMENT_SUBMISSION_ALLOWED_MIME_TYPES = ['application/pdf'] as const;

export type LegalDocumentSubmissionMetadata = Readonly<
  Record<string, string | number | boolean | null>
>;

export type StoredDocumentAsset = {
  readonly storageKey: string;
  readonly filename: string;
  readonly mimeType: typeof LEGAL_DOCUMENT_SUBMISSION_ALLOWED_MIME_TYPES[number];
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly contentReference: string;
  readonly createdAt: string;
};

export type LegalDocumentSubmissionSubmittedBy = {
  readonly actorId: string;
  readonly displayName: string;
  readonly portal: 'staff' | 'artist' | 'client';
  readonly role?: 'owner' | 'manager' | 'seller';
};

export type LegalDocumentSubmission = StoredDocumentAsset & {
  readonly id: LegalDocumentSubmissionId;
  readonly documentInstanceId: string;
  readonly workflowId?: string;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly submittedBy: LegalDocumentSubmissionSubmittedBy;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly status: LegalDocumentSubmissionStatus;
  readonly metadata: LegalDocumentSubmissionMetadata;
};

/** Public-safe projection — no internal storageKey or checksum in UI/DOM. */
export type LegalDocumentSubmissionPublicView = {
  readonly id: LegalDocumentSubmissionId;
  readonly workflowId?: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly status: LegalDocumentSubmissionStatus;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly statusLabel: string;
};

export type StoreLegalDocumentSubmissionInput = {
  readonly id?: LegalDocumentSubmissionId;
  readonly documentInstanceId: string;
  readonly workflowId?: string;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly contentReference: string;
  readonly submittedBy: LegalDocumentSubmissionSubmittedBy;
  readonly metadata?: LegalDocumentSubmissionMetadata;
  readonly initialStatus?: 'pending_upload' | 'uploaded';
};

export type ReplaceLegalDocumentSubmissionInput = Omit<
  StoreLegalDocumentSubmissionInput,
  'id' | 'initialStatus' | 'documentInstanceId' | 'workflowId'
> & {
  readonly workflowId?: string;
};
