/** LC-11 — Legal persistence row → domain mappers */

import type { LegalTemplate } from '../../contracts/legal-entities';
import type { LegalAuditEvent } from '../../audit/legal-audit-event-types';
import type { LegalDocumentInstance } from '../../domain/legal-document-instance-types';
import type { LegalDocumentSubmission } from '../../submissions/legal-document-submission-types';
import type { LegalW9Request } from '../../workflows/legal-w9-request-types';
import { freezeLegalAuditEvent } from '../../audit/legal-audit-immutability';
import { freezeLegalDocumentInstance } from '../../domain/legal-document-instance-immutability';
import { freezeLegalDocumentSubmission } from '../../submissions/legal-document-submission-immutability';
import { freezeLegalW9Request } from '../../workflows/legal-w9-request-immutability';
import {
  validateLegalAuditEventRow,
  validateLegalDocumentInstanceRow,
  validateLegalDocumentSubmissionRow,
  validateLegalTemplateAssetRow,
  validateLegalTemplateRow,
  validateLegalTemplateVersionRow,
  validateLegalW9RequestRow,
} from '../validation/legal-persistence-row-validation';
import {
  legalPersistenceError,
  legalPersistenceSuccess,
  type LegalPersistenceResult,
} from '../legal-persistence-errors';
import {
  mapRelatedEntityIdsArrayToDomain,
} from '../shared/legal-audit-related-entity-ids';
import type {
  LegalAuditEventRow,
  LegalDocumentInstanceRow,
  LegalDocumentSubmissionRow,
  LegalTemplateAssetRow,
  LegalTemplateRow,
  LegalTemplateVersionRow,
  LegalW9RequestRow,
} from '../schema/legal-persistence-row-types';
import type { LegalTemplateAssetCatalogEntry } from '../../assets/legal-template-asset-types';

export function mapLegalTemplateRowToDomain(row: LegalTemplateRow): LegalPersistenceResult<LegalTemplate> {
  const validated = validateLegalTemplateRow(row);
  if (!validated.ok) {
    return validated;
  }
  return legalPersistenceSuccess(
    Object.freeze({
      templateId: validated.value.business_id,
      templateCode: validated.value.template_code,
      category: validated.value.category as LegalTemplate['category'],
      officialName: validated.value.official_name,
      currentPublishedVersionId: validated.value.current_published_version_id ?? undefined,
      signaturePlanDefault: Object.freeze({ ...validated.value.signature_plan_default }),
      fieldSchemaDefault: Object.freeze({ ...validated.value.field_schema_default }),
      isPolicy: validated.value.is_policy,
      requiresCountersign: validated.value.requires_countersign,
      counselReviewRequired: validated.value.counsel_review_required,
      status: validated.value.status as LegalTemplate['status'],
    }),
  );
}

export function mapLegalTemplateVersionRowToDomain(
  row: LegalTemplateVersionRow,
): LegalPersistenceResult<TemplateVersionReadModel> {
  const validated = validateLegalTemplateVersionRow(row);
  if (!validated.ok) {
    return validated;
  }
  return legalPersistenceSuccess(
    Object.freeze({
      templateVersionId: validated.value.business_id,
      templateId: validated.value.template_business_id,
      semver: validated.value.semver,
      contentHash: validated.value.content_hash,
      publishedAt: validated.value.published_at,
      publishedByStaffId: validated.value.published_by_staff_id,
      effectiveFrom: validated.value.effective_from,
      retiredAt: validated.value.retired_at ?? undefined,
      localeBodies: Object.freeze({ ...validated.value.locale_bodies }),
    }),
  );
}

export type TemplateVersionReadModel = {
  readonly templateVersionId: string;
  readonly templateId: string;
  readonly semver: string;
  readonly contentHash: string;
  readonly publishedAt: string;
  readonly publishedByStaffId: string;
  readonly effectiveFrom: string;
  readonly retiredAt?: string;
  readonly localeBodies: Readonly<Record<string, string | number | boolean | null>>;
};

export function mapLegalTemplateAssetRowToDomain(
  row: LegalTemplateAssetRow,
): LegalPersistenceResult<LegalTemplateAssetCatalogEntry> {
  const validated = validateLegalTemplateAssetRow(row);
  if (!validated.ok) {
    return validated;
  }
  return legalPersistenceSuccess(
    Object.freeze({
      templateCode: validated.value.template_business_id,
      templateVersionId: validated.value.template_version_business_id,
      category: validated.value.category as LegalTemplateAssetCatalogEntry['category'],
      officialName: validated.value.filename,
      assetKey: validated.value.asset_key,
      filename: validated.value.filename,
      mimeType: validated.value.mime_type,
      kind: validated.value.kind as LegalTemplateAssetCatalogEntry['kind'],
      availability: validated.value.availability as LegalTemplateAssetCatalogEntry['availability'],
      sharedAcrossPortals: validated.value.shared_across_portals,
      allowedPortals: Object.freeze(
        [...validated.value.allowed_portals],
      ) as LegalTemplateAssetCatalogEntry['allowedPortals'],
      isPublicLibraryDocument: validated.value.is_public_library_document,
    }),
  );
}

export function mapLegalDocumentInstanceRowToDomain(
  row: LegalDocumentInstanceRow,
): LegalPersistenceResult<LegalDocumentInstance> {
  const validated = validateLegalDocumentInstanceRow(row);
  if (!validated.ok) {
    return validated;
  }
  const instance = freezeLegalDocumentInstance({
    id: validated.value.business_id,
    templateId: validated.value.template_id,
    templateVersionId: validated.value.template_version_id,
    category: validated.value.category as LegalDocumentInstance['category'],
    title: validated.value.title,
    recipient: Object.freeze({
      recipientType: validated.value.recipient_type as LegalDocumentInstance['recipient']['recipientType'],
      recipientId: validated.value.recipient_id,
      displayName: validated.value.recipient_display_name,
      ...(validated.value.recipient_email ? { email: validated.value.recipient_email } : {}),
    }),
    owner: Object.freeze({
      ownerType: validated.value.owner_type as LegalDocumentInstance['owner']['ownerType'],
      ownerId: validated.value.owner_id,
      ...(validated.value.issued_by ? { issuedBy: validated.value.issued_by } : {}),
      ...(validated.value.assigned_by ? { assignedBy: validated.value.assigned_by } : {}),
    }),
    status: validated.value.status as LegalDocumentInstance['status'],
    instanceVersion: validated.value.instance_version,
    source: validated.value.source as LegalDocumentInstance['source'],
    signatureRequirement: Object.freeze({
      requirement: String(validated.value.signature_requirement.requirement ?? 'single_signer') as LegalDocumentInstance['signatureRequirement']['requirement'],
      ...(validated.value.signature_requirement.requiredSignerCount !== undefined
        ? { requiredSignerCount: Number(validated.value.signature_requirement.requiredSignerCount) }
        : {}),
    }),
    metadata: Object.freeze({ ...validated.value.metadata }),
    createdAt: validated.value.created_at,
    updatedAt: validated.value.updated_at,
    ...(validated.value.expires_at ? { expiresAt: validated.value.expires_at } : {}),
    ...(validated.value.sent_at ? { sentAt: validated.value.sent_at } : {}),
    ...(validated.value.viewed_at ? { viewedAt: validated.value.viewed_at } : {}),
    ...(validated.value.signed_at ? { signedAt: validated.value.signed_at } : {}),
    ...(validated.value.rejected_at ? { rejectedAt: validated.value.rejected_at } : {}),
    ...(validated.value.cancelled_at ? { cancelledAt: validated.value.cancelled_at } : {}),
    ...(validated.value.expired_at ? { expiredAt: validated.value.expired_at } : {}),
  });
  return legalPersistenceSuccess(instance);
}

export function mapLegalW9RequestRowToDomain(row: LegalW9RequestRow): LegalPersistenceResult<LegalW9Request> {
  const validated = validateLegalW9RequestRow(row);
  if (!validated.ok) {
    return validated;
  }
  const request = freezeLegalW9Request({
    id: validated.value.business_id,
    documentInstanceId: validated.value.document_instance_business_id,
    templateId: validated.value.template_id as LegalW9Request['templateId'],
    templateVersionId: validated.value.template_version_id as LegalW9Request['templateVersionId'],
    recipient: Object.freeze({
      recipientType: validated.value.recipient_type as LegalW9Request['recipient']['recipientType'],
      recipientId: validated.value.recipient_id,
      displayName: validated.value.recipient_display_name,
      ...(validated.value.recipient_email ? { email: validated.value.recipient_email } : {}),
    }),
    requestedBy: Object.freeze({
      actorId: validated.value.requested_by_actor_id,
      displayName: validated.value.requested_by_display_name,
      role: validated.value.requested_by_role as 'owner' | 'manager',
    }),
    status: validated.value.status as LegalW9Request['status'],
    reviewStatus: validated.value.review_status as LegalW9Request['reviewStatus'],
    requestedAt: validated.value.requested_at,
    updatedAt: validated.value.updated_at,
    metadata: Object.freeze({ ...validated.value.metadata }),
    ...(validated.value.due_at ? { dueAt: validated.value.due_at } : {}),
    ...(validated.value.viewed_at ? { viewedAt: validated.value.viewed_at } : {}),
    ...(validated.value.completed_at ? { completedAt: validated.value.completed_at } : {}),
    ...(validated.value.submission_business_id ? { submissionId: validated.value.submission_business_id } : {}),
  });
  return legalPersistenceSuccess(request);
}

export function mapLegalDocumentSubmissionRowToDomain(
  row: LegalDocumentSubmissionRow,
): LegalPersistenceResult<LegalDocumentSubmission> {
  const validated = validateLegalDocumentSubmissionRow(row);
  if (!validated.ok) {
    return validated;
  }
  const submission = freezeLegalDocumentSubmission({
    id: validated.value.business_id,
    documentInstanceId: validated.value.document_instance_business_id,
    templateId: validated.value.template_id,
    templateVersionId: validated.value.template_version_id,
    storageKey: validated.value.storage_key,
    filename: validated.value.filename,
    mimeType: validated.value.mime_type as LegalDocumentSubmission['mimeType'],
    sizeBytes: validated.value.size_bytes,
    checksum: validated.value.checksum,
    contentReference: validated.value.content_reference,
    createdAt: validated.value.created_at,
    submittedBy: Object.freeze({
      actorId: validated.value.submitted_by_actor_id,
      displayName: validated.value.submitted_by_display_name,
      portal: validated.value.submitted_by_portal as LegalDocumentSubmission['submittedBy']['portal'],
      ...(validated.value.submitted_by_role
        ? { role: validated.value.submitted_by_role as NonNullable<LegalDocumentSubmission['submittedBy']['role']> }
        : {}),
    }),
    submittedAt: validated.value.submitted_at,
    updatedAt: validated.value.updated_at,
    status: validated.value.status as LegalDocumentSubmission['status'],
    metadata: Object.freeze({ ...validated.value.metadata }),
    ...(validated.value.workflow_business_id ? { workflowId: validated.value.workflow_business_id } : {}),
  });
  return legalPersistenceSuccess(submission);
}

export function mapLegalAuditEventRowToDomain(row: LegalAuditEventRow): LegalPersistenceResult<LegalAuditEvent> {
  const validated = validateLegalAuditEventRow(row);
  if (!validated.ok) {
    return validated;
  }
  const related = mapRelatedEntityIdsArrayToDomain(validated.value.related_entity_ids);
  const event = freezeLegalAuditEvent({
    id: validated.value.business_id,
    sequence: validated.value.sequence,
    occurredAt: validated.value.occurred_at,
    actor: Object.freeze({
      actorType: validated.value.actor_type as LegalAuditEvent['actor']['actorType'],
      actorId: validated.value.actor_id,
      role: validated.value.actor_role as LegalAuditEvent['actor']['role'],
      portal: validated.value.actor_portal as LegalAuditEvent['actor']['portal'],
      ...(validated.value.actor_display_name ? { displayName: validated.value.actor_display_name } : {}),
    }),
    action: validated.value.action as LegalAuditEvent['action'],
    entityType: validated.value.entity_type as LegalAuditEvent['entityType'],
    entityId: validated.value.entity_id,
    relatedEntityIds: Object.freeze(related),
    ...(validated.value.previous_state ? { previousState: Object.freeze({ ...validated.value.previous_state }) } : {}),
    ...(validated.value.next_state ? { nextState: Object.freeze({ ...validated.value.next_state }) } : {}),
    outcome: validated.value.outcome as LegalAuditEvent['outcome'],
    ...(validated.value.reason_code ? { reasonCode: validated.value.reason_code } : {}),
    correlationId: validated.value.correlation_id,
    ...(validated.value.request_id ? { requestId: validated.value.request_id } : {}),
    metadata: Object.freeze({ ...validated.value.metadata }),
  });
  return legalPersistenceSuccess(event);
}

export function mapRowsToDomainList<TRow, TDomain>(
  rows: readonly TRow[],
  mapper: (row: TRow) => LegalPersistenceResult<TDomain>,
): LegalPersistenceResult<readonly TDomain[]> {
  const mapped: TDomain[] = [];
  for (const row of rows) {
    const result = mapper(row);
    if (!result.ok) {
      return result;
    }
    mapped.push(result.value);
  }
  return legalPersistenceSuccess(Object.freeze(mapped));
}

export function assertRelation(
  condition: boolean,
  message: string,
): LegalPersistenceResult<true> {
  if (!condition) {
    return legalPersistenceError('persistence_relation_invalid', message);
  }
  return legalPersistenceSuccess(true);
}
