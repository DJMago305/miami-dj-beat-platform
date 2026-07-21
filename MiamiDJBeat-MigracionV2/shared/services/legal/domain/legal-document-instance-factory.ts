/** LC-6 — Legal document instance factory and validation */

import type { LegalDocumentCategory } from '../contracts/legal-enums';
import {
  legalDocumentInstanceError,
  legalDocumentInstanceSuccess,
  type LegalDocumentInstanceResult,
} from './legal-document-instance-errors';
import type { LegalDocumentInstanceClock } from './legal-document-instance-clock';
import { createSystemLegalDocumentInstanceClock } from './legal-document-instance-clock';
import type {
  CreateLegalDocumentInstanceInput,
  LegalDocumentInstance,
  LegalDocumentInstanceId,
  LegalDocumentInstanceMetadata,
  LegalDocumentInstanceOwner,
  LegalDocumentInstanceRecipient,
  LegalDocumentInstanceSignatureRequirementSpec,
} from './legal-document-instance-types';
import {
  freezeLegalDocumentInstance,
} from './legal-document-instance-immutability';
import {
  LEGAL_DOCUMENT_INSTANCE_OWNER_TYPES,
  LEGAL_DOCUMENT_INSTANCE_RECIPIENT_TYPES,
  LEGAL_DOCUMENT_INSTANCE_SIGNATURE_REQUIREMENTS,
  LEGAL_DOCUMENT_INSTANCE_SOURCES,
} from './legal-document-instance-types';

const INSTANCE_ID_PATTERN = /^LDI-\d{6,}$/;

const LEGAL_DOCUMENT_CATEGORIES: readonly LegalDocumentCategory[] = ['LGL', 'CTR', 'SPC'];

export function isValidLegalDocumentInstanceId(value: string): value is LegalDocumentInstanceId {
  return INSTANCE_ID_PATTERN.test(value.trim());
}

export function formatLegalDocumentInstanceId(sequence: number): LegalDocumentInstanceId {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('Legal document instance sequence must be a positive integer.');
  }
  return `LDI-${String(sequence).padStart(6, '0')}`;
}

export function isValidLegalDocumentInstanceVersion(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

export function isValidLegalDocumentInstanceTimestamp(value: string): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function validateOptionalTimestamp(
  fieldName: string,
  value: string | undefined,
): LegalDocumentInstanceResult<true> | ReturnType<typeof legalDocumentInstanceError> {
  if (value === undefined) {
    return legalDocumentInstanceSuccess(true);
  }

  if (!isValidLegalDocumentInstanceTimestamp(value)) {
    return legalDocumentInstanceError(
      'invalid_instance_timestamp',
      `${fieldName} must be a valid ISO 8601 timestamp.`,
      Object.freeze({ fieldName, value }),
    );
  }

  return legalDocumentInstanceSuccess(true);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateTemplateReference(
  templateId: string,
  templateVersionId: string,
): LegalDocumentInstanceResult<true> | ReturnType<typeof legalDocumentInstanceError> {
  if (!isNonEmptyString(templateId) || !isNonEmptyString(templateVersionId)) {
    return legalDocumentInstanceError(
      'invalid_template_reference',
      'templateId and templateVersionId must be non-empty strings.',
    );
  }
  return legalDocumentInstanceSuccess(true);
}

function validateRecipient(
  recipient: LegalDocumentInstanceRecipient,
): LegalDocumentInstanceResult<true> | ReturnType<typeof legalDocumentInstanceError> {
  if (
    !LEGAL_DOCUMENT_INSTANCE_RECIPIENT_TYPES.includes(recipient.recipientType) ||
    !isNonEmptyString(recipient.recipientId) ||
    !isNonEmptyString(recipient.displayName)
  ) {
    return legalDocumentInstanceError(
      'invalid_recipient',
      'Recipient requires recipientType, recipientId, and displayName.',
    );
  }

  if (recipient.email !== undefined && !isNonEmptyString(recipient.email)) {
    return legalDocumentInstanceError('invalid_recipient', 'Recipient email must be non-empty when provided.');
  }

  return legalDocumentInstanceSuccess(true);
}

function validateOwner(
  owner: LegalDocumentInstanceOwner,
): LegalDocumentInstanceResult<true> | ReturnType<typeof legalDocumentInstanceError> {
  if (
    !LEGAL_DOCUMENT_INSTANCE_OWNER_TYPES.includes(owner.ownerType) ||
    !isNonEmptyString(owner.ownerId)
  ) {
    return legalDocumentInstanceError(
      'invalid_template_reference',
      'Owner requires ownerType and ownerId.',
    );
  }

  return legalDocumentInstanceSuccess(true);
}

function validateCategory(
  category: LegalDocumentCategory,
): LegalDocumentInstanceResult<true> | ReturnType<typeof legalDocumentInstanceError> {
  if (!LEGAL_DOCUMENT_CATEGORIES.includes(category)) {
    return legalDocumentInstanceError(
      'invalid_template_reference',
      `Unsupported legal document category: ${String(category)}`,
    );
  }
  return legalDocumentInstanceSuccess(true);
}

function validateSignatureRequirement(
  spec: LegalDocumentInstanceSignatureRequirementSpec,
): LegalDocumentInstanceResult<true> | ReturnType<typeof legalDocumentInstanceError> {
  if (!LEGAL_DOCUMENT_INSTANCE_SIGNATURE_REQUIREMENTS.includes(spec.requirement)) {
    return legalDocumentInstanceError(
      'invalid_template_reference',
      `Unsupported signature requirement: ${String(spec.requirement)}`,
    );
  }

  if (spec.requiredSignerCount !== undefined) {
    if (!Number.isInteger(spec.requiredSignerCount) || spec.requiredSignerCount < 1) {
      return legalDocumentInstanceError(
        'invalid_template_reference',
        'requiredSignerCount must be a positive integer when provided.',
      );
    }
  }

  return legalDocumentInstanceSuccess(true);
}

function normalizeMetadata(
  metadata: LegalDocumentInstanceMetadata | undefined,
): LegalDocumentInstanceMetadata {
  if (!metadata) {
    return Object.freeze({});
  }
  return Object.freeze({ ...metadata });
}

export type CreateLegalDocumentInstanceDependencies = {
  readonly clock?: LegalDocumentInstanceClock;
  readonly nextSequence?: () => number;
};

export function createLegalDocumentInstance(
  input: CreateLegalDocumentInstanceInput,
  dependencies: CreateLegalDocumentInstanceDependencies = {},
): LegalDocumentInstanceResult<LegalDocumentInstance> {
  const clock = dependencies.clock ?? createSystemLegalDocumentInstanceClock();
  const now = clock.now();

  if (!isValidLegalDocumentInstanceTimestamp(now)) {
    return legalDocumentInstanceError(
      'invalid_instance_timestamp',
      'Clock must provide a valid ISO 8601 timestamp.',
      Object.freeze({ now }),
    );
  }

  const expiresAtResult = validateOptionalTimestamp('expiresAt', input.expiresAt);
  if (!expiresAtResult.ok) {
    return expiresAtResult;
  }

  const categoryResult = validateCategory(input.category);
  if (!categoryResult.ok) {
    return categoryResult;
  }

  const templateResult = validateTemplateReference(input.templateId, input.templateVersionId);
  if (!templateResult.ok) {
    return templateResult;
  }

  const recipientResult = validateRecipient(input.recipient);
  if (!recipientResult.ok) {
    return recipientResult;
  }

  const ownerResult = validateOwner(input.owner);
  if (!ownerResult.ok) {
    return ownerResult;
  }

  if (!isNonEmptyString(input.title)) {
    return legalDocumentInstanceError('invalid_template_reference', 'title must be a non-empty string.');
  }

  const source = input.source ?? 'template';
  if (!LEGAL_DOCUMENT_INSTANCE_SOURCES.includes(source)) {
    return legalDocumentInstanceError('invalid_template_reference', `Unsupported source: ${String(source)}`);
  }

  const signatureRequirement = input.signatureRequirement ?? Object.freeze({ requirement: 'not_required' });
  const signatureResult = validateSignatureRequirement(signatureRequirement);
  if (!signatureResult.ok) {
    return signatureResult;
  }

  const initialStatus = input.initialStatus ?? 'draft';
  if (initialStatus !== 'draft' && initialStatus !== 'pending') {
    return legalDocumentInstanceError(
      'invalid_status_transition',
      'initialStatus must be draft or pending.',
    );
  }

  let id: LegalDocumentInstanceId;
  if (input.id !== undefined) {
    if (!isValidLegalDocumentInstanceId(input.id)) {
      return legalDocumentInstanceError(
        'invalid_template_reference',
        'instance id must match LDI-###### pattern.',
        Object.freeze({ id: input.id }),
      );
    }
    id = input.id.trim();
  } else {
    const sequence = dependencies.nextSequence?.();
    if (sequence === undefined || !Number.isInteger(sequence) || sequence < 1) {
      return legalDocumentInstanceError(
        'invalid_template_reference',
        'Auto-generated instance ids require nextSequence().',
      );
    }
    id = formatLegalDocumentInstanceId(sequence);
  }

  const instance = freezeLegalDocumentInstance({
    id,
    templateId: input.templateId.trim(),
    templateVersionId: input.templateVersionId.trim(),
    category: input.category,
    title: input.title.trim(),
    recipient: {
      recipientType: input.recipient.recipientType,
      recipientId: input.recipient.recipientId.trim(),
      displayName: input.recipient.displayName.trim(),
      ...(input.recipient.email ? { email: input.recipient.email.trim() } : {}),
    },
    owner: {
      ownerType: input.owner.ownerType,
      ownerId: input.owner.ownerId.trim(),
      ...(input.owner.issuedBy ? { issuedBy: input.owner.issuedBy.trim() } : {}),
      ...(input.owner.assignedBy ? { assignedBy: input.owner.assignedBy.trim() } : {}),
    },
    status: initialStatus,
    instanceVersion: 1,
    source,
    signatureRequirement: { ...signatureRequirement },
    metadata: normalizeMetadata(input.metadata),
    createdAt: now,
    updatedAt: now,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  });

  return legalDocumentInstanceSuccess(instance);
}
