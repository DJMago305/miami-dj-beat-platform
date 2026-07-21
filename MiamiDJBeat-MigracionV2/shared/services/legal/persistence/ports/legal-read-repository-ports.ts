/** LC-11 — Legal read repository ports (read-only) */

import type { LegalTemplate } from '../../contracts/legal-entities';
import type { LegalAuditEvent } from '../../audit/legal-audit-event-types';
import type { LegalDocumentInstance } from '../../domain/legal-document-instance-types';
import type { LegalDocumentSubmission } from '../../submissions/legal-document-submission-types';
import type { LegalW9Request } from '../../workflows/legal-w9-request-types';
import type { LegalTemplateAssetCatalogEntry } from '../../assets/legal-template-asset-types';
import type { LegalPersistenceResult } from '../legal-persistence-errors';
import type { LegalReadPage } from '../legal-persistence-page';
import type {
  LegalAuditEventListQuery,
  LegalDocumentInstanceListQuery,
  LegalDocumentSubmissionListQuery,
  LegalReadQueryBase,
  LegalTemplateListQuery,
  LegalW9RequestListQuery,
} from '../legal-persistence-query-types';
import type { LegalReadAccessContext } from '../legal-read-access-context';
import type { TemplateVersionReadModel } from '../mappers/legal-persistence-mappers';

export type LegalTemplateReadRepositoryPort = {
  getTemplateById(
    context: LegalReadAccessContext,
    templateId: string,
  ): Promise<LegalPersistenceResult<LegalTemplate>>;
  getTemplateVersionById(
    context: LegalReadAccessContext,
    templateVersionId: string,
  ): Promise<LegalPersistenceResult<TemplateVersionReadModel>>;
  listTemplates(
    context: LegalReadAccessContext,
    query?: LegalTemplateListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalTemplate>>>;
  listTemplateVersions(
    context: LegalReadAccessContext,
    templateId: string,
    query?: LegalReadQueryBase,
  ): Promise<LegalPersistenceResult<LegalReadPage<TemplateVersionReadModel>>>;
  listTemplateAssets(
    context: LegalReadAccessContext,
    templateId: string,
    query?: LegalReadQueryBase,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalTemplateAssetCatalogEntry>>>;
  getTemplateAssetMetadata(
    context: LegalReadAccessContext,
    assetKey: string,
  ): Promise<LegalPersistenceResult<LegalTemplateAssetCatalogEntry>>;
};

export type LegalDocumentInstanceReadRepositoryPort = {
  getInstanceById(
    context: LegalReadAccessContext,
    instanceId: string,
  ): Promise<LegalPersistenceResult<LegalDocumentInstance>>;
  listInstances(
    context: LegalReadAccessContext,
    query?: LegalDocumentInstanceListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalDocumentInstance>>>;
  listInstancesByRecipient(
    context: LegalReadAccessContext,
    recipientType: string,
    recipientId: string,
    query?: LegalDocumentInstanceListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalDocumentInstance>>>;
  listInstancesByTemplate(
    context: LegalReadAccessContext,
    templateId: string,
    query?: LegalDocumentInstanceListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalDocumentInstance>>>;
  listInstancesByStatus(
    context: LegalReadAccessContext,
    status: LegalDocumentInstance['status'],
    query?: LegalDocumentInstanceListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalDocumentInstance>>>;
};

export type LegalW9RequestReadRepositoryPort = {
  getW9RequestById(
    context: LegalReadAccessContext,
    requestId: string,
  ): Promise<LegalPersistenceResult<LegalW9Request>>;
  listW9Requests(
    context: LegalReadAccessContext,
    query?: LegalW9RequestListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalW9Request>>>;
  listW9RequestsByRecipient(
    context: LegalReadAccessContext,
    recipientType: string,
    recipientId: string,
    query?: LegalW9RequestListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalW9Request>>>;
  listW9RequestsByStatus(
    context: LegalReadAccessContext,
    status: LegalW9Request['status'],
    query?: LegalW9RequestListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalW9Request>>>;
  findActiveW9RequestByRecipientAndTemplate(
    context: LegalReadAccessContext,
    recipientType: string,
    recipientId: string,
    templateId: string,
  ): Promise<LegalPersistenceResult<LegalW9Request | null>>;
};

export type LegalDocumentSubmissionReadRepositoryPort = {
  getSubmissionById(
    context: LegalReadAccessContext,
    submissionId: string,
  ): Promise<LegalPersistenceResult<LegalDocumentSubmission>>;
  listSubmissions(
    context: LegalReadAccessContext,
    query?: LegalDocumentSubmissionListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalDocumentSubmission>>>;
  listSubmissionsByInstance(
    context: LegalReadAccessContext,
    instanceId: string,
    query?: LegalDocumentSubmissionListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalDocumentSubmission>>>;
  listSubmissionsByWorkflow(
    context: LegalReadAccessContext,
    workflowId: string,
    query?: LegalDocumentSubmissionListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalDocumentSubmission>>>;
  listSubmissionsIncludingDeleted(
    context: LegalReadAccessContext,
    query?: LegalDocumentSubmissionListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalDocumentSubmission>>>;
};

export type LegalAuditReadRepositoryPort = {
  getAuditEventById(
    context: LegalReadAccessContext,
    eventId: string,
  ): Promise<LegalPersistenceResult<LegalAuditEvent>>;
  listAuditEvents(
    context: LegalReadAccessContext,
    query?: LegalAuditEventListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalAuditEvent>>>;
  listAuditEventsByEntity(
    context: LegalReadAccessContext,
    entityType: LegalAuditEvent['entityType'],
    entityId: string,
    query?: LegalAuditEventListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalAuditEvent>>>;
  listAuditEventsByActor(
    context: LegalReadAccessContext,
    actorId: string,
    query?: LegalAuditEventListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalAuditEvent>>>;
  listAuditEventsByAction(
    context: LegalReadAccessContext,
    action: LegalAuditEvent['action'],
    query?: LegalAuditEventListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalAuditEvent>>>;
  listAuditEventsByCorrelationId(
    context: LegalReadAccessContext,
    correlationId: string,
    query?: LegalAuditEventListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalAuditEvent>>>;
  listAuditEventsByTimeRange(
    context: LegalReadAccessContext,
    dateFrom: string,
    dateTo: string,
    query?: LegalAuditEventListQuery,
  ): Promise<LegalPersistenceResult<LegalReadPage<LegalAuditEvent>>>;
};

export type LegalReadPersistenceRepositories = {
  readonly templates: LegalTemplateReadRepositoryPort;
  readonly instances: LegalDocumentInstanceReadRepositoryPort;
  readonly w9Requests: LegalW9RequestReadRepositoryPort;
  readonly submissions: LegalDocumentSubmissionReadRepositoryPort;
  readonly audit: LegalAuditReadRepositoryPort;
};
