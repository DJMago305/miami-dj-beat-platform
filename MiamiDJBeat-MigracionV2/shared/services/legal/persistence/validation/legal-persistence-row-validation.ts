/** LC-11 — Legal persistence row validation */

import { isLegalDocumentInstanceStatus } from '../../domain/legal-document-instance-status';
import { isLegalAuditAction } from '../../audit/legal-audit-action';
import { isValidLegalAuditCorrelationId } from '../../audit/legal-audit-immutability';
import { LEGAL_AUDIT_ENTITY_TYPES, LEGAL_AUDIT_OUTCOMES } from '../../audit/legal-audit-event-types';
import { isLegalDocumentSubmissionStatus } from '../../submissions/legal-document-submission-status';
import { isLegalW9RequestStatus } from '../../workflows/legal-w9-request-status';
import {
  legalPersistenceError,
  legalPersistenceSuccess,
  type LegalPersistenceResult,
} from '../legal-persistence-errors';
import type {
  LegalAuditEventRow,
  LegalDocumentInstanceRow,
  LegalDocumentSubmissionRow,
  LegalTemplateAssetRow,
  LegalTemplateRow,
  LegalTemplateVersionRow,
  LegalW9RequestRow,
} from '../schema/legal-persistence-row-types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const BUSINESS_ID_PATTERNS = {
  template: /^SPC-\d{3,}$/,
  templateVersion: /^TV-.+/,
  instance: /^LDI-\d{6,}$/,
  w9Request: /^W9R-\d{6,}$/,
  submission: /^LDS-\d{6,}$/,
  auditEvent: /^LAE-\d{6,}$/,
} as const;

export function isValidPersistenceUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function isValidPersistenceTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP_PATTERN.test(value.trim())) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

export function isValidRowVersion(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

function validateMetadata(
  value: unknown,
  field: string,
): LegalPersistenceResult<Readonly<Record<string, string | number | boolean | null>>> {
  if (value === null || value === undefined) {
    return legalPersistenceSuccess(Object.freeze({}));
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return legalPersistenceError('invalid_persistence_row', `${field} must be an object.`);
  }
  const normalized: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean'
    ) {
      normalized[key] = entry;
    } else {
      return legalPersistenceError('invalid_persistence_row', `${field}.${key} is not serializable.`);
    }
  }
  return legalPersistenceSuccess(Object.freeze(normalized));
}

function requireUuid(value: string, field: string): LegalPersistenceResult<string> {
  const normalized = value.trim();
  if (!isValidPersistenceUuid(normalized)) {
    return legalPersistenceError('invalid_persistence_row', `${field} must be a UUID.`);
  }
  return legalPersistenceSuccess(normalized);
}

function requireTimestamp(value: string, field: string): LegalPersistenceResult<string> {
  const normalized = value.trim();
  if (!isValidPersistenceTimestamp(normalized)) {
    return legalPersistenceError('persistence_timestamp_invalid', `${field} must be ISO 8601.`);
  }
  return legalPersistenceSuccess(normalized);
}

function requireBusinessId(
  value: string,
  pattern: RegExp,
  field: string,
): LegalPersistenceResult<string> {
  const normalized = value.trim();
  if (!pattern.test(normalized)) {
    return legalPersistenceError('invalid_persistence_row', `${field} has invalid business id format.`);
  }
  return legalPersistenceSuccess(normalized);
}

export function validateLegalTemplateRow(row: LegalTemplateRow): LegalPersistenceResult<LegalTemplateRow> {
  const id = requireUuid(row.id, 'id');
  if (!id.ok) return id;
  const businessId = requireBusinessId(row.business_id, BUSINESS_ID_PATTERNS.template, 'business_id');
  if (!businessId.ok) return businessId;
  if (!isValidRowVersion(row.row_version)) {
    return legalPersistenceError('persistence_version_invalid', 'row_version must be >= 1.');
  }
  const createdAt = requireTimestamp(row.created_at, 'created_at');
  if (!createdAt.ok) return createdAt;
  const updatedAt = requireTimestamp(row.updated_at, 'updated_at');
  if (!updatedAt.ok) return updatedAt;
  const signaturePlan = validateMetadata(row.signature_plan_default, 'signature_plan_default');
  if (!signaturePlan.ok) return signaturePlan;
  const fieldSchema = validateMetadata(row.field_schema_default, 'field_schema_default');
  if (!fieldSchema.ok) return fieldSchema;
  return legalPersistenceSuccess(Object.freeze({ ...row, id: id.value, business_id: businessId.value }));
}

export function validateLegalTemplateVersionRow(
  row: LegalTemplateVersionRow,
): LegalPersistenceResult<LegalTemplateVersionRow> {
  const id = requireUuid(row.id, 'id');
  if (!id.ok) return id;
  const templateId = requireUuid(row.template_id, 'template_id');
  if (!templateId.ok) return templateId;
  const businessId = requireBusinessId(row.business_id, BUSINESS_ID_PATTERNS.templateVersion, 'business_id');
  if (!businessId.ok) return businessId;
  if (!isValidRowVersion(row.row_version)) {
    return legalPersistenceError('persistence_version_invalid', 'row_version must be >= 1.');
  }
  const publishedAt = requireTimestamp(row.published_at, 'published_at');
  if (!publishedAt.ok) return publishedAt;
  return legalPersistenceSuccess(Object.freeze({ ...row, id: id.value, template_id: templateId.value }));
}

export function validateLegalTemplateAssetRow(
  row: LegalTemplateAssetRow,
): LegalPersistenceResult<LegalTemplateAssetRow> {
  const id = requireUuid(row.id, 'id');
  if (!id.ok) return id;
  const versionId = requireUuid(row.template_version_id, 'template_version_id');
  if (!versionId.ok) return versionId;
  if (!Array.isArray(row.allowed_portals) || row.allowed_portals.length === 0) {
    return legalPersistenceError('invalid_persistence_row', 'allowed_portals must be a non-empty array.');
  }
  if (!isValidRowVersion(row.row_version)) {
    return legalPersistenceError('persistence_version_invalid', 'row_version must be >= 1.');
  }
  return legalPersistenceSuccess(Object.freeze({ ...row, id: id.value, template_version_id: versionId.value }));
}

export function validateLegalDocumentInstanceRow(
  row: LegalDocumentInstanceRow,
): LegalPersistenceResult<LegalDocumentInstanceRow> {
  const id = requireUuid(row.id, 'id');
  if (!id.ok) return id;
  const businessId = requireBusinessId(row.business_id, BUSINESS_ID_PATTERNS.instance, 'business_id');
  if (!businessId.ok) return businessId;
  if (!isLegalDocumentInstanceStatus(row.status)) {
    return legalPersistenceError('persistence_status_invalid', `Invalid instance status: ${row.status}`);
  }
  if (!Number.isInteger(row.instance_version) || row.instance_version < 1) {
    return legalPersistenceError('persistence_version_invalid', 'instance_version must be >= 1.');
  }
  if (!isValidRowVersion(row.row_version)) {
    return legalPersistenceError('persistence_version_invalid', 'row_version must be >= 1.');
  }
  const createdAt = requireTimestamp(row.created_at, 'created_at');
  if (!createdAt.ok) return createdAt;
  const updatedAt = requireTimestamp(row.updated_at, 'updated_at');
  if (!updatedAt.ok) return updatedAt;
  const metadata = validateMetadata(row.metadata, 'metadata');
  if (!metadata.ok) return metadata;
  return legalPersistenceSuccess(
    Object.freeze({ ...row, id: id.value, business_id: businessId.value, metadata: metadata.value }),
  );
}

export function validateLegalW9RequestRow(row: LegalW9RequestRow): LegalPersistenceResult<LegalW9RequestRow> {
  const id = requireUuid(row.id, 'id');
  if (!id.ok) return id;
  const instanceId = requireUuid(row.document_instance_id, 'document_instance_id');
  if (!instanceId.ok) return instanceId;
  const businessId = requireBusinessId(row.business_id, BUSINESS_ID_PATTERNS.w9Request, 'business_id');
  if (!businessId.ok) return businessId;
  if (!isLegalW9RequestStatus(row.status)) {
    return legalPersistenceError('persistence_status_invalid', `Invalid W-9 status: ${row.status}`);
  }
  if (!isValidRowVersion(row.row_version)) {
    return legalPersistenceError('persistence_version_invalid', 'row_version must be >= 1.');
  }
  const requestedAt = requireTimestamp(row.requested_at, 'requested_at');
  if (!requestedAt.ok) return requestedAt;
  const metadata = validateMetadata(row.metadata, 'metadata');
  if (!metadata.ok) return metadata;
  return legalPersistenceSuccess(
    Object.freeze({ ...row, id: id.value, document_instance_id: instanceId.value, metadata: metadata.value }),
  );
}

export function validateLegalDocumentSubmissionRow(
  row: LegalDocumentSubmissionRow,
): LegalPersistenceResult<LegalDocumentSubmissionRow> {
  const id = requireUuid(row.id, 'id');
  if (!id.ok) return id;
  const instanceId = requireUuid(row.document_instance_id, 'document_instance_id');
  if (!instanceId.ok) return instanceId;
  const businessId = requireBusinessId(row.business_id, BUSINESS_ID_PATTERNS.submission, 'business_id');
  if (!businessId.ok) return businessId;
  if (!isLegalDocumentSubmissionStatus(row.status)) {
    return legalPersistenceError('persistence_status_invalid', `Invalid submission status: ${row.status}`);
  }
  if (!Number.isInteger(row.size_bytes) || row.size_bytes < 0) {
    return legalPersistenceError('invalid_persistence_row', 'size_bytes must be a non-negative integer.');
  }
  if (!isValidRowVersion(row.row_version)) {
    return legalPersistenceError('persistence_version_invalid', 'row_version must be >= 1.');
  }
  const createdAt = requireTimestamp(row.created_at, 'created_at');
  if (!createdAt.ok) return createdAt;
  const submittedAt = requireTimestamp(row.submitted_at, 'submitted_at');
  if (!submittedAt.ok) return submittedAt;
  const updatedAt = requireTimestamp(row.updated_at, 'updated_at');
  if (!updatedAt.ok) return updatedAt;
  if (Date.parse(createdAt.value) > Date.parse(submittedAt.value)) {
    return legalPersistenceError(
      'persistence_timestamp_invalid',
      'created_at must not be after submitted_at.',
    );
  }
  if (Date.parse(submittedAt.value) > Date.parse(updatedAt.value)) {
    return legalPersistenceError(
      'persistence_timestamp_invalid',
      'submitted_at must not be after updated_at.',
    );
  }
  if (!row.recipient_type.trim() || !row.recipient_id.trim()) {
    return legalPersistenceError('persistence_relation_invalid', 'Submission recipient scope is required.');
  }
  const metadata = validateMetadata(row.metadata, 'metadata');
  if (!metadata.ok) return metadata;
  return legalPersistenceSuccess(
    Object.freeze({ ...row, id: id.value, document_instance_id: instanceId.value, metadata: metadata.value }),
  );
}

function validateRelatedEntityIdsArray(
  value: unknown,
): LegalPersistenceResult<readonly string[]> {
  if (!Array.isArray(value)) {
    return legalPersistenceError('invalid_persistence_row', 'related_entity_ids must be an array.');
  }
  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !entry.trim()) {
      return legalPersistenceError(
        'invalid_persistence_row',
        'related_entity_ids entries must be non-empty strings.',
      );
    }
    normalized.push(entry.trim());
  }
  return legalPersistenceSuccess(Object.freeze(normalized));
}

export function validateLegalAuditEventRow(row: LegalAuditEventRow): LegalPersistenceResult<LegalAuditEventRow> {
  const id = requireUuid(row.id, 'id');
  if (!id.ok) return id;
  const businessId = requireBusinessId(row.business_id, BUSINESS_ID_PATTERNS.auditEvent, 'business_id');
  if (!businessId.ok) return businessId;
  if (!Number.isInteger(row.sequence) || row.sequence < 1) {
    return legalPersistenceError('invalid_persistence_row', 'sequence must be >= 1.');
  }
  if (!isLegalAuditAction(row.action)) {
    return legalPersistenceError('invalid_persistence_row', `Invalid audit action: ${row.action}`);
  }
  if (!(LEGAL_AUDIT_ENTITY_TYPES as readonly string[]).includes(row.entity_type)) {
    return legalPersistenceError('invalid_persistence_row', `Invalid audit entity type: ${row.entity_type}`);
  }
  if (!(LEGAL_AUDIT_OUTCOMES as readonly string[]).includes(row.outcome)) {
    return legalPersistenceError('invalid_persistence_row', `Invalid audit outcome: ${row.outcome}`);
  }
  const occurredAt = requireTimestamp(row.occurred_at, 'occurred_at');
  if (!occurredAt.ok) return occurredAt;
  const metadata = validateMetadata(row.metadata, 'metadata');
  if (!metadata.ok) return metadata;
  const related = validateRelatedEntityIdsArray(row.related_entity_ids);
  if (!related.ok) return related;
  const correlationId = requireBusinessId(
    row.correlation_id,
    /^LAC-[0-9]{6,}$/,
    'correlation_id',
  );
  if (!correlationId.ok) return correlationId;
  if (!isValidLegalAuditCorrelationId(correlationId.value)) {
    return legalPersistenceError('invalid_persistence_row', 'correlation_id must match LAC-###### format.');
  }
  return legalPersistenceSuccess(
    Object.freeze({
      ...row,
      id: id.value,
      business_id: businessId.value,
      metadata: metadata.value,
      related_entity_ids: related.value,
      correlation_id: correlationId.value,
    }),
  );
}

export function validateLegalPersistenceReadEnvelope<T>(
  envelope: unknown,
): LegalPersistenceResult<{ readonly data: readonly T[]; readonly next_cursor: string | null; readonly has_more: boolean }> {
  if (!envelope || typeof envelope !== 'object') {
    return legalPersistenceError('persistence_transport_error', 'Persistence envelope must be an object.');
  }
  const value = envelope as Record<string, unknown>;
  if (!Array.isArray(value.data)) {
    return legalPersistenceError('persistence_transport_error', 'Persistence envelope data must be an array.');
  }
  if (value.next_cursor !== null && typeof value.next_cursor !== 'string') {
    return legalPersistenceError('persistence_transport_error', 'Persistence envelope next_cursor invalid.');
  }
  if (typeof value.has_more !== 'boolean') {
    return legalPersistenceError('persistence_transport_error', 'Persistence envelope has_more must be boolean.');
  }
  return legalPersistenceSuccess(
    Object.freeze({
      data: Object.freeze([...(value.data as T[])]),
      next_cursor: value.next_cursor,
      has_more: value.has_more,
    }),
  );
}
