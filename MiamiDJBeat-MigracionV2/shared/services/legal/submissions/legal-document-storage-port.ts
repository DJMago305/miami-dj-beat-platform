/** LC-8 — Legal document storage port */

import type { LegalDocumentSubmissionStatus } from './legal-document-submission-status';
import type { LegalDocumentSubmissionResult } from './legal-document-submission-errors';
import type {
  LegalDocumentSubmission,
  LegalDocumentSubmissionId,
  ReplaceLegalDocumentSubmissionInput,
  StoreLegalDocumentSubmissionInput,
} from './legal-document-submission-types';

export type LegalDocumentStoragePort = {
  storeSubmission(
    input: StoreLegalDocumentSubmissionInput,
  ): LegalDocumentSubmissionResult<LegalDocumentSubmission>;
  getSubmission(id: LegalDocumentSubmissionId): LegalDocumentSubmissionResult<LegalDocumentSubmission>;
  listSubmissions(): readonly LegalDocumentSubmission[];
  listSubmissionsIncludingDeleted(): readonly LegalDocumentSubmission[];
  listSubmissionsByInstance(documentInstanceId: string): readonly LegalDocumentSubmission[];
  listSubmissionsByWorkflow(workflowId: string): readonly LegalDocumentSubmission[];
  purgeUnlinkedSubmission(id: LegalDocumentSubmissionId): LegalDocumentSubmissionResult<true>;
  deleteSubmission(id: LegalDocumentSubmissionId): LegalDocumentSubmissionResult<LegalDocumentSubmission>;
  replaceSubmission(
    id: LegalDocumentSubmissionId,
    input: ReplaceLegalDocumentSubmissionInput,
  ): LegalDocumentSubmissionResult<LegalDocumentSubmission>;
  transitionSubmission(
    id: LegalDocumentSubmissionId,
    nextStatus: LegalDocumentSubmissionStatus,
  ): LegalDocumentSubmissionResult<LegalDocumentSubmission>;
  exists(id: LegalDocumentSubmissionId): boolean;
};
