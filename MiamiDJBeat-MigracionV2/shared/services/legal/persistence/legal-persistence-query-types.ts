/** LC-11 — Legal persistence read queries */

import type { LegalDocumentInstanceStatus } from '../domain/legal-document-instance-status';
import type { LegalDocumentSubmissionStatus } from '../submissions/legal-document-submission-status';
import type { LegalW9RequestStatus } from '../workflows/legal-w9-request-status';
import type { LegalAuditAction } from '../audit/legal-audit-action';
import type { LegalAuditEntityType } from '../audit/legal-audit-event-types';

export type LegalReadQueryBase = {
  readonly limit?: number;
  readonly cursor?: string;
};

export type LegalTemplateListQuery = LegalReadQueryBase & {
  readonly category?: string;
  readonly status?: string;
};

export type LegalDocumentInstanceListQuery = LegalReadQueryBase & {
  readonly status?: LegalDocumentInstanceStatus;
  readonly templateId?: string;
  readonly recipientType?: string;
  readonly recipientId?: string;
};

export type LegalW9RequestListQuery = LegalReadQueryBase & {
  readonly status?: LegalW9RequestStatus;
  readonly recipientType?: string;
  readonly recipientId?: string;
  readonly templateId?: string;
};

export type LegalDocumentSubmissionListQuery = LegalReadQueryBase & {
  readonly status?: LegalDocumentSubmissionStatus;
  readonly instanceId?: string;
  readonly workflowId?: string;
  readonly includeDeleted?: boolean;
};

export type LegalAuditEventListQuery = LegalReadQueryBase & {
  readonly entityType?: LegalAuditEntityType;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly action?: LegalAuditAction;
  readonly correlationId?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
};
